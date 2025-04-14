import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { getTelegramBot } from '../services/telegram/telegramBot';
// Assuming you have a service to validate the upload link token
// import { validateUploadLink } from '../services/uploadLinkService'; 

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
    // Decode URI component first, then base64
    return Buffer.from(decodeURIComponent(encodedValue), 'base64').toString('utf-8');
  } catch (error) {
    logger.warn(`Failed to decode metadata value: ${encodedValue}`, error);
    // Fallback: try decoding without URI component (if frontend didn't encode it)
    try {
        return Buffer.from(encodedValue, 'base64').toString('utf-8');
    } catch (innerError) {
        logger.error(`Completely failed to decode metadata value: ${encodedValue}`, innerError);
        return ''; // Return empty string on failure
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

    // Read and parse the .info file (needed for most hooks)
    let infoData: TusInfoFile | null = null;
    let decodedMetadata: Record<string, string> = {};
    try {
      const infoFileContent = await fs.readFile(infoFilePath, 'utf-8');
      infoData = JSON.parse(infoFileContent) as TusInfoFile;
      logger.debug(`Parsed info file for ${uploadId}:`, infoData);

      // Decode metadata
      if (infoData.MetaData) {
        for (const key in infoData.MetaData) {
          decodedMetadata[key] = decodeMetadataValue(infoData.MetaData[key]);
        }
        logger.debug(`Decoded metadata for ${uploadId}:`, decodedMetadata);
      }
    } catch (err) {
      logger.error(`Error reading or parsing info file ${infoFilePath}:`, err);
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
        if (!token) {
            logger.error(`Missing token in metadata for completed upload ${uploadId}. Cannot determine destination.`);
            // Optionally send failure notification
            return;
        }

        let clientCode: string | undefined;
        let projectName: string | undefined;
        try {
            // TODO: Replace with actual call to your validation/lookup service
            // const linkInfo = await validateUploadLink(token); // Assumes this function exists
            // clientCode = linkInfo.clientCode;
            // projectName = linkInfo.projectName;

            // Placeholder implementation - REMOVE THIS
            logger.warn(`Placeholder: Simulating token validation for ${token}`);
            clientCode = decodedMetadata.clientCode || 'unknown_client'; // Use metadata as fallback for now
            projectName = decodedMetadata.project || 'unknown_project'; // Use metadata as fallback for now
            if (!clientCode || !projectName) throw new Error('Client code or project name missing');
            // End Placeholder

            logger.info(`Token validated for ${uploadId}. Client: ${clientCode}, Project: ${projectName}`);

        } catch (validationError) {
            logger.error(`Token validation failed for ${uploadId} (Token: ${token}):`, validationError);
            // Optionally send failure notification
            return; // Stop processing if token is invalid
        }

        // 2. Sanitize Paths (using backend logic)
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

        logger.info(`Moving file for ${uploadId}:`);
        logger.info(`  Source Data: ${dataFilePath}`);
        logger.info(`  Source Info: ${infoFilePath}`);
        logger.info(`  Dest Data:   ${destinationFilePath}`);
        logger.info(`  Dest Info:   ${destinationInfoPath}`);

        // 4. Create Directories
        try {
            await fs.mkdir(destinationMetadataDir, { recursive: true });
            logger.info(`Created destination directories: ${destinationMetadataDir}`);
        } catch (mkdirError) {
            logger.error(`Failed to create destination directories for ${uploadId}:`, mkdirError);
            // Optionally send failure notification
            return;
        }

        // 5. Move Files (Data first, then Info)
        try {
            await fs.rename(dataFilePath, destinationFilePath);
            logger.info(`Successfully moved data file for ${uploadId}`);
            try {
                 await fs.rename(infoFilePath, destinationInfoPath);
                 logger.info(`Successfully moved info file for ${uploadId}`);
            } catch (infoMoveError) {
                 logger.warn(`Failed to move info file for ${uploadId}:`, infoMoveError);
                 // Decide if this is critical. Usually, the data file is more important.
            }
        } catch (dataMoveError) {
            logger.error(`Failed to move data file for ${uploadId}:`, dataMoveError);
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
        logger.info(`Successfully processed post-finish for ${uploadId}`);
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
           await telegramBot.deleteMessageId(uploadId);
        }
        // Optional: Clean up any other state associated with the upload ID
        break;

      default:
        // Log if an unexpected hook type is received
        logger.warn(`Received unknown hook type: ${hookType} for upload ID: ${uploadId}`);
    }
  } catch (error) {
    // Catch any unexpected errors during asynchronous processing
    logger.error(`Unhandled error processing hook ${hookType} for upload ID ${uploadId}:`, error);
  }
};
