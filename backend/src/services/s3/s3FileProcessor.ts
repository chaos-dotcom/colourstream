import { PrismaClient } from '@prisma/client';
import { s3Service } from './s3Service';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * S3 File Processor
 * Handles post-upload processing of files in S3:
 * - Strips UUIDs from filenames
 * - Organizes files into client/project structure
 * - Updates database records with new paths
 */
export class S3FileProcessor {
  /**
   * Process a file after upload
   * @param fileId - The ID of the uploaded file in the database
   * @param token - The upload token used for the upload
   * @returns Promise<boolean> - Whether the processing was successful
   */
  async processFile(fileId: string, token: string): Promise<boolean> {
    try {
      logger.info(`Processing file ${fileId} with token ${token}`);
      
      // Get the file record from the database
      const file = await prisma.uploadedFile.findUnique({
        where: { id: fileId },
        include: {
          project: {
            include: {
              client: true
            }
          }
        }
      });

      if (!file) {
        logger.error(`File ${fileId} not found in database`);
        return false;
      }

      // If the file is not stored in S3, skip processing
      if (file.storage !== 's3') {
        logger.info(`File ${fileId} is not stored in S3, skipping processing`);
        return false;
      }

      // Extract the current S3 key from the file path
      const currentKey = file.path;
      
      // Check if the key already follows the client/project/filename pattern
      // This regex matches paths like "CLIENT/PROJECT/FILENAME.EXT"
      const correctPatternRegex = /^[^\/]+\/[^\/]+\/[^\/]+$/;
      if (currentKey && correctPatternRegex.test(currentKey)) {
        logger.info(`File ${fileId} already has the correct pattern: ${currentKey}`);
        return true;
      }
      // Extract the filename from the current key (last part after the last slash)
      if (!currentKey) {
        logger.error(`File ${fileId} has no path`);
        return false;
      }
      const currentFilename = currentKey.split('/').pop() || 'unknown';
      
      // Check if the filename contains a UUID pattern
      // This regex matches UUIDs in formats like:
      // - f53671c2-f356-417a-b14e-1c1b6476d723-Protape-Ltd-t-a-DataStores-50879.pdf
      // - prefix-uuid-filename.ext or uuid-filename.ext
      const uuidRegex = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-)/gi;
      
      // Clean the filename by removing UUIDs
      const cleanFilename = currentFilename.replace(uuidRegex, '');
      
      // Generate the new key using the client/project/filename structure
      const clientCode = file.project.client.code || 'default';
      const projectName = file.project.name || 'default';
      const newKey = s3Service.generateKey(clientCode, projectName, cleanFilename);
      
      // If the key hasn't changed, no need to rename
      if (currentKey === newKey) {
        logger.info(`File ${fileId} already has the correct key: ${currentKey}`);
        return true;
      }
      
      logger.info(`Renaming file ${fileId} from ${currentKey} to ${newKey}`);
      
      try {
        // Check if the file exists in S3 before attempting to rename it
        logger.info(`Checking if file ${fileId} exists at path ${currentKey} in S3`);
        let fileExists = false;
        
        try {
          fileExists = await s3Service.fileExists(currentKey);
          logger.info(`File exists check result for ${currentKey}: ${fileExists}`);
        } catch (error) {
          logger.error(`Error checking if file exists at ${currentKey}:`, error);
          fileExists = false;
        }
        
        if (fileExists) {
          logger.info(`File ${fileId} exists at path ${currentKey}, renaming to ${newKey}`);
          // Rename the file in S3
          const newUrl = await s3Service.renameObject(currentKey, newKey);
          
          // Update the file record in the database
          await prisma.uploadedFile.update({
            where: { id: fileId },
            data: {
              path: newKey,
              name: cleanFilename,
              url: newUrl
            }
          });
          
          logger.info(`Successfully processed file ${fileId}, new path: ${newKey}`);
          return true;
        } else {
          logger.warn(`File ${fileId} does not exist at path ${currentKey} in S3, updating database only`);
          
          // Update the database record without renaming the file in S3
          const s3Endpoint = process.env.S3_PUBLIC_ENDPOINT || 'https://s3.colourstream.johnrogerscolour.co.uk';
          const bucket = s3Service.getBucket();
          const newUrl = `${s3Endpoint}/${bucket}/${newKey}`;
          
          logger.info(`Generated new URL for file ${fileId}: ${newUrl}`);
          
          await prisma.uploadedFile.update({
            where: { id: fileId },
            data: {
              path: newKey,
              name: cleanFilename,
              url: newUrl
            }
          });
          
          logger.info(`Updated database record for file ${fileId}, new path: ${newKey}`);
          return true;
        }
      } catch (error) {
        logger.error(`Error processing file ${fileId}:`, error);
        return false;
      }
      
      // This code is replaced by the block above
    } catch (error) {
      logger.error(`Error processing file ${fileId}:`, error);
      return false;
    }
  }

  /**
   * Process all S3 files in the database
   * @returns Promise<number> - The number of files processed
   */
  async processAllFiles(): Promise<number> {
    try {
      logger.info('Processing all S3 files in the database');
      
      // Get all files stored in S3
      const files = await prisma.uploadedFile.findMany({
        where: { storage: 's3' },
        include: {
          project: {
            include: {
              client: true
            }
          }
        }
      });
      
      // Process each file
      let processedCount = 0;
      for (const file of files) {
        // Extract the current S3 key from the file path
        const currentKey = file.path;
        
        // Check if the key already follows the client/project/filename pattern
        const correctPatternRegex = /^[^\/]+\/[^\/]+\/[^\/]+$/;
        if (!currentKey || correctPatternRegex.test(currentKey)) {
          continue; // Skip files that already have the correct pattern or have no path
        }
        
        // Extract the filename from the current key (last part after the last slash)
        if (!currentKey) {
          logger.error(`File ${file.id} has no path`);
          continue;
        }
        const currentFilename = currentKey.split('/').pop() || 'unknown';
        
        // Check if the filename contains a UUID pattern
        // This regex matches UUIDs in formats like:
        // - f53671c2-f356-417a-b14e-1c1b6476d723-Protape-Ltd-t-a-DataStores-50879.pdf
        // - prefix-uuid-filename.ext or uuid-filename.ext
        const uuidRegex = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-)/gi;
        
        // Clean the filename by removing UUIDs
        const cleanFilename = currentFilename.replace(uuidRegex, '');
        
        // Generate the new key using the client/project/filename structure
        const clientCode = file.project.client.code || 'default';
        const projectName = file.project.name || 'default';
        const newKey = s3Service.generateKey(clientCode, projectName, cleanFilename);
        
        // If the key hasn't changed, no need to rename
        if (currentKey === newKey) {
          continue;
        }
        
        try {
          logger.info(`Renaming file ${file.id} from ${currentKey} to ${newKey}`);
          
          // Check if the file exists in S3 before attempting to rename it
          logger.info(`Checking if file ${file.id} exists at path ${currentKey} in S3`);
          let fileExists = false;
          
          try {
            fileExists = await s3Service.fileExists(currentKey);
            logger.info(`File exists check result for ${currentKey}: ${fileExists}`);
          } catch (error) {
            logger.error(`Error checking if file exists at ${currentKey}:`, error);
            fileExists = false;
          }
          
          if (fileExists) {
            logger.info(`File ${file.id} exists at path ${currentKey}, renaming to ${newKey}`);
            // Rename the file in S3
            const newUrl = await s3Service.renameObject(currentKey, newKey);
            
            // Update the file record in the database
            await prisma.uploadedFile.update({
              where: { id: file.id },
              data: {
                path: newKey,
                name: cleanFilename,
                url: newUrl
              }
            });
            
            processedCount++;
            logger.info(`Successfully processed file ${file.id}, new path: ${newKey}`);
          } else {
            logger.warn(`File ${file.id} does not exist at path ${currentKey} in S3, updating database only`);
            
            // Update the database record without renaming the file in S3
            const s3Endpoint = process.env.S3_PUBLIC_ENDPOINT || 'https://s3.colourstream.johnrogerscolour.co.uk';
            const bucket = s3Service.getBucket();
            const newUrl = `${s3Endpoint}/${bucket}/${newKey}`;
            
            await prisma.uploadedFile.update({
              where: { id: file.id },
              data: {
                path: newKey,
                name: cleanFilename,
                url: newUrl
              }
            });
            
            processedCount++;
            logger.info(`Updated database record for file ${file.id}, new path: ${newKey}`);
          }
        } catch (error) {
          logger.error(`Error processing file ${file.id}:`, error);
          // Continue with other files even if one fails
        }
      }
      
      logger.info(`Processed ${processedCount} files out of ${files.length} total S3 files`);
      return processedCount;
    } catch (error) {
      logger.error('Error processing all files:', error);
      return 0;
    }
  }
}

// Create a singleton instance
export const s3FileProcessor = new S3FileProcessor();
