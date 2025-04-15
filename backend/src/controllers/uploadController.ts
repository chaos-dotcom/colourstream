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
    // ... (remaining code)
    // 6. Update Database Record
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
