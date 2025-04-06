"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3Service = exports.s3Bucket = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const lib_storage_1 = require("@aws-sdk/lib-storage");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const stream_1 = require("stream");
const logger_1 = require("../../utils/logger");
// Initialize S3 client with MinIO configuration
const s3Client = new client_s3_1.S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
    },
    forcePathStyle: true, // This is required for MinIO and most S3-compatible storage
});
const bucket = process.env.S3_BUCKET || 'uploads';
// Export the bucket name for use in other modules
exports.s3Bucket = bucket;
exports.s3Service = {
    /**
     * Get the bucket name
     * @returns {string} - The S3 bucket name
     */
    getBucket() {
        return bucket;
    },
    /**
     * Generate a presigned URL for direct upload to S3
     * @param {string} key - The key (path) to store the file in S3
     * @param {number} expiresIn - The number of seconds until the presigned URL expires (default: 3600)
     * @returns {Promise<string>} - The presigned URL for uploading
     */
    async generatePresignedUrl(key, expiresIn = 3600) {
        try {
            // Ensure the key provided follows the 'client/project/filename' structure.
            // The caller is responsible for generating the correct key using `generateKey`.
            logger_1.logger.debug(`Generating presigned URL for S3 key: ${key}`);
            const command = new client_s3_1.PutObjectCommand({
                Bucket: bucket,
                Key: key, // Use the provided key directly
            });
            const url = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn });
            logger_1.logger.info(`Generated presigned URL for S3 key: ${key}`);
            // Replace internal minio:9000 with external S3 endpoint if needed
            const externalEndpoint = process.env.S3_PUBLIC_ENDPOINT || 'https://s3.colourstream.johnrogerscolour.co.uk';
            const internalEndpoint = process.env.S3_ENDPOINT || 'http://minio:9000';
            // Replace the internal URL with the external URL
            const externalUrl = url.replace(internalEndpoint, externalEndpoint);
            logger_1.logger.info(`Converted internal URL to external URL: ${externalUrl}`);
            return externalUrl;
        }
        catch (error) {
            logger_1.logger.error('Error generating presigned URL:', error);
            throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    /**
     * Create a multipart upload
     * @param {string} key - The key (path) to store the file in S3
     * @param {string} filename - The original filename
     * @returns {Promise<{uploadId: string, key: string}>} - The upload ID and key for the multipart upload
     */
    async createMultipartUpload(key, filename) {
        try {
            // Ensure the key provided follows the 'client/project/filename' structure.
            // The caller is responsible for generating the correct key using `generateKey`.
            logger_1.logger.debug(`Creating multipart upload for key: ${key}`);
            // Use the provided key directly for the multipart upload
            const command = new client_s3_1.CreateMultipartUploadCommand({
                Bucket: bucket,
                Key: key, // Use the provided key directly
                ContentType: this.getContentTypeFromFileName(filename)
            });
            const response = await s3Client.send(command);
            if (!response.UploadId) {
                throw new Error('Failed to get UploadId for multipart upload');
            }
            logger_1.logger.info(`Created multipart upload for key: ${key}, uploadId: ${response.UploadId}`);
            return {
                uploadId: response.UploadId,
                key
            };
        }
        catch (error) {
            logger_1.logger.error('Error creating multipart upload:', error);
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
    async getPresignedUrlForPart(key, uploadId, partNumber) {
        try {
            if (partNumber < 1 || partNumber > 10000) {
                throw new Error('Part number must be between 1 and 10000');
            }
            // Ensure the key provided follows the 'client/project/filename' structure.
            // The caller is responsible for generating the correct key using `generateKey`.
            logger_1.logger.debug(`Generating presigned URL for part ${partNumber} for key: ${key}`);
            const command = new client_s3_1.UploadPartCommand({
                Bucket: bucket,
                Key: key, // Use the provided key directly
                UploadId: uploadId,
                PartNumber: partNumber
            });
            const url = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn: 3600 });
            // Replace internal minio:9000 with external S3 endpoint if needed
            const externalEndpoint = process.env.S3_PUBLIC_ENDPOINT || 'https://s3.colourstream.johnrogerscolour.co.uk';
            const internalEndpoint = process.env.S3_ENDPOINT || 'http://minio:9000';
            // Replace the internal URL with the external URL
            const externalUrl = url.replace(internalEndpoint, externalEndpoint);
            logger_1.logger.info(`Generated presigned URL for part ${partNumber} of upload ${uploadId}`);
            return externalUrl;
        }
        catch (error) {
            logger_1.logger.error(`Error generating presigned URL for part upload:`, error);
            throw new Error(`Failed to generate presigned URL for part: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    /**
     * Complete a multipart upload
     * @param {string} key - The key (path) of the file in S3
     * @param {string} uploadId - The upload ID for the multipart upload
     * @param {Array<{PartNumber: number, ETag: string}>} parts - The parts to include in the completed upload
     * @returns {Promise<{location: string}>} - The URL of the completed upload
     */
    async completeMultipartUpload(key, uploadId, parts) {
        try {
            // Ensure the key provided follows the 'client/project/filename' structure.
            // The caller is responsible for generating the correct key using `generateKey`.
            logger_1.logger.debug(`Completing multipart upload for key: ${key}`);
            // Sort parts by part number
            const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
            // Create the MultipartUpload parts array in the format AWS expects
            const completedParts = sortedParts.map(part => ({
                PartNumber: part.PartNumber,
                ETag: part.ETag
            }));
            const command = new client_s3_1.CompleteMultipartUploadCommand({
                Bucket: bucket,
                Key: key,
                UploadId: uploadId,
                MultipartUpload: {
                    Parts: completedParts
                }
            });
            // Send the command to complete the multipart upload
            await s3Client.send(command);
            // Generate S3 URL for the completed upload
            const s3Endpoint = process.env.S3_PUBLIC_ENDPOINT || 'https://s3.colourstream.johnrogerscolour.co.uk';
            const location = `${s3Endpoint}/${bucket}/${key}`;
            logger_1.logger.info(`Completed multipart upload for key: ${key}, uploadId: ${uploadId}, parts: ${completedParts.length}`);
            return { location };
        }
        catch (error) {
            logger_1.logger.error('Error completing multipart upload:', error);
            throw new Error(`Failed to complete multipart upload: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    /**
     * Abort a multipart upload
     * @param {string} key - The key (path) of the file in S3
     * @param {string} uploadId - The upload ID for the multipart upload
     * @returns {Promise<void>}
     */
    async abortMultipartUpload(key, uploadId) {
        try {
            // Ensure the key provided follows the 'client/project/filename' structure.
            // The caller is responsible for generating the correct key using `generateKey`.
            logger_1.logger.debug(`Aborting multipart upload for key: ${key}, uploadId: ${uploadId}`);
            const command = new client_s3_1.AbortMultipartUploadCommand({
                Bucket: bucket,
                Key: key, // Use the provided key directly
                UploadId: uploadId
            });
            await s3Client.send(command);
            logger_1.logger.info(`Aborted multipart upload for key: ${key}, uploadId: ${uploadId}`);
        }
        catch (error) {
            logger_1.logger.error('Error aborting multipart upload:', error);
            throw new Error(`Failed to abort multipart upload: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    /**
     * Gets the content type based on the filename extension
     * @param {string} filename - The original filename
     * @returns {string} - The content type
     */
    getContentTypeFromFileName(filename) {
        var _a;
        const extension = (_a = filename.split('.').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        // Map of common file extensions to content types
        const contentTypeMap = {
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
    async uploadFile(fileContent, key, contentType, metadata = {}) {
        try {
            // Ensure the key provided follows the 'client/project/filename' structure.
            // The caller is responsible for generating the correct key using `generateKey`.
            logger_1.logger.debug(`Uploading file to S3 key: ${key}`);
            // If fileContent is a Buffer, convert it to a Readable stream
            const body = Buffer.isBuffer(fileContent)
                ? stream_1.Readable.from(fileContent)
                : fileContent;
            const upload = new lib_storage_1.Upload({
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
            logger_1.logger.info(`File uploaded to S3: ${fileUrl}`);
            return fileUrl;
        }
        catch (error) {
            logger_1.logger.error('Error uploading file to S3:', error);
            throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    /**
     * Get a file from S3
     * @param {string} key - The key (path) of the file in S3
     * @returns {Promise<{stream: Readable, metadata: Record<string, string>}>} - The file stream and metadata
     */
    async getFile(key) {
        try {
            // Ensure the key provided follows the 'client/project/filename' structure.
            // The caller is responsible for generating the correct key using `generateKey`.
            logger_1.logger.debug(`Getting file from S3 key: ${key}`);
            const command = new client_s3_1.GetObjectCommand({
                Bucket: bucket,
                Key: key, // Use the provided key directly
            });
            const response = await s3Client.send(command);
            // Check if we have a valid response with a Body
            if (!response.Body) {
                throw new Error('File not found or empty');
            }
            // Extract metadata from the response
            const metadata = {};
            if (response.Metadata) {
                Object.entries(response.Metadata).forEach(([key, value]) => {
                    if (value)
                        metadata[key] = value;
                });
            }
            return {
                stream: response.Body,
                metadata,
            };
        }
        catch (error) {
            logger_1.logger.error(`Error getting file from S3 (${key}):`, error);
            throw new Error(`Failed to get file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    /**
     * Get the content of a file from S3
     * @param {string} key - The key (path) of the file in S3
     * @returns {Promise<Buffer|null>} - The file content as a Buffer, or null if not found
     */
    async getFileContent(key) {
        try {
            // Ensure the key provided follows the 'client/project/filename' structure.
            // The caller is responsible for generating the correct key using `generateKey`.
            logger_1.logger.debug(`Getting file content from S3 key: ${key}`);
            const command = new client_s3_1.GetObjectCommand({
                Bucket: bucket,
                Key: key, // Use the provided key directly
            });
            const response = await s3Client.send(command);
            if (!response.Body) {
                return null;
            }
            // Convert the response body to a buffer
            const chunks = [];
            const stream = response.Body;
            return new Promise((resolve, reject) => {
                stream.on('data', (chunk) => chunks.push(chunk));
                stream.on('end', () => resolve(Buffer.concat(chunks)));
                stream.on('error', reject);
            });
        }
        catch (error) {
            // Check if the error is a NoSuchKey error, which means the file doesn't exist
            if ((error === null || error === void 0 ? void 0 : error.name) === 'NoSuchKey') {
                return null;
            }
            logger_1.logger.error(`Error getting file content from S3 for key ${key}:`, error);
            throw new Error(`Failed to get file content from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    /**
     * Delete a file from S3
     * @param {string} key - The key (path) of the file in S3
     * @returns {Promise<void>}
     */
    async deleteFile(key) {
        try {
            // Ensure the key provided follows the 'client/project/filename' structure.
            // The caller is responsible for generating the correct key using `generateKey`.
            logger_1.logger.debug(`Deleting file from S3 key: ${key}`);
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: bucket,
                Key: key, // Use the provided key directly
            });
            await s3Client.send(command);
            logger_1.logger.info(`File deleted from S3: ${key}`);
        }
        catch (error) {
            logger_1.logger.error(`Error deleting file from S3 for key ${key}:`, error);
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
    generateKey(clientCode, projectName, filename) {
        // Normalize the client code and project name (replace spaces with underscores)
        const normalizedClientCode = (clientCode === null || clientCode === void 0 ? void 0 : clientCode.replace(/\s+/g, '_')) || 'default';
        const normalizedProjectName = (projectName === null || projectName === void 0 ? void 0 : projectName.replace(/\s+/g, '_')) || 'default';
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
    async renameObject(sourceKey, destinationKey) {
        try {
            // Skip if source and destination are the same
            if (sourceKey === destinationKey) {
                logger_1.logger.info(`Key already cleaned: ${sourceKey}`);
                const s3Endpoint = process.env.S3_PUBLIC_ENDPOINT || 'https://s3.colourstream.johnrogerscolour.co.uk';
                return `${s3Endpoint}/${bucket}/${sourceKey}`;
            }
            logger_1.logger.info(`Renaming S3 object: ${sourceKey} -> ${destinationKey}`);
            // Copy the object to the new key
            await s3Client.send(new client_s3_1.CopyObjectCommand({
                Bucket: bucket,
                CopySource: `${bucket}/${sourceKey}`,
                Key: destinationKey
            }));
            // Delete the original object
            await s3Client.send(new client_s3_1.DeleteObjectCommand({
                Bucket: bucket,
                Key: sourceKey
            }));
            // Generate the URL for the renamed file using the public endpoint
            const s3Endpoint = process.env.S3_PUBLIC_ENDPOINT || 'https://s3.colourstream.johnrogerscolour.co.uk';
            const fileUrl = `${s3Endpoint}/${bucket}/${destinationKey}`;
            logger_1.logger.info(`Successfully renamed S3 object to: ${fileUrl}`);
            return fileUrl;
        }
        catch (error) {
            logger_1.logger.error(`Error renaming object in S3 from ${sourceKey} to ${destinationKey}:`, error);
            throw new Error(`Failed to rename object in S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    /**
     * Check if a file exists in S3
     * @param {string} key - The key (path) of the file in S3
     * @returns {Promise<boolean>} - Whether the file exists
     */
    async fileExists(key) {
        var _a, _b;
        try {
            // Ensure the key provided follows the 'client/project/filename' structure.
            // The caller is responsible for generating the correct key using `generateKey`.
            logger_1.logger.debug(`Checking if file exists in S3: ${key}`);
            const command = new client_s3_1.GetObjectCommand({
                Bucket: bucket,
                Key: key, // Use the provided key directly
            });
            try {
                await s3Client.send(command);
                logger_1.logger.info(`File exists in S3: ${key}`);
                return true;
            }
            catch (error) {
                // If the error is a NoSuchKey error, the file doesn't exist
                if ((error === null || error === void 0 ? void 0 : error.name) === 'NoSuchKey' || (error === null || error === void 0 ? void 0 : error.Code) === 'NoSuchKey') {
                    logger_1.logger.info(`File does not exist in S3: ${key} (NoSuchKey)`);
                    return false;
                }
                // Check for other error types that might indicate the file doesn't exist
                if (((_a = error === null || error === void 0 ? void 0 : error.message) === null || _a === void 0 ? void 0 : _a.includes('does not exist')) ||
                    ((_b = error === null || error === void 0 ? void 0 : error.message) === null || _b === void 0 ? void 0 : _b.includes('not found'))) {
                    logger_1.logger.info(`File does not exist in S3: ${key} (error message)`);
                    return false;
                }
                // For other errors, log and return false to be safe
                logger_1.logger.error(`Error checking if file exists in S3 for key ${key}:`, error);
                return false;
            }
        }
        catch (error) {
            // Catch any other errors and return false to be safe
            logger_1.logger.error(`Unexpected error checking if file exists in S3 for key ${key}:`, error);
            return false;
        }
    }
};
exports.default = exports.s3Service;
