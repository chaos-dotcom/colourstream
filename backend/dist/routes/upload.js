"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const xxhash_wasm_1 = __importDefault(require("xxhash-wasm"));
const auth_1 = require("../middleware/auth");
const uploadTracker_1 = require("../services/uploads/uploadTracker");
const s3Service_1 = require("../services/s3/s3Service");
const fix_s3_filenames_1 = require("../scripts/fix-s3-filenames");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
// Helper function to generate formatted upload token
function generateUploadToken() {
    const segments = (0, uuid_1.v4)().split('-').slice(0, 4);
    return segments.join('-').toUpperCase();
}
// Configure multer for file uploads with client/project structure
const storage = multer_1.default.diskStorage({
    destination: async (req, _file, cb) => {
        try {
            const { token } = req.params;
            const uploadLink = await prisma.uploadLink.findUnique({
                where: { token },
                include: {
                    project: {
                        include: {
                            client: true
                        }
                    }
                }
            });
            if (!uploadLink) {
                cb(new Error('Invalid upload link'), '');
                return;
            }
            // Use the TUS organized directory structure
            // This matches where TUS stores its finalized files
            // The path below assumes you've set an environment variable in your backend
            // If not available, we fall back to the local path
            const organizedDir = process.env.TUS_ORGANIZED_DIR || path_1.default.join(__dirname, '../../organized');
            const uploadDir = path_1.default.join(organizedDir, uploadLink.project.client.code || 'default', uploadLink.project.name);
            if (!fs_1.default.existsSync(uploadDir)) {
                fs_1.default.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        }
        catch (error) {
            cb(error, '');
        }
    },
    filename: (_req, file, cb) => {
        // Use the original filename, only replacing characters that would cause filesystem issues
        // Allow spaces, apostrophes, parentheses and other common characters
        const originalName = file.originalname;
        // Replace only problematic characters like slashes, colons, etc.
        const safeName = originalName.replace(/[\/\\:*?"<>|]/g, '_');
        cb(null, safeName);
    }
});
// Modified upload limits for handling large files with XHR upload
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: process.env.MAX_FILE_SIZE ? parseInt(process.env.MAX_FILE_SIZE) : 10 * 1024 * 1024 * 1024, // Default 10GB
    }
});
// Create a new client
router.post('/clients', auth_1.authenticateToken, async (req, res) => {
    try {
        const { name, code } = req.body;
        // Generate a code from the name if not provided
        const clientCode = code || name
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '') // Remove special characters
            .slice(0, 10); // Take first 10 characters
        const client = await prisma.client.create({
            data: {
                name,
                code: clientCode,
            }
        });
        res.json({
            status: 'success',
            data: client
        });
    }
    catch (error) {
        console.error('Failed to create client:', error);
        if (error.code === 'P2002') {
            res.status(400).json({
                status: 'error',
                message: 'A client with this code already exists'
            });
        }
        else {
            res.status(500).json({
                status: 'error',
                message: 'Failed to create client'
            });
        }
    }
});
// Get all clients
router.get('/clients', auth_1.authenticateToken, async (_req, res) => {
    try {
        const clients = await prisma.client.findMany({
            include: {
                projects: {
                    include: {
                        uploadLinks: true,
                        files: true,
                    }
                }
            }
        });
        res.json({
            status: 'success',
            data: clients
        });
    }
    catch (error) {
        console.error('Failed to fetch clients:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch clients'
        });
    }
});
// Create a new project
router.post('/clients/:clientId/projects', auth_1.authenticateToken, async (req, res) => {
    try {
        const { clientId } = req.params;
        const { name, description } = req.body;
        const project = await prisma.project.create({
            data: {
                name,
                description,
                clientId,
            },
            include: {
                client: true
            }
        });
        res.json({
            status: 'success',
            data: project
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to create project'
        });
    }
});
// Get all projects for a client
router.get('/clients/:clientId/projects', auth_1.authenticateToken, async (req, res) => {
    try {
        const { clientId } = req.params;
        const projects = await prisma.project.findMany({
            where: { clientId },
            include: {
                uploadLinks: true,
                files: true,
            }
        });
        res.json({
            status: 'success',
            data: projects
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch projects'
        });
    }
});
// Create an upload link for a project
router.post('/projects/:projectId/upload-links', auth_1.authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { expiresAt, usageLimit } = req.body;
        // If usageLimit is undefined or null, explicitly set maxUses to null to override the default
        const maxUses = usageLimit === undefined || usageLimit === null ? null : usageLimit;
        const uploadLink = await prisma.uploadLink.create({
            data: {
                token: generateUploadToken(),
                projectId,
                expiresAt: new Date(expiresAt),
                maxUses,
            },
            include: {
                project: {
                    include: {
                        client: true
                    }
                }
            }
        });
        // Generate the full upload URL
        const uploadUrl = `https://upload.colourstream.johnrogerscolour.co.uk/${uploadLink.token}`;
        res.json({
            status: 'success',
            data: {
                ...uploadLink,
                uploadUrl
            }
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to create upload link'
        });
    }
});
// Validate upload link and get project info
router.get('/upload-links/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const uploadLink = await prisma.uploadLink.findUnique({
            where: { token },
            include: {
                project: {
                    include: {
                        client: true
                    }
                }
            }
        });
        if (!uploadLink) {
            return res.status(404).json({
                status: 'error',
                message: 'Upload link not found'
            });
        }
        if (uploadLink.expiresAt < new Date()) {
            return res.status(403).json({
                status: 'error',
                message: 'Upload link has expired'
            });
        }
        // If maxUses is null, it means unlimited uses
        if (uploadLink.maxUses !== null && uploadLink.usedCount >= uploadLink.maxUses) {
            return res.status(403).json({
                status: 'error',
                message: 'Upload link has reached maximum uses'
            });
        }
        res.json({
            status: 'success',
            data: {
                clientName: uploadLink.project.client.name,
                projectName: uploadLink.project.name,
                expiresAt: uploadLink.expiresAt
            }
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to validate upload link'
        });
    }
});
// Get project files
router.get('/projects/:projectId/files', auth_1.authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const files = await prisma.uploadedFile.findMany({
            where: { projectId },
            include: {
                project: {
                    include: {
                        client: true
                    }
                }
            }
        });
        res.json({
            status: 'success',
            data: files
        });
    }
    catch (error) {
        console.error('Failed to fetch files:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch files'
        });
    }
});
// Handle file upload
router.post('/upload/:token', upload.array('files'), async (req, res) => {
    const multerReq = req;
    if (!multerReq.files) {
        return res.status(400).json({
            status: 'error',
            message: 'No files uploaded'
        });
    }
    try {
        const { token } = req.params;
        const files = multerReq.files;
        const useS3 = req.query.S3 === 'true';
        const uploadLink = await prisma.uploadLink.findUnique({
            where: { token },
            include: {
                project: {
                    include: {
                        client: true
                    }
                }
            }
        });
        if (!uploadLink) {
            // Delete uploaded files since the link is invalid
            for (const file of files) {
                await fs_1.default.promises.unlink(file.path);
            }
            return res.status(404).json({
                status: 'error',
                message: 'Upload link not found'
            });
        }
        if (uploadLink.expiresAt < new Date()) {
            // Delete uploaded files since the link has expired
            for (const file of files) {
                await fs_1.default.promises.unlink(file.path);
            }
            return res.status(403).json({
                status: 'error',
                message: 'Upload link has expired'
            });
        }
        // If maxUses is null, it means unlimited uses
        if (uploadLink.maxUses !== null && uploadLink.usedCount >= uploadLink.maxUses) {
            // Delete uploaded files since the link has reached max uses
            for (const file of files) {
                await fs_1.default.promises.unlink(file.path);
            }
            return res.status(403).json({
                status: 'error',
                message: 'Upload link has reached maximum uses'
            });
        }
        // Initialize XXHash64 - fast and reliable hashing
        const xxhash64 = await (0, xxhash_wasm_1.default)();
        // Process files and update database
        const uploadedFiles = await Promise.all(files.map(async (file) => {
            // Generate a unique ID for the upload (similar to tusId in the tus flow)
            const xhrUploadId = `xhr-${(0, uuid_1.v4)()}`;
            // Initial tracking for beginning of upload (similar to post-create hook)
            uploadTracker_1.uploadTracker.trackUpload({
                id: xhrUploadId,
                size: file.size,
                offset: 0,
                metadata: {
                    filename: file.originalname,
                    filetype: file.mimetype,
                    token: token,
                    clientName: uploadLink.project.client.name,
                    projectName: uploadLink.project.name,
                    storage: useS3 ? 's3' : 'local'
                },
                createdAt: new Date(),
            });
            try {
                // Calculate file hash for integrity and deduplication
                const fileBuffer = await fs_1.default.promises.readFile(file.path);
                const fileHash = xxhash64.h64Raw(Buffer.from(fileBuffer)).toString(16);
                // Check for existing file with same hash in this project
                const existingFile = await prisma.uploadedFile.findFirst({
                    where: {
                        projectId: uploadLink.projectId,
                        hash: fileHash
                    }
                });
                if (existingFile) {
                    // Delete the duplicate file
                    await fs_1.default.promises.unlink(file.path);
                    // Track the upload as complete
                    uploadTracker_1.uploadTracker.completeUpload(xhrUploadId);
                    return existingFile;
                }
                let filePath = file.path;
                let fileUrl = '';
                // If S3 storage is requested, upload to S3
                if (useS3) {
                    // Generate S3 key based on client, project, and filename
                    // Using the clean $CLIENT/$PROJECT/FILENAME structure
                    const s3Key = s3Service_1.s3Service.generateKey(uploadLink.project.client.code || 'default', uploadLink.project.name, file.originalname);
                    // Enhanced logging for debugging filename issues
                    console.log(`File upload request - Original filename: "${file.originalname}"`);
                    console.log(`Generated S3 key: "${s3Key}" for file: "${file.originalname}"`);
                    console.log(`Client code: "${uploadLink.project.client.code || 'default'}", Project name: "${uploadLink.project.name}"`);
                    // Log the generated S3 key for debugging
                    console.log(`Generated S3 key for upload: ${s3Key} for file: ${file.originalname}`);
                    // Upload file to S3
                    fileUrl = await s3Service_1.s3Service.uploadFile(fileBuffer, s3Key, file.mimetype, {
                        clientName: uploadLink.project.client.name,
                        projectName: uploadLink.project.name,
                        originalName: file.originalname
                    });
                    // Delete the local file after successful S3 upload
                    await fs_1.default.promises.unlink(file.path);
                    // Update the file path to use the S3 URL
                    filePath = fileUrl;
                }
                // Create new file record
                const uploadedFile = await prisma.uploadedFile.create({
                    data: {
                        name: file.originalname,
                        path: filePath,
                        size: parseFloat(file.size.toString()),
                        mimeType: file.mimetype,
                        hash: fileHash,
                        project: {
                            connect: { id: uploadLink.projectId }
                        },
                        status: 'completed',
                        completedAt: new Date(),
                        storage: useS3 ? 's3' : 'local',
                        url: useS3 ? fileUrl : null
                    }
                });
                // Track the upload as complete (similar to post-finish hook)
                uploadTracker_1.uploadTracker.completeUpload(xhrUploadId);
                return uploadedFile;
            }
            catch (error) {
                console.error('Error processing file:', error);
                // Track upload error
                uploadTracker_1.uploadTracker.trackUpload({
                    id: xhrUploadId,
                    size: file.size,
                    offset: 0,
                    metadata: {
                        filename: file.originalname,
                        filetype: file.mimetype,
                        token: token,
                        clientName: uploadLink.project.client.name,
                        projectName: uploadLink.project.name,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        storage: useS3 ? 's3' : 'local'
                    },
                    createdAt: new Date(),
                    isComplete: true
                });
                throw error;
            }
        }));
        // Update the upload link usage count
        await prisma.uploadLink.update({
            where: { id: uploadLink.id },
            data: { usedCount: { increment: 1 } }
        });
        res.json({
            status: 'success',
            data: uploadedFiles
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process upload'
        });
    }
});
// Delete a project
router.delete('/projects/:projectId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        await prisma.project.delete({
            where: { id: projectId }
        });
        res.json({
            status: 'success',
            message: 'Project deleted successfully'
        });
    }
    catch (error) {
        console.error('Failed to delete project:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete project'
        });
    }
});
// Get a single project
router.get('/projects/:projectId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                client: true,
                uploadLinks: true,
                files: true,
            }
        });
        if (!project) {
            return res.status(404).json({
                status: 'error',
                message: 'Project not found'
            });
        }
        res.json({
            status: 'success',
            data: project
        });
    }
    catch (error) {
        console.error('Failed to fetch project:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch project'
        });
    }
});
// Delete a client
router.delete('/clients/:clientId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { clientId } = req.params;
        // Check if client exists
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            include: { projects: true }
        });
        if (!client) {
            return res.status(404).json({
                status: 'error',
                message: 'Client not found'
            });
        }
        // Delete the client (cascading delete will handle projects and upload links)
        await prisma.client.delete({
            where: { id: clientId }
        });
        res.json({
            status: 'success',
            message: 'Client deleted successfully'
        });
    }
    catch (error) {
        console.error('Failed to delete client:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete client. Make sure there are no active uploads for this client.'
        });
    }
});
// Delete an upload link
router.delete('/upload-links/:linkId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { linkId } = req.params;
        // Check if upload link exists
        const uploadLink = await prisma.uploadLink.findUnique({
            where: { id: linkId }
        });
        if (!uploadLink) {
            return res.status(404).json({
                status: 'error',
                message: 'Upload link not found'
            });
        }
        // Delete the upload link
        await prisma.uploadLink.delete({
            where: { id: linkId }
        });
        res.json({
            status: 'success',
            message: 'Upload link deleted successfully'
        });
    }
    catch (error) {
        console.error('Failed to delete upload link:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete upload link'
        });
    }
});
// Get all upload links with client and project information
router.get('/upload-links/all', auth_1.authenticateToken, async (_req, res) => {
    try {
        const uploadLinks = await prisma.uploadLink.findMany({
            include: {
                project: {
                    include: {
                        client: true
                    }
                }
            },
            orderBy: [
                { createdAt: 'desc' }
            ]
        });
        res.json({
            status: 'success',
            data: uploadLinks
        });
    }
    catch (error) {
        console.error('Failed to fetch upload links:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch upload links'
        });
    }
});
// Endpoint to get S3 upload parameters for AWS S3 direct upload
router.get('/s3-params/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const filename = req.query.filename;
        const multipart = req.query.multipart === 'true';
        if (!filename) {
            return res.status(400).json({
                status: 'error',
                message: 'Filename is required'
            });
        }
        // Validate the upload token
        const uploadLink = await prisma.uploadLink.findUnique({
            where: { token },
            include: {
                project: {
                    include: {
                        client: true
                    }
                }
            }
        });
        if (!uploadLink) {
            return res.status(404).json({
                status: 'error',
                message: 'Upload link not found'
            });
        }
        if (uploadLink.expiresAt < new Date()) {
            return res.status(403).json({
                status: 'error',
                message: 'Upload link has expired'
            });
        }
        // Generate S3 key for this file - using the clean $CLIENT/$PROJECT/FILENAME structure
        const s3Key = s3Service_1.s3Service.generateKey(uploadLink.project.client.code || 'default', uploadLink.project.name, filename);
        // Enhanced logging for debugging filename issues
        console.log(`File upload request - Original filename: "${filename}"`);
        console.log(`Generated S3 key: "${s3Key}" for file: "${filename}"`);
        console.log(`Client code: "${uploadLink.project.client.code || 'default'}", Project name: "${uploadLink.project.name}"`);
        // Handle multipart upload initialization or regular presigned URL
        if (multipart) {
            const { uploadId, key } = await s3Service_1.s3Service.createMultipartUpload(s3Key, filename);
            res.json({
                status: 'success',
                uploadId,
                key
            });
        }
        else {
            const url = await s3Service_1.s3Service.generatePresignedUrl(s3Key);
            res.json({
                status: 'success',
                url,
                key: s3Key
            });
        }
    }
    catch (error) {
        console.error('Failed to generate S3 params:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate S3 parameters'
        });
    }
});
// Add endpoint for multipart upload part presigned URL generation
router.get('/s3-part-params/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { uploadId, key, partNumber } = req.query;
        if (!uploadId || !key || !partNumber) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required parameters: uploadId, key, and partNumber are required'
            });
        }
        // Validate the upload token
        const uploadLink = await prisma.uploadLink.findUnique({
            where: { token }
        });
        if (!uploadLink || uploadLink.expiresAt < new Date()) {
            return res.status(403).json({
                status: 'error',
                message: 'Upload link is invalid or has expired'
            });
        }
        // Generate presigned URL for the part upload
        const url = await s3Service_1.s3Service.getPresignedUrlForPart(key, uploadId, parseInt(partNumber, 10));
        res.json({
            status: 'success',
            url
        });
    }
    catch (error) {
        console.error('Failed to generate part upload URL:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate part upload URL'
        });
    }
});
// Complete multipart upload
router.post('/s3-complete/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { uploadId, key, parts } = req.body;
        if (!uploadId || !key || !parts) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required parameters for completing multipart upload'
            });
        }
        // Validate the upload token
        const uploadLink = await prisma.uploadLink.findUnique({
            where: { token },
            include: {
                project: {
                    include: {
                        client: true
                    }
                }
            }
        });
        if (!uploadLink || uploadLink.expiresAt < new Date()) {
            return res.status(403).json({
                status: 'error',
                message: 'Upload link is invalid or has expired'
            });
        }
        // Complete the multipart upload
        const result = await s3Service_1.s3Service.completeMultipartUpload(key, uploadId, parts);
        // Extract filename from the key - last part after the final slash
        // Should be in format: CLIENT/PROJECT/FILENAME
        const filename = key.split('/').pop() || 'unknown';
        // Create file record in database
        const uploadedFile = await prisma.uploadedFile.create({
            data: {
                name: filename,
                path: key,
                size: 0, // Size will be updated when we can retrieve it
                mimeType: 'application/octet-stream',
                hash: `multipart-${uploadId}`,
                project: {
                    connect: { id: uploadLink.projectId }
                },
                status: 'completed',
                completedAt: new Date(),
                storage: 's3',
                url: result.location
            }
        });
        // Update the upload link usage count
        await prisma.uploadLink.update({
            where: { id: uploadLink.id },
            data: { usedCount: { increment: 1 } }
        });
        res.json({
            status: 'success',
            location: result.location,
            fileId: uploadedFile.id
        });
    }
    catch (error) {
        console.error('Failed to complete multipart upload:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to complete multipart upload'
        });
    }
});
// Abort multipart upload
router.post('/s3-abort/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { uploadId, key } = req.query;
        if (!uploadId || !key) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required parameters: uploadId and key are required'
            });
        }
        // Validate the upload token
        const uploadLink = await prisma.uploadLink.findUnique({
            where: { token }
        });
        if (!uploadLink || uploadLink.expiresAt < new Date()) {
            return res.status(403).json({
                status: 'error',
                message: 'Upload link is invalid or has expired'
            });
        }
        // Abort the multipart upload
        await s3Service_1.s3Service.abortMultipartUpload(key, uploadId);
        res.json({
            status: 'success',
            message: 'Multipart upload aborted successfully'
        });
    }
    catch (error) {
        console.error('Failed to abort multipart upload:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to abort multipart upload'
        });
    }
});
// S3 upload callback endpoint - track files uploaded directly to S3
router.post('/s3-callback/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { key, size, filename, mimeType, hash } = req.body;
        if (!key || !filename) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required file information'
            });
        }
        // Validate the upload token
        const uploadLink = await prisma.uploadLink.findUnique({
            where: { token },
            include: {
                project: {
                    include: {
                        client: true
                    }
                }
            }
        });
        if (!uploadLink) {
            return res.status(404).json({
                status: 'error',
                message: 'Upload link not found'
            });
        }
        // Check if filename contains a UUID pattern
        const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-)/gi;
        const hasUuid = uuidRegex.test(key);
        // Generate a clean key without UUIDs if needed
        let cleanKey = key;
        let cleanFilename = filename;
        if (hasUuid) {
            // Extract client and project information
            const clientCode = uploadLink.project.client.code || 'default';
            const projectName = uploadLink.project.name || 'default';
            // Clean the filename by removing UUIDs
            cleanFilename = filename.replace(uuidRegex, '');
            // Generate clean key with the standard structure
            cleanKey = `${clientCode}/${projectName}/${cleanFilename}`;
            // Rename the file in S3
            try {
                // If key already has UUID prefix, rename it in S3
                if (key !== cleanKey) {
                    await s3Service_1.s3Service.renameObject(key, cleanKey);
                    logger_1.logger.info(`Renamed file in S3: ${key} -> ${cleanKey}`);
                }
            }
            catch (renameError) {
                logger_1.logger.error('Failed to rename file in S3:', renameError);
                // Continue with original key if rename fails
                cleanKey = key;
            }
        }
        // Generate the URL for the uploaded file
        const s3Endpoint = process.env.S3_ENDPOINT || 'http://minio:9000';
        const s3Bucket = process.env.S3_BUCKET || 'uploads';
        const fileUrl = `${s3Endpoint}/${s3Bucket}/${cleanKey}`;
        // Record the upload in the database
        const uploadedFile = await prisma.uploadedFile.create({
            data: {
                name: cleanFilename,
                path: cleanKey, // Use the clean key
                size: size ? parseFloat(size.toString()) : 0,
                mimeType: mimeType || 'application/octet-stream',
                hash: hash || 'unknown',
                project: {
                    connect: { id: uploadLink.projectId }
                },
                status: 'completed',
                completedAt: new Date(),
                storage: 's3',
                url: fileUrl
            }
        });
        // Update the upload link usage count
        await prisma.uploadLink.update({
            where: { id: uploadLink.id },
            data: { usedCount: { increment: 1 } }
        });
        // Track the upload using our tracking system
        const uploadId = `s3-${uploadedFile.id}`;
        uploadTracker_1.uploadTracker.trackUpload({
            id: uploadId,
            size: uploadedFile.size,
            offset: uploadedFile.size, // Already completed
            metadata: {
                filename: uploadedFile.name,
                filetype: uploadedFile.mimeType || '',
                token: token,
                clientName: uploadLink.project.client.name,
                projectName: uploadLink.project.name,
                storage: 's3'
            },
            createdAt: new Date(),
            isComplete: true
        });
        res.json({
            status: 'success',
            data: uploadedFile
        });
    }
    catch (error) {
        console.error('Failed to record S3 upload:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to record S3 upload'
        });
    }
});
// Add an endpoint to trigger S3 filename cleanup
router.post('/cleanup-filenames', auth_1.authenticateToken, async (_req, res) => {
    try {
        // Start the cleanup process
        await (0, fix_s3_filenames_1.fixS3Filenames)();
        res.json({
            status: 'success',
            message: 'S3 filename cleanup process completed successfully'
        });
    }
    catch (error) {
        console.error('Failed to run filename cleanup:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to run filename cleanup process'
        });
    }
});
exports.default = router;
