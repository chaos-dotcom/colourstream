import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand, 
  CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, 
  AbortMultipartUploadCommand, CompletedPart, CopyObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { logger } from '../../utils/logger';
import { URL } from 'url'; // Import URL for parsing

// Initialize S3 client with MinIO configuration
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
  // forcePathStyle: true, // Ensure this is commented out or false
});

// Log S3 client configuration on startup
logger.info('S3 Client Initialized:', {
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
  bucket: process.env.S3_BUCKET || 'uploads',
  // Explicitly log if forcePathStyle is somehow active (it shouldn't be)
  forcePathStyle: (s3Client.config as any).forcePathStyle ?? false 
});


const bucket = process.env.S3_BUCKET || 'uploads';

// Export the bucket name for use in other modules
export const s3Bucket = bucket;

export const s3Service = {
  /**
   * Get the bucket name
   * @returns {string} - The S3 bucket name
   */
  getBucket(): string {
    return bucket;
  },

  /**
   * Generate a presigned URL for direct upload to S3
   * @param {string} key - The key (path) to store the file in S3
   * @param {number} expiresIn - The number of seconds until the presigned URL expires (default: 3600)
   * @returns {Promise<string>} - The presigned URL for uploading
   */
  async generatePresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      // Ensure the key provided follows the 'client/project/filename' structure.
      // The caller is responsible for generating the correct key using `generateKey`.
      logger.debug(`Generating presigned URL for S3 key: ${key}`);
      
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key, // Use the provided key directly
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn });
      logger.info(`Generated raw presigned URL for S3 key: ${key}`);
      
      // Replace internal endpoint with external one using the helper function
      const externalUrl = replaceS3Endpoint(url);
      logger.info(`Final presigned URL: ${externalUrl}`);
      
      return externalUrl;
    } catch (error) {
      logger.error('Error generating presigned URL:', error);
      throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Create a multipart upload
   * @param {string} key - The key (path) to store the file in S3
   * @param {string} filename - The original filename
   * @returns {Promise<{uploadId: string, key: string}>} - The upload ID and key for the multipart upload
   */
  async createMultipartUpload(key: string, filename: string): Promise<{uploadId: string, key: string}> {
    try {
      // Ensure the key provided follows the 'client/project/filename' structure.
      // The caller is responsible for generating the correct key using `generateKey`.
      logger.debug(`Creating multipart upload for key: ${key}`);

      // Use the provided key directly for the multipart upload
      const command = new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key, // Use the provided key directly
        ContentType: this.getContentTypeFromFileName(filename)
      });

      const response = await s3Client.send(command);
      
      if (!response.UploadId) {
        throw new Error('Failed to get UploadId for multipart upload');
      }
      
      logger.info(`Created multipart upload for key: ${key}, uploadId: ${response.UploadId}`);
      
      return {
        uploadId: response.UploadId,
        key
      };
    } catch (error) {
      logger.error('Error creating multipart upload:', error);
      throw new Error(`Failed to create multipart upload: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Get a presigned URL for uploading a part in a multipart upload
   * @param {string} key - The key (path) of the file in S3
   * @param {string} uploadId - The upload ID for the multipart upload
   * @param {number} partNumber - The part number (1-10000)
   * @returns {Promise<string>} - The presigned URL for uploading the part
   */
  async getPresignedUrlForPart(key: string, uploadId: string, partNumber: number): Promise<string> {
    try {
      if (partNumber < 1 || partNumber > 10000) {
        throw new Error('Part number must be between 1 and 10000');
      }
    
      // Ensure the key provided follows the 'client/project/filename' structure.
      // The caller is responsible for generating the correct key using `generateKey`.
      logger.debug(`Generating presigned URL for part ${partNumber} for key: ${key}`);
    
      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: key, // Use the provided key directly
        UploadId: uploadId,
        PartNumber: partNumber
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      
      // Replace internal endpoint with external one using the helper function
      const externalUrl = replaceS3Endpoint(url);
      
      logger.info(`Generated presigned URL for part ${partNumber} of upload ${uploadId}`);
      logger.debug(`[getPresignedUrlForPart] Final URL returned: ${externalUrl}`); // Log the final URL
      
      return externalUrl;
    } catch (error) {
      logger.error(`Error generating presigned URL for part upload:`, error);
      throw new Error(`Failed to generate presigned URL for part: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
  
  /**
   * Complete a multipart upload
   * @param {string} key - The key (path) of the file in S3
   * @param {string} uploadId - The upload ID for the multipart upload
   * @param {CompletedPart[]} parts - The parts to include in the completed upload (using AWS SDK type)
   * @returns {Promise<{location: string}>} - The URL of the completed upload
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: CompletedPart[] // Use the imported CompletedPart type
  ): Promise<{location: string}> {
    try {
      // Ensure the key provided follows the 'client/project/filename' structure.
      // The caller is responsible for generating the correct key using `generateKey`.
      logger.debug(`Completing multipart upload for key: ${key}`);

      // Sort parts by part number - ensure PartNumber is defined for sorting
      const sortedParts = [...parts].sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0));

      // The AWS SDK command expects CompletedPart[], so we can use the sorted array directly.
      // We should filter out any parts that might be missing essential info, although Uppy should provide valid parts.
      const validParts = sortedParts.filter(part => part.PartNumber !== undefined && part.ETag !== undefined);

      if (validParts.length !== sortedParts.length) {
        logger.warn(`[completeMultipartUpload] Filtered out parts with missing PartNumber or ETag for key: ${key}`);
      }

      const command = new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: validParts // Use the validated and sorted parts directly
        }
      });

      // Send the command to complete the multipart upload
      const response = await s3Client.send(command); // Capture response if needed (e.g., for ETag)

      // Generate S3 URL for the completed upload
      const s3Endpoint = process.env.S3_PUBLIC_ENDPOINT || 'https://s3.colourstream.johnrogerscolour.co.uk';
      const location = response.Location || `${s3Endpoint}/${bucket}/${key}`; // Use Location from response if available

      logger.info(`Completed multipart upload for key: ${key}, uploadId: ${uploadId}, parts: ${validParts.length}, Location: ${location}`);

      return { location };
    } catch (error) {
      logger.error('Error completing multipart upload:', error);
      throw new Error(`Failed to complete multipart upload: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Abort a multipart upload
   * @param {string} key - The key (path) of the file in S3
   * @param {string} uploadId - The upload ID for the multipart upload
   * @returns {Promise<void>}
   */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      // Ensure the key provided follows the 'client/project/filename' structure.
      // The caller is responsible for generating the correct key using `generateKey`.
      logger.debug(`Aborting multipart upload for key: ${key}, uploadId: ${uploadId}`);

      const command = new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key, // Use the provided key directly
        UploadId: uploadId
      });

      await s3Client.send(command);
      
      logger.info(`Aborted multipart upload for key: ${key}, uploadId: ${uploadId}`);
    } catch (error) {
      logger.error('Error aborting multipart upload:', error);
      throw new Error(`Failed to abort multipart upload: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Gets the content type based on the filename extension
   * @param {string} filename - The original filename
   * @returns {string} - The content type
   */
  getContentTypeFromFileName(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    // Map of common file extensions to content types
    const contentTypeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'wmv': 'video/x-ms-wmv',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'zip': 'application/zip',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'html': 'text/html',
      'json': 'application/json',
      'xml': 'application/xml',
      // ProRes and other video formats
      'mxf': 'application/mxf',
      'prores': 'video/quicktime',
      'r3d': 'video/x-red-r3d'
    };
    
    return extension && contentTypeMap[extension] ? contentTypeMap[extension] : 'application/octet-stream';
  },

  /**
   * Upload a file to S3
   * @param {Buffer|Readable} fileContent - The file content as Buffer or Readable stream
   * @param {string} key - The key (path) to store the file in S3
   * @param {string} contentType - The content type of the file
   * @param {Record<string, string>} metadata - Additional metadata to store with the file
   * @returns {Promise<string>} - The URL of the uploaded file
   */
  async uploadFile(
    fileContent: Buffer | Readable,
    key: string,
    contentType: string,
    metadata: Record<string, string> = {}
  ): Promise<string> {
    try {
      // Ensure the key provided follows the 'client/project/filename' structure.
      // The caller is responsible for generating the correct key using `generateKey`.
      logger.debug(`Uploading file to S3 key: ${key}`);

      // If fileContent is a Buffer, convert it to a Readable stream
      const body = Buffer.isBuffer(fileContent)
        ? Readable.from(fileContent)
        : fileContent;

      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          Metadata: metadata,
        },
      });

      await upload.done();
      
      // Generate the URL for the uploaded file using the public endpoint
      const s3Endpoint = process.env.S3_PUBLIC_ENDPOINT || 'https://s3.colourstream.johnrogerscolour.co.uk';
      const fileUrl = `${s3Endpoint}/${bucket}/${key}`;
      logger.info(`File uploaded to S3: ${fileUrl}`);
      
      return fileUrl;
    } catch (error) {
      logger.error('Error uploading file to S3:', error);
      throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Get a file from S3
   * @param {string} key - The key (path) of the file in S3
   * @returns {Promise<{stream: Readable, metadata: Record<string, string>}>} - The file stream and metadata
   */
  async getFile(key: string): Promise<{ stream: Readable; metadata: Record<string, string> }> {
    try {
      // Ensure the key provided follows the 'client/project/filename' structure.
      // The caller is responsible for generating the correct key using `generateKey`.
      logger.debug(`Getting file from S3 key: ${key}`);

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key, // Use the provided key directly
      });

      const response = await s3Client.send(command);
      
      // Check if we have a valid response with a Body
      if (!response.Body) {
        throw new Error('File not found or empty');
      }

      // Extract metadata from the response
      const metadata: Record<string, string> = {};
      if (response.Metadata) {
        Object.entries(response.Metadata).forEach(([key, value]) => {
          if (value) metadata[key] = value;
        });
      }

      return {
        stream: response.Body as Readable,
        metadata,
      };
    } catch (error) {
      logger.error(`Error getting file from S3 (${key}):`, error);
      throw new Error(`Failed to get file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Get the content of a file from S3
   * @param {string} key - The key (path) of the file in S3
   * @returns {Promise<Buffer|null>} - The file content as a Buffer, or null if not found
   */
  async getFileContent(key: string): Promise<Buffer | null> {
    try {
      // Ensure the key provided follows the 'client/project/filename' structure.
      // The caller is responsible for generating the correct key using `generateKey`.
      logger.debug(`Getting file content from S3 key: ${key}`);

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key, // Use the provided key directly
      });

      const response = await s3Client.send(command);
      
      if (!response.Body) {
        return null;
      }

      // Convert the response body to a buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as Readable;
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error) {
      // Check if the error is a NoSuchKey error, which means the file doesn't exist
      if ((error as any)?.name === 'NoSuchKey') {
        return null;
      }
      
      logger.error(`Error getting file content from S3 for key ${key}:`, error);
      throw new Error(`Failed to get file content from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Delete a file from S3
   * @param {string} key - The key (path) of the file in S3
   * @returns {Promise<void>}
   */
  async deleteFile(key: string): Promise<void> {
    try {
      // Ensure the key provided follows the 'client/project/filename' structure.
      // The caller is responsible for generating the correct key using `generateKey`.
      logger.debug(`Deleting file from S3 key: ${key}`);

      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key, // Use the provided key directly
      });

      await s3Client.send(command);
      logger.info(`File deleted from S3: ${key}`);
    } catch (error) {
      logger.error(`Error deleting file from S3 for key ${key}:`, error);
      throw new Error(`Failed to delete file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Generate a key for storing a file in S3 based on client, project, and filename
   * @param {string} clientCode - The client code
   * @param {string} projectName - The project name
   * @param {string} filename - The original filename
   * @returns {string} - The S3 key (path)
   */
  generateKey(clientCode: string, projectName: string, filename: string): string {
    // Normalize the client code and project name (replace spaces with underscores)
    const normalizedClientCode = clientCode?.replace(/\s+/g, '_') || 'default';
    const normalizedProjectName = projectName?.replace(/\s+/g, '_') || 'default';
    
    // Strip out any UUID patterns from the filename
    // This regex matches UUIDs in formats like:
    // - f53671c2-f356-417a-b14e-1c1b6476d723-Protape-Ltd-t-a-DataStores-50879.pdf
    // - prefix-uuid-filename.ext or uuid-filename.ext
    const filenameWithoutUuid = filename.replace(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-)/gi, '');
    
    // Ensure the filename is valid for S3 but preserve the original name as much as possible
    // Only replace characters that are invalid for S3 keys
    const safeName = filenameWithoutUuid.replace(/[\/\\:*?"<>|]/g, '_');
    
    // Create the key using the client/project/filename structure without any additional prefixes or suffixes
    return `${normalizedClientCode}/${normalizedProjectName}/${safeName}`;
  },

  /**
   * Renames an object in S3 by copying to a new key and deleting the old one
   * @param {string} sourceKey - The original key of the object
   * @param {string} destinationKey - The new key for the object
   * @returns {Promise<string>} - The new URL of the renamed object
   */
  async renameObject(sourceKey: string, destinationKey: string): Promise<string> {
    try {
      // Skip if source and destination are the same
      if (sourceKey === destinationKey) {
        logger.info(`Key already cleaned: ${sourceKey}`);
        const s3Endpoint = process.env.S3_PUBLIC_ENDPOINT || 'https://s3.colourstream.johnrogerscolour.co.uk';
        return `${s3Endpoint}/${bucket}/${sourceKey}`;
      }

      logger.info(`Renaming S3 object: ${sourceKey} -> ${destinationKey}`);
      
      // Copy the object to the new key
      await s3Client.send(new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${sourceKey}`,
        Key: destinationKey
      }));
      
      // Delete the original object
      await s3Client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: sourceKey
      }));
      
      // Generate the URL for the renamed file using the public endpoint
      const s3Endpoint = process.env.S3_PUBLIC_ENDPOINT || 'https://s3.colourstream.johnrogerscolour.co.uk';
      const fileUrl = `${s3Endpoint}/${bucket}/${destinationKey}`;
      logger.info(`Successfully renamed S3 object to: ${fileUrl}`);
      
      return fileUrl;
    } catch (error) {
      logger.error(`Error renaming object in S3 from ${sourceKey} to ${destinationKey}:`, error);
      throw new Error(`Failed to rename object in S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Check if a file exists in S3
   * @param {string} key - The key (path) of the file in S3
   * @returns {Promise<boolean>} - Whether the file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      // Ensure the key provided follows the 'client/project/filename' structure.
      // The caller is responsible for generating the correct key using `generateKey`.
      logger.debug(`Checking if file exists in S3: ${key}`);

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key, // Use the provided key directly
      });

      try {
        await s3Client.send(command);
        logger.info(`File exists in S3: ${key}`);
        return true;
      } catch (error) {
        // If the error is a NoSuchKey error, the file doesn't exist
        if ((error as any)?.name === 'NoSuchKey' || (error as any)?.Code === 'NoSuchKey') {
          logger.info(`File does not exist in S3: ${key} (NoSuchKey)`);
          return false;
        }
        
        // Check for other error types that might indicate the file doesn't exist
        if ((error as any)?.message?.includes('does not exist') ||
            (error as any)?.message?.includes('not found')) {
          logger.info(`File does not exist in S3: ${key} (error message)`);
          return false;
        }
        
        // For other errors, log and return false to be safe
        logger.error(`Error checking if file exists in S3 for key ${key}:`, error);
        return false;
      }
    } catch (error) {
      // Catch any other errors and return false to be safe
      logger.error(`Unexpected error checking if file exists in S3 for key ${key}:`, error);
      return false;
    }
  }
};

// Helper function to replace the S3 endpoint in a URL
function replaceS3Endpoint(url: string): string {
  const externalEndpoint = process.env.S3_PUBLIC_ENDPOINT || 'https://s3.colourstream.johnrogerscolour.co.uk';
  const internalEndpoint = process.env.S3_ENDPOINT || 'http://minio:9000';

  // Use a more robust replacement method that handles potential protocol differences
  // and ensures we only replace the host and port part.
  try {
    const internalUrl = new URL(internalEndpoint); // e.g., http://minio:9000
    const externalUrl = new URL(externalEndpoint); // e.g., https://s3.colourstream...

    const urlObject = new URL(url); // The URL returned by getSignedUrl

    // Check if the hostname and port match the internal endpoint
    if (urlObject.hostname === internalUrl.hostname && urlObject.port === internalUrl.port) {
      urlObject.protocol = externalUrl.protocol;
      urlObject.hostname = externalUrl.hostname;
      urlObject.port = externalUrl.port || ''; // Use external port or default (e.g., 443 for https)
      
      const replacedUrl = urlObject.toString();
      logger.debug(`Replaced internal endpoint: ${url} -> ${replacedUrl}`);
      return replacedUrl;
    } else {
       logger.debug(`URL did not match internal endpoint, returning original: ${url}`);
       return url; // Return original if it doesn't match internal endpoint
    }
  } catch (e) {
    logger.error(`Error parsing or replacing URL endpoints: ${e}. Original URL: ${url}`);
    // Fallback to simple string replacement if URL parsing fails
    return url.replace(internalEndpoint, externalEndpoint);
  }
}


export default s3Service;
