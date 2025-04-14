import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client'; // Import Prisma Client
import { logger } from '../utils/logger';
import { getTelegramBot } from '../services/telegram/telegramBot';

// Initialize Prisma Client
const prisma = new PrismaClient();

// Define the expected structure of the hook payload
interface TusHookPayload {
  hookType: 'post-create' | 'post-receive' | 'post-finish' | 'post-terminate';
  uploadId: string;
  size?: number; // Present in post-create, post-receive, post-finish
  offset?: number; // Present in post-receive, post-finish
}

// Define the structure of the .info file (adjust based on actual content)
interface TusInfoFile {
  ID: string;
  Size: number;
  Offset: number;
  MetaData: {
    filename?: string; // Base64 encoded
    filetype?: string; // Base64 encoded
    clientCode?: string; // Base64 encoded
    project?: string; // Base64 encoded
    token?: string; // Base64 encoded
    [key: string]: string | undefined; // Allow other metadata fields
  };
  Storage: {
    Type: string;
    Path: string; // Absolute path to the data file
  };
}

// Helper function to decode base64 metadata values safely
function decodeMetadataValue(encodedValue: string | undefined): string {
  if (!encodedValue) {
    return '';
  }
  try {
    // Decode base64 first
    const base64Decoded = Buffer.from(encodedValue, 'base64').toString('utf-8');
    // Then decode URI component
    return decodeURIComponent(base64Decoded);
  } catch (error) {
    logger.warn(`Failed to decode metadata value (tried base64 then URI): ${encodedValue}`, error);
    // Fallback: Maybe it was only base64 encoded? (Less likely with Uppy's default)
    try {
        return Buffer.from(encodedValue, 'base64').toString('utf-8');
    } catch (innerError) {
        logger.error(`Completely failed to decode metadata value: ${encodedValue}`, innerError);
        return encodedValue; // Return original encoded value as last resort
    }
  }
}


// --- Main Hook Handler ---

export const handleTusHookEvent = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as TusHookPayload;
  const { hookType, uploadId } = payload;

  logger.info(`Received tusd hook event: ${hookType} for upload ID: ${uploadId}`);
  logger.debug('Hook payload:', payload); // Log the full payload for debugging

  // Immediately acknowledge the request to tusd to prevent timeouts
  res.status(200).send({ message: 'Hook received' });

  // --- Get TUSD Data Directory ---
  // This MUST be configured via environment variable in your backend deployment
  const tusdDataDir = process.env.TUSD_DATA_DIR;
  if (!tusdDataDir) {
    logger.error('TUSD_DATA_DIR environment variable is not set. Cannot process hook.');
    return; // Stop processing if the path is unknown
  }

  // --- Process based on hook type (asynchronously) ---
  try {
    // Construct paths (backend needs access to the tusd data volume)
    const infoFilePath = path.join(tusdDataDir, `${uploadId}.info`);
    const dataFilePath = path.join(tusdDataDir, uploadId); // Tusd usually names the data file just by ID
    logger.info(`Data file path constructed: ${dataFilePath}`);

    // Read and parse the .info file (needed for most hooks)
    let infoData: TusInfoFile | null = null;
    let decodedMetadata: Record<string, string> = {};
    logger.info(`[${hookType}:${uploadId}] Attempting to read info file: ${infoFilePath}`);
    try {
      const infoFileContent = await fs.readFile(infoFilePath, 'utf-8');
      logger.info(`[${hookType}:${uploadId}] Successfully read info file.`);
      infoData = JSON.parse(infoFileContent) as TusInfoFile;
      logger.debug(`[${hookType}:${uploadId}] Parsed info file content:`, infoData);

      // Decode metadata
      if (infoData.MetaData) {
        logger.info(`[${hookType}:${uploadId}] Decoding metadata...`);
        for (const key in infoData.MetaData) {
          decodedMetadata[key] = decodeMetadataValue(infoData.MetaData[key]);
        }
        logger.debug(`[${hookType}:${uploadId}] Decoded metadata:`, decodedMetadata);
      } else {
        logger.warn(`[${hookType}:${uploadId}] No MetaData found in info file.`);
      }
    } catch (err) {
      logger.error(`[${hookType}:${uploadId}] Error reading or parsing info file ${infoFilePath}:`, err);
      // Decide how to handle this - maybe proceed without metadata for some hooks?
      // For post-finish, metadata is crucial.
      if (hookType === 'post-finish') {
        logger.error(`Cannot proceed with post-finish for ${uploadId} without info file.`);
        return;
      }
    }

    // Get Telegram Bot instance
    const telegramBot = getTelegramBot();
    if (!telegramBot) {
      logger.warn('Telegram bot not initialized. Skipping notification.');
      // Depending on the hook, you might want to proceed or stop
    }

    // --- Handle specific hook logic ---
    switch (hookType) {
      case 'post-create':
        logger.info(`Handling post-create for ${uploadId}`);
        if (telegramBot && infoData) {
          // Send "Upload Started" notification
          await telegramBot.sendUploadNotification({
            id: uploadId,
            size: infoData.Size || payload.size || 0,
            offset: 0,
            metadata: decodedMetadata,
            isComplete: false,
          });
        }
        break;

      case 'post-receive':
        logger.info(`Handling post-receive for ${uploadId} (Offset: ${payload.offset})`);
        // TODO: Implement throttling logic here if needed (e.g., based on time or percentage)
        if (telegramBot && infoData && payload.offset !== undefined && payload.size !== undefined) {
          // Send "Upload Progress" notification (consider throttling)
          await telegramBot.sendUploadNotification({
            id: uploadId,
            size: infoData.Size || payload.size,
            offset: payload.offset,
            metadata: decodedMetadata,
            isComplete: false,
            // TODO: Calculate upload speed if desired (requires storing previous state)
          });
        }
        break;

      case 'post-finish':
        logger.info(`Handling post-finish for ${uploadId}`);
        if (!infoData || !payload.offset || !payload.size) {
            logger.error(`Missing critical info for post-finish handling of ${uploadId}. Aborting.`);
            return;
        }
        if (payload.offset !== payload.size) {
            logger.error(`Offset (${payload.offset}) does not match size (${payload.size}) in post-finish for ${uploadId}. Aborting file move.`);
            // Optionally send a failure notification
            return;
        }

        // 1. Validate Token & Get Project Info (CRITICAL: Decode token first!)
        const token = decodedMetadata.token;
        logger.info(`[post-finish:${uploadId}] Attempting to validate token: ${token ? token.substring(0, 8) + '...' : 'MISSING'}`);
        if (!token) {
            logger.error(`[post-finish:${uploadId}] Missing token in metadata. Cannot determine destination.`);
            // Optionally send failure notification
            return;
        }

        let clientCode: string | undefined;
        let projectName: string | undefined;
        logger.info(`[post-finish:${uploadId}] Starting token validation via Prisma.`);
        try {
            // --- Real Token Validation Logic ---
            const uploadLink = await prisma.uploadLink.findUnique({
                where: { token: token },
                include: {
                    project: { // Include the related project
                        include: {
                            client: true // Include the related client from the project
                        }
                    }
                }
            });

            if (!uploadLink) {
                throw new Error(`Upload link with token not found.`);
            }

            // Check if the link has expired (assuming an expiresAt field exists)
            if (uploadLink.expiresAt && new Date() > new Date(uploadLink.expiresAt)) {
                 throw new Error(`Upload link has expired.`);
            }

            // Check if project and client data exist
            if (!uploadLink.project) {
                throw new Error(`Project not found for upload link.`);
            }
            if (!uploadLink.project.client) {
                throw new Error(`Client not found for the project associated with the link.`);
            }

            // Extract the required information
            // Use ?? undefined to convert potential null from Prisma to undefined
            clientCode = uploadLink.project.client.code ?? undefined; // Convert null to undefined
            projectName = uploadLink.project.name ?? undefined;      // Convert null to undefined

            if (!clientCode || !projectName) {
                // This check might be redundant if the above checks pass, but good for safety
                throw new Error('Client code or project name could not be determined from the upload link.');
            }
            // --- End Real Token Validation Logic ---

            logger.info(`[post-finish:${uploadId}] Token validation successful. Client: ${clientCode}, Project: ${projectName}`);

        } catch (validationError: any) { // Catch specific error type if possible
            logger.error(`[post-finish:${uploadId}] Token validation or data retrieval failed (Token: ${token}):`, validationError.message);
            // Optionally send failure notification via Telegram
            const telegramBot = getTelegramBot();
            if (telegramBot) {
                await telegramBot.sendMessage(
                    `🚨 Failed to process completed upload ${uploadId}.\n` +
                    `File: ${decodedMetadata.filename || 'Unknown'}\n` +
                    `Reason: Token validation failed - ${validationError.message}`,
                    uploadId // Use uploadId to potentially edit an existing message
                );
                // Clean up the message ID since processing failed
                await telegramBot.cleanupUploadMessage(uploadId);
            }
            return; // Stop processing if token is invalid or data retrieval fails
        }

        // 2. Sanitize Paths (using backend logic)
        logger.info(`[post-finish:${uploadId}] Sanitizing paths for client: ${clientCode}, project: ${projectName}`);
        const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\.\./g, '_');
        const sanitizedClientCode = sanitize(clientCode);
        const sanitizedProjectName = sanitize(projectName);
        const originalFilename = decodedMetadata.filename || uploadId; // Use ID if filename missing
        const sanitizedFilename = sanitize(originalFilename).replace(/[/\\]/g, '_'); // Extra check for slashes

        // 3. Define Destination Paths
        const destinationDir = path.join(tusdDataDir, sanitizedClientCode, sanitizedProjectName);
        const destinationMetadataDir = path.join(destinationDir, '.metadata');
        const destinationFilePath = path.join(destinationDir, sanitizedFilename);
        const destinationInfoPath = path.join(destinationMetadataDir, `${sanitizedFilename}.info`);

        logger.info(`[post-finish:${uploadId}] Calculated paths:`);
        logger.info(`  Source Data: ${dataFilePath}`);
        logger.info(`  Source Info: ${infoFilePath}`);
        logger.info(`  Dest Dir:    ${destinationDir}`);
        logger.info(`  Dest Meta:   ${destinationMetadataDir}`);
        logger.info(`  Dest Data:   ${destinationFilePath}`);
        logger.info(`  Dest Info:   ${destinationInfoPath}`);

        // 4. Create Directories
        logger.info(`[post-finish:${uploadId}] Attempting to create destination directories: ${destinationMetadataDir}`);
        try {
            await fs.mkdir(destinationMetadataDir, { recursive: true });
            logger.info(`[post-finish:${uploadId}] Successfully created/ensured destination directories.`);
        } catch (mkdirError) {
            logger.error(`[post-finish:${uploadId}] Failed to create destination directories:`, mkdirError);
            // Optionally send failure notification
            return;
        }

        // 5. Move Files (Data first, then Info)
        logger.info(`[post-finish:${uploadId}] Attempting to move data file from ${dataFilePath} to ${destinationFilePath}`);
        try {
            await fs.mkdir(destinationDir, { recursive: true }); // Ensure the destination directory exists
            await fs.rename(dataFilePath, destinationFilePath);
            logger.info(`[post-finish:${uploadId}] Successfully moved data file to ${destinationFilePath}.`);

            logger.info(`[post-finish:${uploadId}] Attempting to move info file from ${infoFilePath} to ${destinationInfoPath}`);
            try {
                 await fs.rename(infoFilePath, destinationInfoPath);
                 logger.info(`[post-finish:${uploadId}] Successfully moved info file to ${destinationInfoPath}.`);
            } catch (infoMoveError) {
                 logger.warn(`[post-finish:${uploadId}] Failed to move info file:`, infoMoveError);
                 // Decide if this is critical. Usually, the data file is more important.
            }
        } catch (dataMoveError) {
            logger.error(`[post-finish:${uploadId}] Failed to move data file:`, dataMoveError);
            // Optionally send failure notification
            // Attempt to clean up - remove destination dirs? Difficult to rollback safely.
            return;
        }

        // 6. Send "Upload Complete" Notification
        if (telegramBot) {
          await telegramBot.sendUploadNotification({
            id: uploadId,
            size: infoData.Size,
            offset: infoData.Offset,
            metadata: { ...decodedMetadata, clientName: clientCode, projectName: projectName }, // Add validated info
            isComplete: true,
          });
        }
        logger.info(`[post-finish:${uploadId}] Successfully processed post-finish hook.`);
        break;

      case 'post-terminate':
        logger.info(`Handling post-terminate for ${uploadId}`);
        if (telegramBot && infoData) {
          // Send "Upload Terminated" notification
          // Note: infoData might be incomplete if termination happened early
           await telegramBot.sendMessage(
             `❌ Upload Terminated\n` +
             `File: ${decodedMetadata.filename || 'Unknown'}\n` +
             `Client: ${decodedMetadata.clientCode || 'Unknown'}\n` +
             `Project: ${decodedMetadata.project || 'Unknown'}\n` +
             `ID: ${uploadId}`,
             uploadId // Pass uploadId to potentially edit the existing message
           );
           // Clean up message ID tracking in TelegramBot service
           await telegramBot.cleanupUploadMessage(uploadId); // Call the new public method
        }
        // Optional: Clean up any other state associated with the upload ID
        break;

      default:
        // Log if an unexpected hook type is received
        logger.warn(`Received unknown hook type: ${hookType} for upload ID: ${uploadId}`);
    }
  } catch (error) {
    // Catch any unexpected errors during asynchronous processing
    // Ensure hookType and uploadId are included for context, even if they were undefined earlier
    const currentHookType = payload?.hookType || 'unknown';
    const currentUploadId = payload?.uploadId || 'unknown';
    logger.error(`Unhandled error during asynchronous processing of hook ${currentHookType} for upload ID ${currentUploadId}:`, error);
  }
};
