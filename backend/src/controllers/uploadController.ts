/* eslint-disable @typescript-eslint/no-unused-vars */ // Remove if using the commented out handlers
import { Request, Response } from 'express';
import fs from 'fs/promises'; // Needed for filestore operations
import path from 'path'; // Needed for path manipulation
import { PrismaClient, Project, Client } from '@prisma/client'; // Add Project, Client types
import xxhash from 'xxhash-wasm';
import { logger } from '../utils/logger'; // Correct path
import { getTelegramBot } from '../services/telegram/telegramBot';
import { s3FileProcessor } from '../services/s3/s3FileProcessor'; // Needed for S3 processing
import { uploadTracker } from '../services/uploads/uploadTracker'; // Import uploadTracker

// Initialize Prisma Client
const prisma = new PrismaClient();
// Initialize xxhash - Restore this
let xxhash64: Awaited<ReturnType<typeof xxhash>>;
xxhash().then(instance => { xxhash64 = instance; });


// Define the structure of the .info file JSON payload received from the hook
interface TusInfoFilePayload {
  ID: string;
  Size: number;
  SizeIsDeferred: boolean;
  Offset: number;
  MetaData: {
    // Expecting decoded values here if possible, otherwise need decoding step
    clientCode?: string; // May not be present, rely on token lookup
    filename?: string;
    filetype?: string;
    name?: string; // Often same as filename
    project?: string; // May not be present, rely on token lookup
    relativePath?: string | null;
    token?: string; // CRUCIAL for validation
    type?: string; // Often same as filetype
    [key: string]: string | undefined | null; // Allow other metadata fields
  };
  IsPartial: boolean;
  IsFinal: boolean;
  PartialUploads: string[] | null;
  Storage: {
    InfoPath: string; // Absolute path to the .info file
    Path: string; // Absolute path to the data file
    Type: 'filestore' | 's3store' | string; // Storage type used by tusd
  };
}

// Helper function to sanitize strings for use in file paths - Restore this
const sanitizePathString = (str: string | undefined | null): string => {
    if (!str) return 'unknown';
    // Replace potentially problematic characters with underscores
    // Disallow '..' to prevent path traversal
    return str.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\.\./g, '_');
};

// Helper function to decode base64 metadata values safely (if needed)
// Tusd *might* still base64 encode metadata even in the .info file. Check actual file content.
// If the hook sends already-decoded JSON, this isn't needed here.
// function decodeMetadataValue(encodedValue: string | undefined): string {
//   // ... (same implementation as before) ...
// }


// --- Basic Payload Validation ---
// Removed the duplicate definition above this line.
// The correct definition starts below.

// --- Basic Payload Validation ---
export const handleProcessFinishedUpload = async (req: Request, res: Response): Promise<void> => { // Ensure this is the only export of this function
  const infoPayload = req.body as TusInfoFilePayload;
  const uploadId = infoPayload?.ID;

  // Acknowledge Tusd immediately ONLY if the basic payload looks okay.
  // We'll handle internal errors without failing the hook where possible.
  if (uploadId && infoPayload.MetaData?.token && infoPayload.Storage?.Path) {
    res.status(200).send({ message: 'Received finished upload payload. Processing initiated.' });
  } else {
    // If basic info is missing, reject the hook call.
    logger.error(`[ProcessFinished:${uploadId || 'UNKNOWN'}] Invalid or incomplete payload received from hook. Missing ID, token, or storage path.`);
    res.status(400).send({ message: 'Invalid or incomplete payload.' });
    return; // Stop processing
  }

  logger.info(`[ProcessFinished:${uploadId}] Received finished upload payload.`);
  logger.debug(`[ProcessFinished:${uploadId}] Payload:`, infoPayload);

  // --- Basic Payload Validation ---
  if (!uploadId || !infoPayload.MetaData?.token || !infoPayload.Storage?.Path || !infoPayload.Storage?.InfoPath || !infoPayload.Storage?.Type) {
    logger.error(`[ProcessFinished:${uploadId}] Invalid or incomplete payload received from hook. Missing ID, token, storage paths, or type.`);
    // Already responded with 400 above if critical info was missing.
    return;
  }

  // --- Get TUSD Data Directory (Needed for constructing relative paths if necessary) ---
  // This should match the root directory tusd uses.
  const tusdDataDir = process.env.TUSD_DATA_DIR;
  if (!tusdDataDir) {
    logger.error('[ProcessFinished:${uploadId}] TUSD_DATA_DIR environment variable is not set. Cannot reliably construct destination paths.');
    // Optionally send failure notification
    return;
  }

  const telegramBot = getTelegramBot(); // Get bot instance

  // --- Process Upload Asynchronously ---
  try {
    // --- Restore Core Processing Logic ---

    // 1. Decode Metadata (if necessary - check actual .info file content)
    // Assuming metadata in the received JSON is already decoded for now.
    const metadata = infoPayload.MetaData; // Use directly if already decoded
    const token = metadata.token; // Already checked for existence

    // 2. Validate Token & Get Project/Client Info
    logger.info(`[ProcessFinished:${uploadId}] Validating token: ${token ? token.substring(0, 8) + '...' : 'MISSING'}`);
    const uploadLink = await prisma.uploadLink.findUnique({
      where: { token: token },
      include: {
        project: { include: { client: true } }
      }
    });

    if (!uploadLink) throw new Error(`Upload link with token not found.`);
    if (uploadLink.expiresAt && new Date() > new Date(uploadLink.expiresAt)) throw new Error(`Upload link has expired.`);
    if (!uploadLink.project) throw new Error(`Project not found for upload link.`);
    if (!uploadLink.project.client) throw new Error(`Client not found for the project.`);

    const client: Client = uploadLink.project.client; // Assign type
    const project: Project = uploadLink.project; // Assign type
    const clientCode = client.code;
    const projectName = project.name;

    if (!clientCode || !projectName) throw new Error('Client code or project name could not be determined.');

    logger.info(`[ProcessFinished:${uploadId}] Token valid. Client: ${clientCode}, Project: ${projectName}`);

    // 3. Prepare File Info
    const originalFilename = metadata.filename || metadata.name || uploadId; // Fallback to ID
    const sanitizedClientCode = sanitizePathString(clientCode);
    const sanitizedProjectName = sanitizePathString(projectName);
    const sanitizedFilename = sanitizePathString(originalFilename); // Define sanitizedFilename

    const sourceDataPath = infoPayload.Storage.Path;
    const sourceInfoPath = infoPayload.Storage.InfoPath;
    const storageType = infoPayload.Storage.Type;

    // Declare variables needed later
    let finalPath: string;
    let finalUrl: string | null = null;
    let finalStorageType = storageType; // May change if moved from local to S3 later
    let absoluteDestFilePath: string | undefined = undefined;

    // 4. Process based on Storage Type
    if (storageType === 'filestore') {
      logger.info(`[ProcessFinished:${uploadId}] Processing filestore upload.`);

      // Define Destination Paths (relative to tusdDataDir for consistency)
      const relativeDestDir = path.join(sanitizedClientCode, sanitizedProjectName);
      const relativeDestMetadataDir = path.join(relativeDestDir, '.metadata');
      const relativeDestFilePath = path.join(relativeDestDir, sanitizedFilename);
      const relativeDestInfoPath = path.join(relativeDestMetadataDir, `${sanitizedFilename}.info`);

      // Absolute paths for file operations
      const absoluteDestMetadataDir = path.join(tusdDataDir, relativeDestMetadataDir);
      absoluteDestFilePath = path.join(tusdDataDir, relativeDestFilePath); // Assign value here
      const absoluteDestInfoPath = path.join(tusdDataDir, relativeDestInfoPath);

      logger.info(`[ProcessFinished:${uploadId}] Calculated paths:`);
      logger.info(`  Source Data: ${sourceDataPath}`);
      logger.info(`  Source Info: ${sourceInfoPath}`);
      logger.info(`  Dest Data:   ${absoluteDestFilePath}`);
      logger.info(`  Dest Info:   ${absoluteDestInfoPath}`);

      // Create Directories
      logger.info(`[ProcessFinished:${uploadId}] Ensuring destination directories exist: ${absoluteDestMetadataDir}`);
      await fs.mkdir(absoluteDestMetadataDir, { recursive: true });

      // Move Files (Data first, then Info)
      logger.info(`[ProcessFinished:${uploadId}] Moving data file from ${sourceDataPath} to ${absoluteDestFilePath}`);
      await fs.rename(sourceDataPath, absoluteDestFilePath);
      logger.info(`[ProcessFinished:${uploadId}] Successfully moved data file.`);

      logger.info(`[ProcessFinished:${uploadId}] Moving info file from ${sourceInfoPath} to ${absoluteDestInfoPath}`);
      try {
        await fs.rename(sourceInfoPath, absoluteDestInfoPath);
        logger.info(`[ProcessFinished:${uploadId}] Successfully moved info file.`);
      } catch (infoMoveError) {
        logger.warn(`[ProcessFinished:${uploadId}] Failed to move info file (non-critical):`, infoMoveError);
      }

      // Set final path for DB (relative path is often more portable)
      finalPath = relativeDestFilePath; // Assign finalPath
      // Construct URL if applicable (depends on how files are served)
      // finalUrl = `http://your-file-server/${finalPath}`; // Example

    } else if (storageType === 's3store') {
      logger.info(`[ProcessFinished:${uploadId}] Processing s3store upload.`);
      if (!token) {
          throw new Error(`Token is missing, cannot process S3 upload for ${uploadId}.`);
      }
      const s3Processed = await s3FileProcessor.processFile(uploadId, token);

      if (!s3Processed) {
        throw new Error(`S3 file processing failed for upload ${uploadId}.`);
      }

      const updatedFile = await prisma.uploadedFile.findUnique({ where: { id: uploadId } });
      if (!updatedFile || !updatedFile.path) {
          throw new Error(`Failed to retrieve updated file details from DB after S3 processing for ${uploadId}.`);
      }
      finalPath = updatedFile.path; // Assign finalPath
      finalUrl = updatedFile.url; // Assign finalUrl
      finalStorageType = 's3'; // Ensure DB reflects S3 storage

    } else {
      throw new Error(`Unsupported storage type '${storageType}' for upload ${uploadId}.`);
    }

    // 5. Calculate File Hash
    let fileHash: string; // Define fileHash
    if ((finalStorageType === 'local' || finalStorageType === 'filestore') && absoluteDestFilePath) {
        try {
            const finalFileBuffer = await fs.readFile(absoluteDestFilePath);
            fileHash = xxhash64.h64Raw(Buffer.from(finalFileBuffer)).toString(16);
            logger.info(`[ProcessFinished:${uploadId}] Calculated local file hash: ${fileHash}`);
        } catch (hashError) {
            logger.error(`[ProcessFinished:${uploadId}] Failed to calculate hash for local file ${absoluteDestFilePath}:`, hashError);
            fileHash = `error-${uploadId}`; // Fallback hash on error
        }
    } else {
        fileHash = `s3-${uploadId}`;
        logger.info(`[ProcessFinished:${uploadId}] Using placeholder hash for S3 file: ${fileHash}`);
    }

    // --- End of Restored Logic ---

    // 6. Update Database Record (Now uses the variables defined above)
    logger.info(`[ProcessFinished:${uploadId}] Updating database record.`);
    await prisma.uploadedFile.upsert({
        where: { id: uploadId },
        update: {
            status: 'completed',
            path: finalPath,
            url: finalUrl,
            storage: finalStorageType, // Use final storage type
            name: sanitizedFilename, // Update name to sanitized version
            projectId: project.id, // Ensure association is set
            completedAt: new Date(),
        },
        create: {
            id: uploadId,
            name: sanitizedFilename,
            path: finalPath,
            url: finalUrl,
            size: infoPayload.Size,
            mimeType: metadata.filetype || metadata.type || 'application/octet-stream',
            hash: fileHash, // Add the calculated or placeholder hash
            status: 'completed',
            storage: finalStorageType,
            projectId: project.id,
            completedAt: new Date(),
            // createdAt will be set automatically
        }
    });
    logger.info(`[ProcessFinished:${uploadId}] Database record updated/created successfully.`);

    // Use uploadTracker which internally calls telegramBot
    logger.info(`[ProcessFinished:${uploadId}] Triggering completion via uploadTracker.`);
    uploadTracker.completeUpload(uploadId); // Pass only ID, tracker should have details or fetch them

  } catch (error: any) {
    logger.error(`[ProcessFinished:${uploadId}] Error processing finished upload:`, error);
    // Send failure notification
    if (telegramBot) {
      try {
        await telegramBot.sendMessage(
          `🚨 Failed to process completed upload\n` +
          `ID: ${uploadId}\n` +
          `File: ${infoPayload?.MetaData?.filename || 'Unknown'}\n` +
          `Reason: ${error.message}`,
          uploadId // Use uploadId to potentially edit an existing message
        );
        // Clean up the message ID since processing failed definitively here
        await telegramBot.cleanupUploadMessage(uploadId);
      } catch (telegramError) {
        logger.error(`[ProcessFinished:${uploadId}] Failed to send error notification via Telegram:`, telegramError);
      }
    }
    // Update DB status to 'failed' if possible
    try {
        await prisma.uploadedFile.update({
            where: { id: uploadId },
            data: { status: 'failed' } // Only update status
        });
    } catch (dbError) {
        logger.error(`[ProcessFinished:${uploadId}] Failed to update database status to failed:`, dbError);
    }
  }
};
// Ensure no characters or lines exist after this closing brace.
// The large duplicate block of code that was here has been removed.
