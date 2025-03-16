"use strict";
/**
 * S3 Filename Fixer
 *
 * This script detects files in S3 with UUID prefixes and renames them to follow the
 * CLIENT/PROJECT/filename structure. It can be run on a schedule or triggered by events.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixS3Filenames = fixS3Filenames;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3Service_1 = require("../services/s3/s3Service");
const logger_1 = require("../utils/logger");
const client_1 = require("@prisma/client");
// Use the existing Prisma client
const prisma = new client_1.PrismaClient();
// UUID detection regex
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
/**
 * Initialize S3 client for direct operations
 */
const s3Client = new client_s3_1.S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
    },
    forcePathStyle: true,
});
const bucket = process.env.S3_BUCKET || 'uploads';
/**
 * List all objects in the S3 bucket
 * (Helper function since s3Service doesn't expose this directly)
 */
async function listAllS3Objects() {
    try {
        const command = new client_s3_1.ListObjectsV2Command({
            Bucket: bucket,
        });
        const response = await s3Client.send(command);
        if (!response.Contents) {
            logger_1.logger.info('No objects found in bucket');
            return [];
        }
        logger_1.logger.info(`Found ${response.Contents.length} objects in bucket`);
        return response.Contents;
    }
    catch (error) {
        logger_1.logger.error('Error listing S3 objects:', error);
        throw error;
    }
}
/**
 * Extract client and project from a path
 * @param path S3 object key path
 * @returns Extracted client and project codes
 */
function extractPathInfo(path) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 2) {
        return {
            clientCode: parts[0] || null,
            projectCode: parts[1] || null
        };
    }
    // Not enough parts to extract client/project
    return {
        clientCode: null,
        projectCode: null
    };
}
/**
 * Determine if a key contains a UUID
 * @param key S3 object key
 * @returns Whether the key contains a UUID
 */
function hasUuid(key) {
    return UUID_REGEX.test(key);
}
/**
 * Attempt to find a file in the database by key or similar keys
 * @param key S3 object key
 * @returns Client and project information if found
 */
async function findFileInDatabase(key) {
    var _a, _b;
    // Try to find an exact match first
    const file = await prisma.uploadedFile.findFirst({
        where: { path: key },
        include: {
            project: {
                include: {
                    client: true
                }
            }
        }
    });
    if ((_a = file === null || file === void 0 ? void 0 : file.project) === null || _a === void 0 ? void 0 : _a.client) {
        logger_1.logger.info(`Found file in database with client=${file.project.client.code} project=${file.project.name}`);
        return {
            clientCode: file.project.client.code,
            projectCode: file.project.name
        };
    }
    // Try to find by filename without UUID
    const filename = key.split('/').pop() || '';
    const cleanFilename = filename.replace(UUID_REGEX, '');
    if (cleanFilename !== filename) {
        // Try to match based on clean filename
        const fileByName = await prisma.uploadedFile.findFirst({
            where: {
                name: {
                    contains: cleanFilename
                }
            },
            include: {
                project: {
                    include: {
                        client: true
                    }
                }
            }
        });
        if ((_b = fileByName === null || fileByName === void 0 ? void 0 : fileByName.project) === null || _b === void 0 ? void 0 : _b.client) {
            logger_1.logger.info(`Found similar file in database with client=${fileByName.project.client.code} project=${fileByName.project.name}`);
            return {
                clientCode: fileByName.project.client.code,
                projectCode: fileByName.project.name
            };
        }
    }
    return {
        clientCode: null,
        projectCode: null
    };
}
/**
 * Generate a clean key for a file by removing UUID and ensuring proper structure
 * @param key Original S3 key
 * @returns Clean key in /CLIENT/PROJECT/filename format
 */
async function generateCleanKey(key) {
    // First check if we can get client/project from database
    const dbInfo = await findFileInDatabase(key);
    // If we couldn't find in DB, try to extract from path
    const pathInfo = extractPathInfo(key);
    // Use DB info if available, fall back to path info, then default
    const clientCode = dbInfo.clientCode || pathInfo.clientCode || 'default';
    const projectCode = dbInfo.projectCode || pathInfo.projectCode || 'default';
    // Get filename and clean it
    const filename = key.split('/').pop() || '';
    const cleanFilename = filename.replace(UUID_REGEX, '');
    // Normalize client and project names - convert to lowercase, replace spaces with dashes
    const normalizedClient = clientCode.toLowerCase().replace(/\s+/g, '-');
    const normalizedProject = projectCode.toLowerCase().replace(/\s+/g, '-');
    // Format as /CLIENT/PROJECT/filename
    return `${normalizedClient}/${normalizedProject}/${cleanFilename}`;
}
/**
 * Fix filenames in S3 by removing UUIDs and ensuring proper /CLIENT/PROJECT/filename structure
 */
async function fixS3Filenames() {
    logger_1.logger.info('Starting S3 filename cleanup process');
    try {
        // List all objects in S3 using our helper function
        const objects = await listAllS3Objects();
        let renamedCount = 0;
        for (const object of objects) {
            const key = object.Key;
            if (!key)
                continue;
            // Check if the key contains a UUID
            if (hasUuid(key)) {
                try {
                    // Generate a clean key
                    const cleanKey = await generateCleanKey(key);
                    // Don't rename if the key is already clean
                    if (cleanKey === key) {
                        logger_1.logger.debug(`Key is already clean: ${key}`);
                        continue;
                    }
                    // Rename the object
                    logger_1.logger.info(`Renaming object from ${key} to ${cleanKey}`);
                    await s3Service_1.s3Service.renameObject(key, cleanKey);
                    renamedCount++;
                    // Update file record in database if exists
                    const fileRecord = await prisma.uploadedFile.findFirst({
                        where: { path: key }
                    });
                    if (fileRecord) {
                        await prisma.uploadedFile.update({
                            where: { id: fileRecord.id },
                            data: { path: cleanKey }
                        });
                        logger_1.logger.info(`Updated database record for ${key} to ${cleanKey}`);
                    }
                }
                catch (error) {
                    logger_1.logger.error(`Error renaming object ${key}:`, error);
                }
            }
        }
        logger_1.logger.info(`S3 filename cleanup completed. Renamed ${renamedCount} objects.`);
    }
    catch (error) {
        logger_1.logger.error('Error during S3 filename cleanup:', error);
        throw error;
    }
}
// If this script is run directly, execute the cleanup
if (require.main === module) {
    fixS3Filenames()
        .then(() => {
        logger_1.logger.info('S3 filename cleanup completed successfully');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('S3 filename cleanup failed:', error);
        process.exit(1);
    });
}
exports.default = fixS3Filenames;
