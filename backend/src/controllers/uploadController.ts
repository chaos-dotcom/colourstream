/* eslint-disable @typescript-eslint/no-unused-vars */ // Remove if using the commented out handlers
import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client'; // Removed unused UploadedFile type
import xxhash from 'xxhash-wasm'; // Import xxhash
import { logger } from '../utils/logger';
import { getTelegramBot } from '../services/telegram/telegramBot';
import { s3FileProcessor } from '../services/s3/s3FileProcessor'; // Import S3 processor if needed

// Initialize Prisma Client
const prisma = new PrismaClient();
// Initialize xxhash
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

// Helper function to sanitize strings for use in file paths
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


// --- New Main Handler for Post-Finish Hook ---

export const handleProcessFinishedUpload = async (req: Request, res: Response): Promise<void> => {
  const infoPayload = req.body as TusInfoFilePayload;
  const uploadId = infoPayload?.ID;

  // Immediately acknowledge the request to the hook script
  res.status(200).send({ message: 'Received finished upload payload.' });

  logger.info(`[ProcessFinished:${uploadId}] Received finished upload payload.`);
  logger.debug(`[ProcessFinished:${uploadId}] Payload:`, infoPayload);

  // --- Basic Payload Validation ---
  if (!uploadId || !infoPayload.MetaData?.token || !infoPayload.Storage?.Path || !infoPayload.Storage?.InfoPath || !infoPayload.Storage?.Type) {
    logger.error(`[ProcessFinished:${uploadId}] Invalid or incomplete payload received from hook. Missing ID, token, storage paths, or type.`);
    // Optionally send failure notification
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
    // 1. Decode Metadata (if necessary - check actual .info file content)
    // Assuming metadata in the received JSON is already decoded for now.
    // If not, uncomment and use decodeMetadataValue:
    // const decodedMetadata: Record<string, string> = {};
    // for (const key in infoPayload.MetaData) {
    //   decodedMetadata[key] = decodeMetadataValue(infoPayload.MetaData[key]);
    // }
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

    const client = uploadLink.project.client;
    const project = uploadLink.project;
    const clientCode = client.code;
    const projectName = project.name;

    if (!clientCode || !projectName) throw new Error('Client code or project name could not be determined.');

    logger.info(`[ProcessFinished:${uploadId}] Token valid. Client: ${clientCode}, Project: ${projectName}`);

    // 3. Prepare File Info
    const originalFilename = metadata.filename || metadata.name || uploadId; // Fallback to ID
    const sanitizedClientCode = sanitizePathString(clientCode);
    const sanitizedProjectName = sanitizePathString(projectName);
    const sanitizedFilename = sanitizePathString(originalFilename);

    const sourceDataPath = infoPayload.Storage.Path;
    const sourceInfoPath = infoPayload.Storage.InfoPath;
    const storageType = infoPayload.Storage.Type;

    let finalPath: string;
    let finalUrl: string | null = null;
    let finalStorageType = storageType; // May change if moved from local to S3 later
    let absoluteDestFilePath: string | undefined = undefined; // Declare here

    // 4. Process based on Storage Type
    if (storageType === 'filestore') {
      logger.info(`[ProcessFinished:${uploadId}] Processing filestore upload.`);

      // Define Destination Paths (relative to tusdDataDir for consistency)
      const relativeDestDir = path.join(sanitizedClientCode, sanitizedProjectName);
      const relativeDestMetadataDir = path.join(relativeDestDir, '.metadata');
      const relativeDestFilePath = path.join(relativeDestDir, sanitizedFilename);
      const relativeDestInfoPath = path.join(relativeDestMetadataDir, `${sanitizedFilename}.info`);

      // Absolute paths for file operations
      // const absoluteDestDir = path.join(tusdDataDir, relativeDestDir); // Unused variable removed
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
        // Attempt to delete original info file if move failed? Or leave it? Leaving it for now.
      }

      // Set final path for DB (relative path is often more portable)
      finalPath = relativeDestFilePath;
      // Construct URL if applicable (depends on how files are served)
      // finalUrl = `http://your-file-server/${finalPath}`; // Example

    } else if (storageType === 's3store') {
      logger.info(`[ProcessFinished:${uploadId}] Processing s3store upload.`);
      // Tusd's s3store might put the file directly in the final location,
      // or it might use a temporary location based on upload ID.
      // The `infoPayload.Storage.Path` likely contains the S3 key.

      // We might still want to run our S3 processor to ensure consistency,
      // update metadata, or move from a temp location if tusd used one.
      // Assuming s3FileProcessor handles finding the file by ID/token and organizing it.
      // We need to pass the necessary info.

      // TODO: Adapt this call based on how s3FileProcessor works.
      // It might need the upload ID and token, or the S3 key from infoPayload.Storage.Path.
      if (!token) { // Ensure token exists before processing S3
          throw new Error(`Token is missing, cannot process S3 upload for ${uploadId}.`);
      }
      const s3Processed = await s3FileProcessor.processFile(uploadId, token);

      if (!s3Processed) {
        throw new Error(`S3 file processing failed for upload ${uploadId}.`);
      }

      // s3FileProcessor should update the DB record, retrieve the final path/URL
      const updatedFile = await prisma.uploadedFile.findUnique({ where: { id: uploadId } });
      if (!updatedFile || !updatedFile.path) {
          throw new Error(`Failed to retrieve updated file details from DB after S3 processing for ${uploadId}.`);
      }
      finalPath = updatedFile.path;
      finalUrl = updatedFile.url;
      finalStorageType = 's3'; // Ensure DB reflects S3 storage

    } else {
      throw new Error(`Unsupported storage type '${storageType}' for upload ${uploadId}.`);
    }

    // 5. Calculate File Hash
    let fileHash: string;
    // Only calculate hash from file if it's local and the path exists
    if ((finalStorageType === 'local' || finalStorageType === 'filestore') && absoluteDestFilePath) {
        try {
            const finalFileBuffer = await fs.readFile(absoluteDestFilePath); // Read the final local file
            fileHash = xxhash64.h64Raw(Buffer.from(finalFileBuffer)).toString(16);
            logger.info(`[ProcessFinished:${uploadId}] Calculated local file hash: ${fileHash}`);
        } catch (hashError) {
            logger.error(`[ProcessFinished:${uploadId}] Failed to calculate hash for local file ${absoluteDestFilePath}:`, hashError);
            fileHash = `error-${uploadId}`; // Fallback hash on error
        }
    } else { // For S3 or if local path is somehow missing
        // Placeholder hash for S3 files as content isn't read here
        fileHash = `s3-${uploadId}`;
        logger.info(`[ProcessFinished:${uploadId}] Using placeholder hash for S3 file: ${fileHash}`);
    }


    // 6. Update Database Record
    logger.info(`[ProcessFinished:${uploadId}] Updating database record.`);
    await prisma.uploadedFile.upsert({ // Remove unused variable assignment
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


    // 7. Send "Upload Complete" Notification
    if (telegramBot) {
      logger.info(`[ProcessFinished:${uploadId}] Sending completion notification.`);
      await telegramBot.sendUploadNotification({
        id: uploadId,
        size: infoPayload.Size,
        offset: infoPayload.Offset, // Should equal Size
        metadata: { // Pass relevant final metadata
            filename: sanitizedFilename,
            clientName: clientCode,
            projectName: projectName,
            filetype: metadata.filetype || metadata.type || 'unknown', // Provide default for filetype
            // Add other relevant metadata from 'metadata' object if needed
        },
        isComplete: true,
        storage: finalStorageType, // Pass final storage type
      });
    }

    logger.info(`[ProcessFinished:${uploadId}] Successfully processed finished upload.`);

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
            // data: { status: 'failed', failureReason: error.message } // Removed - 'failureReason' field likely doesn't exist
            data: { status: 'failed' } // Only update status
        });
    } catch (dbError) {
        logger.error(`[ProcessFinished:${uploadId}] Failed to update database status to failed:`, dbError);
    }
  }
};

export const handleProcessFinishedUpload = async (req: Request, res: Response): Promise<void> => {
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
  // Only critical if processing 'filestore' type
  if (infoPayload.Storage.Type === 'filestore' && !tusdDataDir) {
    logger.error(`[ProcessFinished:${uploadId}] TUSD_DATA_DIR environment variable is not set. Cannot process filestore. Leaving original file untouched.`);
    return; // Stop processing
  }

  const telegramBot = getTelegramBot(); // Get bot instance

  // --- Process Upload Asynchronously ---
  try {
    const token = infoPayload.MetaData.token; // Already checked for existence
    const uploadLink = await prisma.uploadLink.findUnique({
      where: { token: token },
      include: {
        project: { include: { client: true } }
      }
    });

    // SAFEGUARD: Invalid token
    if (!uploadLink) {
      logger.error(`[ProcessFinished:${uploadId}] Invalid token validation failed. Token: ${token ? token.substring(0, 8) + '...' : 'MISSING'}. Leaving original file untouched.`);
      return; // Stop processing, respond OK already sent
    }
    if (uploadLink.expiresAt && new Date() > new Date(uploadLink.expiresAt)) throw new Error(`Upload link has expired.`);
    if (!uploadLink.project) throw new Error(`Project not found for upload link.`);
    if (!uploadLink.project.client) throw new Error(`Client not found for the project.`);

    const client = uploadLink.project.client;
    const project = uploadLink.project;
    const clientCode = client.code;
    const projectName = project.name;

    if (!clientCode || !projectName) throw new Error('Client code or project name could not be determined.');

    logger.info(`[ProcessFinished:${uploadId}] Token valid. Client: ${clientCode}, Project: ${projectName}`);

    // 3. Prepare File Info
    const originalFilename = infoPayload.MetaData.filename || uploadId; // Fallback to ID
    const sanitizedClientCode = sanitizePathString(clientCode);
    const sanitizedProjectName = sanitizePathString(projectName);
    const sanitizedFilename = sanitizePathString(originalFilename);

    const sourceDataPath = infoPayload.Storage.Path;
    const sourceInfoPath = infoPayload.Storage.InfoPath;
    const storageType = infoPayload.Storage.Type;

    let finalPath: string;
    let finalUrl: string | null = null;
    let finalStorageType = storageType; // May change if moved from local to S3 later
    let absoluteDestFilePath: string | undefined = undefined; // Declare here

    // 4. Process based on Storage Type
    if (storageType === 'filestore') {
      logger.info(`[ProcessFinished:${uploadId}] Processing filestore upload.`);
      // Re-check TUSD_DATA_DIR now that we know it's filestore
      if (!tusdDataDir) {
        logger.error(`[ProcessFinished:${uploadId}] TUSD_DATA_DIR environment variable is not set. Cannot process filestore. Leaving original file untouched.`);
        return; // Stop processing
      }

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
      try {
          await fs.mkdir(absoluteDestMetadataDir, { recursive: true });
      } catch (mkdirError) {
          // SAFEGUARD: Directory creation failed
          logger.error(`[ProcessFinished:${uploadId}] Failed to create destination directory ${absoluteDestMetadataDir}:`, mkdirError);
          logger.error(`[ProcessFinished:${uploadId}] Leaving original file untouched: ${sourceDataPath}`);
          return; // Stop processing
      }

      // Move Files (Data first, then Info)
      logger.info(`[ProcessFinished:${uploadId}] Moving data file from ${sourceDataPath} to ${absoluteDestFilePath}`);
      try {
          await fs.rename(sourceDataPath, absoluteDestFilePath);
      } catch (moveError) {
          // SAFEGUARD: File move failed
          logger.error(`[ProcessFinished:${uploadId}] Failed to move data file ${sourceDataPath} to ${absoluteDestFilePath}:`, moveError);
          logger.error(`[ProcessFinished:${uploadId}] Leaving original file untouched.`);
          return; // Stop processing
      }
      logger.info(`[ProcessFinished:${uploadId}] Successfully moved data file.`);

      logger.info(`[ProcessFinished:${uploadId}] Moving info file from ${sourceInfoPath} to ${absoluteDestInfoPath}`);
      try {
        await fs.rename(sourceInfoPath, absoluteDestInfoPath);
        logger.info(`[ProcessFinished:${uploadId}] Successfully moved info file.`);
      } catch (infoMoveError) {
        // SAFEGUARD: Info file move failed (non-critical)
        logger.warn(`[ProcessFinished:${uploadId}] Failed to move info file (non-critical):`, infoMoveError);
        // Attempt to delete original info file if move failed? Or leave it? Leaving it for now.
      }

      // Set final path for DB (relative path is often more portable)
      finalPath = relativeDestFilePath;

    } else if (storageType === 's3store') {
      logger.info(`[ProcessFinished:${uploadId}] Processing s3store upload.`);
      // SAFEGUARD: S3 processing is complex. s3FileProcessor needs its own safeguards.
      // Tusd's s3store might put the file directly in the final location,
      // or it might use a temporary location based on upload ID.
      // The `infoPayload.Storage.Path` likely contains the S3 key.

      const s3Processed = await s3FileProcessor.processFile(uploadId, token);

      if (!s3Processed) {
        // SAFEGUARD: S3 processing failed
        logger.error(`[ProcessFinished:${uploadId}] S3 file processing failed. Check s3FileProcessor logs. Depending on its implementation, the file might be in S3 but not organized/recorded correctly.`);
        // Update DB status to failed?
        await prisma.uploadedFile.update({ where: { id: uploadId }, data: { status: 'failed' } }).catch(dbErr => logger.error(`[ProcessFinished:${uploadId}] Failed to update DB status after S3 processing failure:`, dbErr));
        return; // Stop processing
      }

      // s3FileProcessor should update the DB record, retrieve the final path/URL
      const updatedFile = await prisma.uploadedFile.findUnique({ where: { id: uploadId } });
      if (!updatedFile || !updatedFile.path) { // Check if DB record was updated by processor
          logger.error(`[ProcessFinished:${uploadId}] Failed to retrieve updated file details from DB after S3 processing for ${uploadId}.`);
          return; // Stop processing
      }
      finalPath = updatedFile.path;
      finalUrl = updatedFile.url;
      finalStorageType = 's3'; // Ensure DB reflects S3 storage

    } else {
      // SAFEGUARD: Unsupported storage type
      logger.error(`[ProcessFinished:${uploadId}] Unsupported storage type '${storageType}'. Leaving original file untouched.`);
      return; // Stop processing
    }

    // 5. Calculate File Hash
    let fileHash: string;
    // Only calculate hash from file if it's local and the path exists
    if ((finalStorageType === 'local' || finalStorageType === 'filestore') && absoluteDestFilePath) {
        try {
            const finalFileBuffer = await fs.readFile(absoluteDestFilePath); // Read the final local file
            fileHash = xxhash64.h64Raw(Buffer.from(finalFileBuffer)).toString(16);
            logger.info(`[ProcessFinished:${uploadId}] Calculated local file hash: ${fileHash}`);
        } catch (hashError) {
            // SAFEGUARD: Hash calculation failed (non-critical)
            logger.error(`[ProcessFinished:${uploadId}] Failed to calculate hash for local file ${absoluteDestFilePath}:`, hashError);
            fileHash = `error-${uploadId}`; // Fallback hash on error
        }
    } else { // For S3 or if local path is somehow missing
        // Placeholder hash for S3 files as content isn't read here
        fileHash = `s3-${uploadId}`;
        logger.info(`[ProcessFinished:${uploadId}] Using placeholder hash for S3 file: ${fileHash}`);
    }

    // 6. Update Database Record
    logger.info(`[ProcessFinished:${uploadId}] Updating database record.`);
    try {
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
                hash: fileHash, // Ensure hash is updated
                size: infoPayload.Size, // Ensure size is updated
                mimeType: metadata.filetype || metadata.type || 'application/octet-stream', // Ensure mimeType is updated
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
    } catch (dbError) {
        // SAFEGUARD: DB update failed
        logger.error(`[ProcessFinished:${uploadId}] Failed to update database record:`, dbError);
        logger.error(`[ProcessFinished:${uploadId}] File was moved to ${finalPath}, but DB state is inconsistent.`);
        // Consider sending an admin alert here
        return; // Stop processing before notification
    }

    // Use uploadTracker which internally calls telegramBot
    logger.info(`[ProcessFinished:${uploadId}] Triggering completion via uploadTracker.`);
    uploadTracker.completeUpload(uploadId); // Pass only ID, tracker should have details or fetch them
};
