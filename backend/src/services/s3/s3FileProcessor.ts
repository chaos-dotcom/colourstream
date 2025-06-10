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
   * Process a hook event from tusd
   * @param hook - The hook event from tusd
   * @returns Promise<boolean> - Whether the processing was successful
   */
  async processHook(hook: any): Promise<boolean> {
    const { id: fileId, token } = hook.upload.metadata;
    try {
      logger.info(`Processing hook type '${hook.type}' for uploadId: ${fileId}`);
      
      // Process different hook types
      switch (hook.type) {
        case 'post-create':
          logger.info(`[Hook Progress - created] Received: uploadId=${fileId}, token=${token}, filename=${hook.upload.metadata.filename}, size=${hook.upload.size}`);
          await this.handlePostCreate(fileId, hook.upload);
          break;

        case 'post-receive':
          await this.handlePostReceive(fileId, hook.upload);
          break;

        case 'post-complete':
          await this.handlePostComplete(fileId, hook.upload);
          break;

        case 'post-terminate':
          logger.info(`[Hook Progress] Handling termination for upload ${fileId}`);
          await this.handlePostTerminate(fileId, hook.upload);
          break;

        default:
          logger.warn(`[Hook Progress] Received unknown hook type '${hook.type}' for uploadId: ${fileId}`);
          break;
      }

      return true;
    } catch (error) {
      logger.error(`Error processing hook for file ${fileId}:`, error);
      return false;
    }
  }

  private async handlePostCreate(uploadId: string, payload: any) {
    logger.info(`[Hook Progress - created] Handling create for upload ${uploadId}`);
    // Implementation for post-create hook
  }

  private async handlePostReceive(uploadId: string, payload: any) {
    logger.info(`[Hook Progress] Handling receive for upload ${uploadId}`);
    // Implementation for post-receive hook
  }

  private async handlePostComplete(uploadId: string, payload: any) {
    logger.info(`[Hook Progress - complete] Handling completion for upload ${uploadId}`);
    // Implementation for post-complete hook
  }

  private async handlePostTerminate(uploadId: string, payload: any) {
    logger.info(`[Hook Progress] Handling termination for upload ${uploadId}`);
    // Trigger termination notification
    await this.telegramBot?.sendUploadNotification({
      id: uploadId,
      size: payload.size,
      offset: payload.offset,
      metadata: payload.metadata,
      terminated: true
    }, 'post-terminate');
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
