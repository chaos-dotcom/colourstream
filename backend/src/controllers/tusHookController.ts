import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger'; // Assuming you have a logger utility

// Define the expected structure of the Tusd hook payload (post-finish)
interface TusdHookPayload {
  Upload: {
    ID: string;
    Size: number;
    Offset: number;
    IsFinal: boolean;
    MetaData: {
      clientCode?: string; // Ensure these match the metadata keys sent by Uppy
      filename?: string;
      project?: string;
      filetype?: string; // Example, add others if needed
      [key: string]: string | undefined;
    };
    Storage: {
      Path: string; // Absolute path within the tusd container
      Type: string;
    };
  };
  HTTPRequest: {
    Method: string;
    URI: string;
    RemoteAddr: string;
    Header: Record<string, string[]>;
  };
}

// Base path where tusd data volume is mounted inside the backend container
const TUSD_DATA_MOUNT_PATH = '/tusd-data-external'; // Must match the volume mount in docker-compose

export const handleTusPostFinishHook = async (req: Request, res: Response): Promise<void> => {
  logger.info('Received Tusd post-finish hook');
  logger.debug('Hook Body:', req.body);

  const payload = req.body as TusdHookPayload;

  try {
    // Validate payload structure
    if (!payload?.Upload?.ID || !payload?.Upload?.MetaData || !payload?.Upload?.Storage?.Path) {
      logger.error('Invalid Tusd hook payload structure:', payload);
      res.status(400).send('Invalid hook payload');
      return;
    }

    const { ID: uploadId, MetaData: metadata, Storage: storage } = payload.Upload;
    const clientCode = metadata.clientCode;
    const projectName = metadata.project;
    const originalFilename = metadata.filename; // Get original filename from metadata

    // Validate required metadata
    if (!clientCode || !projectName || !originalFilename) {
      logger.error(`Missing required metadata for upload ${uploadId}: clientCode=${clientCode}, projectName=${projectName}, originalFilename=${originalFilename}`);
      // Respond 200 OK to tusd even if we can't process, to avoid tusd retries
      res.status(200).send('Hook processed (metadata missing, file not moved)');
      return;
    }

    // Tusd's Storage.Path is absolute inside its container. We need the filename part.
    const sourceFilename = path.basename(storage.Path); // This should be the Upload ID
    const sourceFilePath = path.join(TUSD_DATA_MOUNT_PATH, sourceFilename);
    const sourceInfoPath = path.join(TUSD_DATA_MOUNT_PATH, `${sourceFilename}.info`);

    // Sanitize components before joining - basic sanitization
    const sanitizedClientCode = clientCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    // More robust filename sanitization might be needed depending on expected inputs
    const sanitizedFilename = originalFilename.replace(/[\/\\]/g, '_'); // Replace slashes

    const destinationDir = path.join(TUSD_DATA_MOUNT_PATH, sanitizedClientCode, sanitizedProjectName);
    const destinationFilePath = path.join(destinationDir, sanitizedFilename);
    // Also rename the info file to match the original filename for consistency
    const destinationInfoPath = path.join(destinationDir, `${sanitizedFilename}.info`);

    logger.info(`Processing upload ${uploadId}:`);
    logger.info(`  Source File: ${sourceFilePath}`);
    logger.info(`  Source Info: ${sourceInfoPath}`);
    logger.info(`  Destination Dir: ${destinationDir}`);
    logger.info(`  Destination File: ${destinationFilePath}`);
    logger.info(`  Destination Info: ${destinationInfoPath}`);

    // Ensure destination directory exists
    await fs.mkdir(destinationDir, { recursive: true });
    logger.info(`Ensured directory exists: ${destinationDir}`);

    // Check if source files exist before attempting rename
    try {
      await fs.access(sourceFilePath);
      logger.debug(`Source file exists: ${sourceFilePath}`);
      await fs.access(sourceInfoPath);
      logger.debug(`Source info file exists: ${sourceInfoPath}`);
    } catch (accessError) {
      logger.error(`Source file or info file not found for upload ${uploadId}:`, accessError);
      res.status(200).send('Hook processed (source file not found)');
      return;
    }

    // Rename/Move the main data file
    try {
      await fs.rename(sourceFilePath, destinationFilePath);
      logger.info(`Moved file ${sourceFilename} to ${destinationFilePath}`);
    } catch (renameError) {
      logger.error(`Failed to move file ${sourceFilename} to ${destinationFilePath}:`, renameError);
      // Attempt to copy as a fallback? Or just report error? For now, report error.
      res.status(500).send('Failed to move upload file');
      return; // Stop processing if file move fails
    }

    // Rename/Move the info file
    try {
      await fs.rename(sourceInfoPath, destinationInfoPath);
      logger.info(`Moved info file ${sourceFilename}.info to ${destinationInfoPath}`);
    } catch (renameInfoError) {
      // Log a warning but don't fail the hook entirely if only the info file move fails
      logger.warn(`Failed to move info file ${sourceFilename}.info to ${destinationInfoPath}:`, renameInfoError);
    }

    // Respond 200 OK to tusd to acknowledge successful processing
    res.status(200).send('Hook processed successfully');

  } catch (error) {
    logger.error('Error processing Tusd post-finish hook:', error);
    // Respond 500 Internal Server Error to tusd, it might retry
    res.status(500).send('Internal server error processing hook');
  }
};
