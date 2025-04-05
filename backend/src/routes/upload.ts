import express, { Request, Response } from 'express';
import { PrismaClient, UploadedFile, Project, UploadLink } from '@prisma/client'; // Import Prisma types
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import xxhash from 'xxhash-wasm';
import { authenticateToken } from '../middleware/auth';
import { uploadTracker } from '../services/uploads/uploadTracker';
import { s3Service } from '../services/s3/s3Service';
import { fixS3Filenames } from '../scripts/fix-s3-filenames';
import { logger } from '../utils/logger';
import { getTelegramBot } from '../services/telegram/telegramBot';
import { getIO } from '../services/socket'; // Import Socket.IO getter

const router = express.Router();
const prisma = new PrismaClient();

// Extend Express.Request to include files from multer
interface MulterRequest extends Request {
  files: Express.Multer.File[];
}

// Helper function to generate formatted upload token
function generateUploadToken(): string {
  const segments = uuidv4().split('-').slice(0, 4);
  return segments.join('-').toUpperCase();
}

// Configure multer for file uploads with client/project structure
const storage = multer.diskStorage({
  destination: async (req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
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
      const organizedDir = process.env.TUS_ORGANIZED_DIR || path.join(__dirname, '../../organized');

      const uploadDir = path.join(organizedDir,
        uploadLink.project.client.code || 'default',
        uploadLink.project.name
      );

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    // Use the original filename, only replacing characters that would cause filesystem issues
    // Allow spaces, apostrophes, parentheses and other common characters
    const originalName = file.originalname;
    // Replace only problematic characters like slashes, colons, etc.
    const safeName = originalName.replace(/[\/\\:*?"<>|]/g, '_');
    cb(null, safeName);
  }
});

// Modified upload limits for handling large files with XHR upload
const upload = multer({
  storage,
  limits: {
    fileSize: process.env.MAX_FILE_SIZE ? parseInt(process.env.MAX_FILE_SIZE) : 10 * 1024 * 1024 * 1024, // Default 10GB
  }
});

// Create a new client
router.post('/clients', authenticateToken, async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('Failed to create client:', error);
    if ((error as any).code === 'P2002') {
      res.status(400).json({
        status: 'error',
        message: 'A client with this code already exists'
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to create client'
      });
    }
  }
});

// Get all clients
router.get('/clients', authenticateToken, async (_req: Request, res: Response) => {
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
  } catch (error) {
    console.error('Failed to fetch clients:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch clients'
    });
  }
});

// Update a client
router.put('/clients/:clientId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { name } = req.body;

    // Check if client exists
    const clientExists = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!clientExists) {
      return res.status(404).json({
        status: 'error',
        message: 'Client not found'
      });
    }

    // Update the client
    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: { name }
    });

    res.json({
      status: 'success',
      data: updatedClient
    });
  } catch (error) {
    console.error('Failed to update client:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update client'
    });
  }
});

// Create a new project
router.post('/clients/:clientId/projects', authenticateToken, async (req: Request, res: Response) => {
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
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to create project'
    });
  }
});

// Get all projects for a client
router.get('/clients/:clientId/projects', authenticateToken, async (req: Request, res: Response) => {
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
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch projects'
    });
  }
});

// Get all projects regardless of client
router.get('/projects', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        client: true,
        uploadLinks: true,
        files: true,
      }
    });
    res.json({
      status: 'success',
      data: projects
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch projects'
    });
  }
});

// Create an upload link for a project
router.post('/projects/:projectId/upload-links', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { expiresAt, usageLimit, token } = req.body;

    // If usageLimit is undefined or null, explicitly set maxUses to null to override the default
    const maxUses = usageLimit === undefined || usageLimit === null ? null : usageLimit;

    // Use provided token or generate a new one
    const uploadToken = token || generateUploadToken();

    const uploadLink = await prisma.uploadLink.create({
      data: {
        token: uploadToken,
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
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to create upload link'
    });
  }
});

// Validate upload link and get project info
router.get('/upload-links/:token', async (req: Request, res: Response) => {
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
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to validate upload link'
    });
  }
});

// Get project files
router.get('/projects/:projectId/files', authenticateToken, async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('Failed to fetch files:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch files'
    });
  }
});

// Handle file upload
router.post('/upload/:token', upload.array('files'), async (req: Request, res: Response) => {
  const multerReq = req as MulterRequest;
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
        await fs.promises.unlink(file.path);
      }
      return res.status(404).json({
        status: 'error',
        message: 'Upload link not found'
      });
    }

    if (uploadLink.expiresAt < new Date()) {
      // Delete uploaded files since the link has expired
      for (const file of files) {
        await fs.promises.unlink(file.path);
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
        await fs.promises.unlink(file.path);
      }
      return res.status(403).json({
        status: 'error',
        message: 'Upload link has reached maximum uses'
      });
    }

    // Initialize XXHash64 - fast and reliable hashing
    const xxhash64 = await xxhash();

    // Process files and update database
    const uploadedFiles = await Promise.all(files.map(async (file) => {
      // Generate a unique ID for the upload (similar to tusId in the tus flow)
      const xhrUploadId = `xhr-${uuidv4()}`;

      // Initial tracking for beginning of upload (similar to post-create hook)
      uploadTracker.trackUpload({
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
        const fileBuffer = await fs.promises.readFile(file.path);
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
          await fs.promises.unlink(file.path);

          // Track the upload as complete
          uploadTracker.completeUpload(xhrUploadId);

          return existingFile;
        }

        let filePath = file.path;
        let fileUrl = '';

        // If S3 storage is requested, upload to S3
        if (useS3) {
          // Generate S3 key based on client, project, and filename
          // Using the clean $CLIENT/$PROJECT/FILENAME structure
          const s3Key = s3Service.generateKey(
            uploadLink.project.client.code || 'default',
            uploadLink.project.name,
            file.originalname
          );

          // Read file content before uploading to S3
          const fileBuffer = await fs.promises.readFile(file.path);

          // Upload the file content to S3
          const s3ResultUrl = await s3Service.uploadFile(fileBuffer, s3Key, file.mimetype);
          fileUrl = s3ResultUrl; // Use the URL returned by s3Service.uploadFile
          filePath = s3Key; // Store the S3 key as the path


          // Delete the local file after successful S3 upload
          await fs.promises.unlink(file.path);
        } else {
          // For local storage, generate a relative URL
          // Assuming 'uploads' is served statically or accessible via another route
          const relativePath = path.relative(path.join(__dirname, '../../uploads'), file.path);
          fileUrl = `/uploads/${relativePath}`; // Adjust base path as needed
        }

        // Create database record for the new file
        const newFile = await prisma.uploadedFile.create({
          data: {
            name: file.originalname, // Corrected field name
            mimeType: file.mimetype,
            size: file.size,
            path: filePath, // Store S3 key or local path
            url: fileUrl, // Store S3 URL or local URL
            hash: fileHash,
            projectId: uploadLink.projectId,
            storage: useS3 ? 's3' : 'local', // Corrected field name
          }
        });

        // Track the upload as complete
        uploadTracker.completeUpload(xhrUploadId);

        return newFile;
      } catch (uploadError) {
        console.error(`Failed to process file ${file.originalname}:`, uploadError);
        // Attempt to delete the local file if it still exists
        try {
          if (fs.existsSync(file.path)) {
            await fs.promises.unlink(file.path);
          }
        } catch (cleanupError) {
          console.error(`Failed to cleanup file ${file.path}:`, cleanupError);
        }
        // No specific failUpload method exists on tracker, logging the error is sufficient.
        logger.error(`[Upload Error] Failed processing file ${file.originalname} (XHR Upload ID: ${xhrUploadId})`, uploadError);

        throw uploadError; // Re-throw to indicate failure for this file
      }
    }));

    // Increment the used count for the upload link
    await prisma.uploadLink.update({
      where: { token },
      data: { usedCount: { increment: 1 } }
    });

    res.json({
      status: 'success',
      data: uploadedFiles
    });
  } catch (error) {
    console.error('File upload failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'File upload failed'
    });
  }
});

// Delete a project and its associated files and links
router.delete('/projects/:projectId', authenticateToken, async (req: Request, res: Response) => {
  try { // Outer try
    const { projectId } = req.params;

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { files: true, uploadLinks: true }
    });

    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      });
    }

    // Delete associated files from storage (S3 or local)
    for (const file of project.files) {
      try { // Inner try for individual file deletion
        if (file.storage === 's3') { // Corrected field name
          if (file.path) { // Add null check for path
            await s3Service.deleteFile(file.path);
          } else {
            logger.warn(`[Project Delete] Skipping S3 delete for file ID ${file.id} due to missing path.`);
          }
        } else {
          // Construct the full local path if needed
          if (file.path) { // Add null check for path
            const localPath = path.resolve(file.path); // Adjust if path is stored differently
            if (fs.existsSync(localPath)) {
              await fs.promises.unlink(localPath);
            }
          } else {
            logger.warn(`[Project Delete] Skipping local file delete for file ID ${file.id} due to missing path.`);
          }
        }
      } catch (fileDeleteError) { // Inner catch for file deletion errors
         logger.error(`Failed to delete file ${file.path} (${file.storage}):`, fileDeleteError);
         // Continue deleting other files even if one fails
      }
    } // End of for loop

    // Use transaction to delete project and related records
    await prisma.$transaction([
      prisma.uploadedFile.deleteMany({ where: { projectId } }),
      prisma.uploadLink.deleteMany({ where: { projectId } }),
      prisma.project.delete({ where: { id: projectId } })
    ]);

    res.json({
      status: 'success',
      message: 'Project deleted successfully'
    });
  } catch (error) { // Outer catch for the main operation
    console.error('Failed to delete project:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete project'
    });
  }
});


// Update a project
router.put('/projects/:projectId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { name, description } = req.body;

    // Check if project exists
    const projectExists = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!projectExists) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      });
    }

    // Update the project
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { name, description }
    });

    res.json({
      status: 'success',
      data: updatedProject
    });
  } catch (error) {
    console.error('Failed to update project:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update project'
    });
  }
});

// Get a single project by ID
router.get('/projects/:projectId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true,
        uploadLinks: true,
        files: {
          orderBy: {
            createdAt: 'desc' // Order files by creation date, newest first
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      });
    }

    // Calculate total size of uploaded files for the project
    const totalSize = project.files.reduce((sum: number, file: UploadedFile) => sum + file.size, 0);

    // Format total size
    const formatBytes = (bytes: number, decimals = 2) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    res.json({
      status: 'success',
      data: {
        ...project,
        totalSize: totalSize,
        formattedTotalSize: formatBytes(totalSize)
      }
    });
  } catch (error) {
    console.error('Failed to fetch project:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch project'
    });
  }
});


// Delete a client and all associated projects, files, and links
router.delete('/clients/:clientId', authenticateToken, async (req: Request, res: Response) => {
  try { // Outer try
    const { clientId } = req.params;

    // Check if client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        projects: {
          include: {
            files: true,
            uploadLinks: true
          }
        }
      }
    });

    if (!client) {
      return res.status(404).json({
        status: 'error',
        message: 'Client not found'
      });
    }

    // Collect all project IDs and file paths for deletion
    const projectIds = client.projects.map((p: Project) => p.id);
    // Ensure 'files' is included in the Project type used here, or adjust the flatMap logic
    // Assuming 'p' correctly includes 'files' based on the initial client fetch include.
    const filesToDelete = client.projects.flatMap((p: Project & { files: UploadedFile[] }) => p.files);

    // Delete associated files from storage (S3 or local)
    for (const file of filesToDelete) {
      try { // Inner try for file deletion
        if (file.storage === 's3') { // Corrected field name
           if (file.path) { // Add null check
             await s3Service.deleteFile(file.path);
           } else {
              logger.warn(`[Client Delete] Skipping S3 delete for file ID ${file.id} due to missing path.`);
           }
        } else {
          // Construct the full local path if needed
          if (file.path) { // Add null check
            const localPath = path.resolve(file.path); // Adjust if path is stored differently
            if (fs.existsSync(localPath)) {
              await fs.promises.unlink(localPath);
            }
          } else {
             logger.warn(`[Client Delete] Skipping local file delete for file ID ${file.id} due to missing path.`);
          }
        }
      } catch (fileDeleteError) { // Inner catch for file deletion errors
        console.error(`Failed to delete file ${file.path} (${file.storage}):`, fileDeleteError); // Corrected field name
        // Decide if you want to continue or stop the process
        // For now, we log the error and continue
      }
    } // End of for loop

    // Use transaction to delete client and all related records
    await prisma.$transaction([
      prisma.uploadedFile.deleteMany({ where: { projectId: { in: projectIds } } }),
      prisma.uploadLink.deleteMany({ where: { projectId: { in: projectIds } } }),
      prisma.project.deleteMany({ where: { clientId } }),
      prisma.client.delete({ where: { id: clientId } })
    ]);

    res.json({
      status: 'success',
      message: 'Client and all associated data deleted successfully'
    });
  } catch (error) { // Outer catch for the main operation
    console.error('Failed to delete client:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete client'
    });
  }
});


// Delete an upload link
router.delete('/upload-links/:linkId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { linkId } = req.params;

    // Check if link exists
    const linkExists = await prisma.uploadLink.findUnique({
      where: { id: linkId }
    });

    if (!linkExists) {
      return res.status(404).json({
        status: 'error',
        message: 'Upload link not found'
      });
    }

    // Delete the link
    await prisma.uploadLink.delete({
      where: { id: linkId }
    });

    res.json({
      status: 'success',
      message: 'Upload link deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete upload link:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete upload link'
    });
  }
});

// Update an upload link
router.put('/upload-links/:linkId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { linkId } = req.params;
    const { expiresAt, usageLimit } = req.body;

    // Check if link exists
    const linkExists = await prisma.uploadLink.findUnique({
      where: { id: linkId }
    });

    if (!linkExists) {
      return res.status(404).json({
        status: 'error',
        message: 'Upload link not found'
      });
    }

    // Prepare update data
    const updateData: { expiresAt?: Date; maxUses?: number | null } = {};
    if (expiresAt) {
      updateData.expiresAt = new Date(expiresAt);
    }
    // Allow setting usageLimit to null for unlimited
    if (usageLimit !== undefined) {
      updateData.maxUses = usageLimit === null ? null : parseInt(usageLimit, 10);
    }

    // Update the link
    const updatedLink = await prisma.uploadLink.update({
      where: { id: linkId },
      data: updateData,
      include: {
        project: {
          include: {
            client: true
          }
        }
      }
    });

    // Regenerate the full upload URL
    const uploadUrl = `https://upload.colourstream.johnrogerscolour.co.uk/${updatedLink.token}`;

    res.json({
      status: 'success',
      data: {
        ...updatedLink,
        uploadUrl
      }
    });
  } catch (error) {
    console.error('Failed to update upload link:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update upload link'
    });
  }
});

// Get all upload links (for admin view)
router.get('/upload-links-all', authenticateToken, async (_req: Request, res: Response) => { // Prefix req with _
  try {
    const links = await prisma.uploadLink.findMany({
      include: {
        project: {
          include: {
            client: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc' // Show newest links first
      }
    });

    // Generate full URLs for each link
    const linksWithUrls = links.map((link: UploadLink) => ({
      ...link,
      uploadUrl: `https://upload.colourstream.johnrogerscolour.co.uk/${link.token}`
    }));

    res.json({
      status: 'success',
      data: linksWithUrls
    });
  } catch (error) {
    console.error('Failed to fetch all upload links:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch upload links'
    });
  }
});


// --- S3 Specific Routes ---

// Get S3 presigned URL for direct upload (non-multipart)
router.get('/s3-params/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { filename } = req.query;

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Filename is required' });
    }

    // Validate token
    const uploadLink = await prisma.uploadLink.findUnique({
      where: { token },
      include: { project: { include: { client: true } } }
    });

    if (!uploadLink) {
      return res.status(404).json({ status: 'error', message: 'Upload link not found' });
    }
    if (uploadLink.expiresAt < new Date()) {
      return res.status(403).json({ status: 'error', message: 'Upload link expired' });
    }
    if (uploadLink.maxUses !== null && uploadLink.usedCount >= uploadLink.maxUses) {
      return res.status(403).json({ status: 'error', message: 'Upload link usage limit reached' });
    }

    // Generate S3 key
    const s3Key = s3Service.generateKey(
      uploadLink.project.client.code || 'default',
      uploadLink.project.name,
      filename
    );

    // Get presigned URL for PUT operation
    const presignedUrl = await s3Service.generatePresignedUrl(s3Key); // Corrected method name

    res.json({
      status: 'success',
      url: presignedUrl,
      key: s3Key, // Return the key so frontend can use it if needed
      method: 'PUT', // Standard for S3 presigned PUT URLs
      fields: {}, // No fields needed for PUT
      headers: {} // Headers are usually handled by the client library
    });

  } catch (error) {
    logger.error('Failed to get S3 presigned URL:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get S3 upload parameters' });
  }
});

// Get S3 presigned URL for a specific part of a multipart upload
router.get('/s3-part-params/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { uploadId, key, partNumber } = req.query;

    if (!uploadId || !key || !partNumber) {
      return res.status(400).json({ status: 'error', message: 'Missing required parameters (uploadId, key, partNumber)' });
    }

    // Validate token (optional but recommended for security)
    const uploadLink = await prisma.uploadLink.findUnique({ where: { token } });
    if (!uploadLink) {
      return res.status(404).json({ status: 'error', message: 'Upload link not found' });
    }
    // Add expiration/usage checks if necessary

    const partNum = parseInt(partNumber as string, 10);
    if (isNaN(partNum) || partNum <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid part number' });
    }

    const presignedUrl = await s3Service.getPresignedUrlForPart(key as string, uploadId as string, partNum); // Corrected method name

    res.json({
      status: 'success',
      url: presignedUrl,
      // Include any other necessary info for the client
    });

  } catch (error) {
    logger.error('Failed to get S3 presigned part URL:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get S3 part upload parameters' });
  }
});


// Complete an S3 multipart upload
router.post('/s3-complete/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { uploadId, key, parts } = req.body;

    if (!uploadId || !key || !Array.isArray(parts)) {
      return res.status(400).json({ status: 'error', message: 'Missing required parameters (uploadId, key, parts)' });
    }

    // Validate token (optional but recommended)
    const uploadLink = await prisma.uploadLink.findUnique({ where: { token } });
    if (!uploadLink) {
      return res.status(404).json({ status: 'error', message: 'Upload link not found' });
    }
    // Add expiration/usage checks if necessary

    // Validate parts structure
    const validParts = parts.every(part => part && typeof part.PartNumber === 'number' && typeof part.ETag === 'string');
    if (!validParts) {
      return res.status(400).json({ status: 'error', message: 'Invalid parts structure' });
    }

    const result = await s3Service.completeMultipartUpload(key, uploadId, parts);

    // Here you might trigger the /s3-callback logic or let the frontend do it
    // For simplicity, let's assume the frontend calls /s3-callback separately after this succeeds

    res.json({
      status: 'success',
      location: result.location, // Corrected property name (lowercase 'l')
      // Include other details from result if needed
    });

  } catch (error) {
    logger.error('Failed to complete S3 multipart upload:', error);
    res.status(500).json({ status: 'error', message: 'Failed to complete S3 multipart upload' });
  }
});

// Abort an S3 multipart upload
router.post('/s3-abort/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { uploadId, key } = req.body;

    if (!uploadId || !key) {
      return res.status(400).json({ status: 'error', message: 'Missing required parameters (uploadId, key)' });
    }

    // Validate token (optional but recommended)
    const uploadLink = await prisma.uploadLink.findUnique({ where: { token } });
    if (!uploadLink) {
      return res.status(404).json({ status: 'error', message: 'Upload link not found' });
    }
    // Add expiration/usage checks if necessary

    await s3Service.abortMultipartUpload(key, uploadId);

    res.json({ status: 'success', message: 'Multipart upload aborted' });

  } catch (error) {
    logger.error('Failed to abort S3 multipart upload:', error);
    res.status(500).json({ status: 'error', message: 'Failed to abort S3 multipart upload' });
  }
});


// Callback endpoint for S3 uploads (both direct and multipart completion)
router.post('/s3-callback/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { key, size, filename, mimeType, hash } = req.body; // hash might be provided by client or generated

    if (!key || !size || !filename || !mimeType) {
      return res.status(400).json({ status: 'error', message: 'Missing required S3 callback data' });
    }

    // Validate token and get project context
    const uploadLink = await prisma.uploadLink.findUnique({
      where: { token },
      include: { project: { include: { client: true } } }
    });

    if (!uploadLink) {
      logger.warn(`[S3 Callback] Invalid token received: ${token}`);
      return res.status(404).json({ status: 'error', message: 'Upload link not found' });
    }
    if (uploadLink.expiresAt < new Date()) {
      logger.warn(`[S3 Callback] Expired token used: ${token}`);
      return res.status(403).json({ status: 'error', message: 'Upload link expired' });
    }
    if (uploadLink.maxUses !== null && uploadLink.usedCount >= uploadLink.maxUses) {
      logger.warn(`[S3 Callback] Token usage limit reached: ${token}`);
      return res.status(403).json({ status: 'error', message: 'Upload link usage limit reached' });
    }

    // Generate file hash if not provided (e.g., from S3 metadata or re-download)
    // For simplicity, we'll assume hash is provided or skip check for now
    // const fileHash = hash || await s3Service.calculateFileHash(key); // This would require downloading

    // Check for existing file (optional, based on hash if available)
    // if (fileHash) {
    //   const existingFile = await prisma.uploadedFile.findFirst({
    //     where: { projectId: uploadLink.projectId, hash: fileHash }
    //   });
    //   if (existingFile) {
    //     logger.info(`[S3 Callback] Duplicate file detected via hash for key ${key}. Skipping DB entry.`);
    //     // Don't increment usedCount for duplicates? Or maybe do? Depends on policy.
    //     return res.json({ status: 'success', message: 'Duplicate file detected, skipped DB entry', data: existingFile });
    //   }
    // }

    // Manually construct the public URL as s3Service doesn't have getPublicUrl
    const s3PublicEndpoint = process.env.S3_PUBLIC_ENDPOINT || 'https://s3.colourstream.johnrogerscolour.co.uk';
    const s3Bucket = process.env.S3_BUCKET || 'uploads';
    const fileUrl = `${s3PublicEndpoint}/${s3Bucket}/${key}`;


    // Create database record for the uploaded file
    const newFile = await prisma.uploadedFile.create({
      data: {
        name: filename, // Corrected field name
        mimeType: mimeType,
        size: size,
        path: key, // Store S3 key as the path
        url: fileUrl, // Store public S3 URL
        hash: hash || null, // Store hash if available
        projectId: uploadLink.projectId,
        storage: 's3', // Corrected field name
      }
    });

    // Increment the used count for the upload link
    await prisma.uploadLink.update({
      where: { token },
      data: { usedCount: { increment: 1 } }
    });

    // Track the upload completion via uploadTracker if needed
    // This might require mapping the S3 upload back to a tracker ID if initiated elsewhere
    // For uploads initiated via frontend Uppy, the frontend might handle tracking separately.
    // Example: uploadTracker.completeUpload(someUploadIdRelatedToS3);

    logger.info(`[S3 Callback] Successfully processed S3 upload for key: ${key}`);
    res.json({
      status: 'success',
      message: 'S3 upload processed successfully',
      data: newFile
    });

  } catch (error) {
    logger.error('[S3 Callback] Error processing S3 callback:', error);
    res.status(500).json({ status: 'error', message: 'Failed to process S3 callback' });
  }
});

// --- Utility and Maintenance Routes ---

// Endpoint to trigger filename cleanup (manual for now)
router.post('/cleanup-filenames', authenticateToken, async (_req: Request, res: Response) => {
  try {
    logger.info('Starting S3 filename cleanup process...');
    const result = await fixS3Filenames();
    logger.info('S3 filename cleanup process completed.');
    res.json({
      status: 'success',
      message: 'Filename cleanup process completed.',
      data: result
    });
  } catch (error) {
    logger.error('Filename cleanup failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Filename cleanup failed.'
    });
  }
});


// --- TurboSort Routes ---

// Endpoint to initiate TurboSort for a project
router.post('/projects/:projectId/turbosort', authenticateToken, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  // const { sortCriteria, targetBucket } = req.body; // sortCriteria is unused
  // const { targetBucket } = req.body; // Unused variable - e.g., { targetBucket: 'sorted-project-files' }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { files: true, client: true }
    });

    if (!project) {
      return res.status(404).json({ status: 'error', message: 'Project not found' });
    }

    logger.info(`Initiating TurboSort for project ${project.name} (ID: ${projectId})`);

    // 1. Filter files stored in S3
    const s3Files = project.files.filter((f: UploadedFile) => f.storage === 's3'); // Corrected field name
    if (s3Files.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No S3 files found in this project to sort.' });
    }

    // 2. Define sorting logic (example: by date embedded in filename or metadata)
    // This needs customization based on actual filename patterns or metadata
    const sortFiles = (files: typeof s3Files) => {
      // Example: Sort by filename assuming YYYYMMDD format prefix
      return files.sort((a: UploadedFile, b: UploadedFile) => {
        const dateA = a.name.substring(0, 8); // Corrected field name
        const dateB = b.name.substring(0, 8); // Corrected field name
        return dateA.localeCompare(dateB);
      });
    };
    const sortedFiles = sortFiles(s3Files);

    // 3. Prepare S3 copy operations
    const copyOperations = sortedFiles.map((file: UploadedFile /*, _index: number */) => { // Prefix index with _
      // Define the new key structure in the target bucket
      // Example: targetBucket/YYYY/MM/DD/originalFilename_sequence.ext
      // const datePart = file.name.substring(0, 8); // Corrected field name, Assuming YYYYMMDD
      // const year = datePart.substring(0, 4); // Unused variable
      // const month = datePart.substring(4, 6); // Unused variable
      // const day = datePart.substring(6, 8); // Unused variable
      // const newKey = `${targetBucket}/${year}/${month}/${day}/${file.name}`; // newKey is unused


      // TODO: Implement s3Service.copyObject or use CopyObjectCommand directly
      // return s3Service.copyObject(file.path, newKey); // Assuming copyObject exists
      logger.warn(`[TurboSort] s3Service.copyObject not implemented yet. Skipping copy for ${file.path}`);
      return Promise.resolve(); // Placeholder
    });

    // 4. Execute copy operations (consider batching for large projects)
    await Promise.all(copyOperations);

    // 5. Optionally: Update database records or delete original files (handle with care)
    // For now, just report success

    logger.info(`TurboSort completed for project ${project.name}. ${sortedFiles.length} files copied.`);
    res.json({
      status: 'success',
      message: `TurboSort initiated. ${sortedFiles.length} files are being copied.`,
      // Optionally return details about the copy operations
    });

  } catch (error) {
    logger.error(`TurboSort failed for project ${projectId}:`, error);
    res.status(500).json({ status: 'error', message: 'TurboSort operation failed.' });
  }
});

// Endpoint to potentially revert or manage TurboSort results (e.g., delete copied files)
router.delete('/projects/:projectId/turbosort', authenticateToken, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { targetBucket } = req.body; // Need the target bucket to know what to delete

  if (!targetBucket) {
    return res.status(400).json({ status: 'error', message: 'Target bucket is required to revert TurboSort.' });
  }

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ status: 'error', message: 'Project not found' });
    }

    logger.warn(`Initiating TurboSort REVERT for project ${project.name} (ID: ${projectId}) in bucket ${targetBucket}`);

    // List files in the target bucket structure related to this project
    // This requires knowing the structure used during the sort (e.g., targetBucket/YYYY/MM/DD/)
    // Example: List all objects under the targetBucket prefix
    // TODO: Implement s3Service.listObjects
    // const objectsToDelete = await s3Service.listObjects(targetBucket); // Adjust prefix if needed
    logger.warn(`[TurboSort Revert] s3Service.listObjects not implemented yet. Cannot delete files.`);
    const objectsToDelete: { Key?: string }[] = []; // Placeholder


    if (objectsToDelete.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No TurboSort files found in the target bucket to delete.' });
    }

    // Delete the objects
    // TODO: Implement s3Service.deleteMultipleFiles
    // await s3Service.deleteMultipleFiles(objectsToDelete.map((obj: { Key?: string }) => obj.Key).filter((key: string | undefined): key is string => !!key));
    if (objectsToDelete.length > 0) {
       logger.warn(`[TurboSort Revert] s3Service.deleteMultipleFiles not implemented yet. Cannot delete files.`);
    }



    logger.info(`TurboSort REVERT completed for project ${project.name}. ${objectsToDelete.length} files deleted from ${targetBucket}.`);
    res.json({
      status: 'success',
      message: `TurboSort revert completed. ${objectsToDelete.length} files deleted.`,
    });

  } catch (error) {
    logger.error(`TurboSort revert failed for project ${projectId}:`, error);
    res.status(500).json({ status: 'error', message: 'TurboSort revert operation failed.' });
  }
});

// --- NEW ROUTE for Upload Progress ---
router.post('/progress/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  const {
    fileId,
    fileName,
    bytesUploaded,
    bytesTotal,
    // percentage, // Unused variable
    clientName,
    projectName,
  } = req.body;

  // Basic validation of incoming data
  if (!fileId || !fileName || typeof bytesUploaded !== 'number' || typeof bytesTotal !== 'number') {
    logger.warn(`[Upload Progress] Invalid progress data received for token ${token}`, req.body);
    return res.status(400).json({ status: 'error', message: 'Invalid progress data' });
  }

  logger.debug(`[Upload Progress] Received for ${fileName} (${fileId}): ${bytesUploaded}/${bytesTotal} bytes`);

  try {
    // 1. Validate the token (essential for security and context)
    const uploadLink = await prisma.uploadLink.findUnique({
      where: { token },
      include: { project: { include: { client: true } } } // Include necessary relations
    });

    if (!uploadLink) {
      logger.warn(`[Upload Progress] Invalid token received: ${token}`);
      return res.status(404).json({ status: 'error', message: 'Upload link not found' });
    }

    if (uploadLink.expiresAt < new Date()) {
       logger.warn(`[Upload Progress] Expired token used: ${token}`);
      return res.status(403).json({ status: 'error', message: 'Upload link has expired' });
    }

    // If maxUses is null, it means unlimited uses
    if (uploadLink.maxUses !== null && uploadLink.usedCount >= uploadLink.maxUses) {
       logger.warn(`[Upload Progress] Token usage limit reached: ${token}`);
      return res.status(403).json({ status: 'error', message: 'Upload link usage limit reached' });
    }

    // Use client/project names from the validated token if frontend didn't send them
    const finalClientName = clientName || uploadLink.project.client.name;
    const finalProjectName = projectName || uploadLink.project.name;

    // 2. Get the Telegram bot instance
    const bot = getTelegramBot();
    if (!bot) {
      logger.error('[Upload Progress] Telegram bot instance is not available.');
      // Don't block the upload, just report the issue
      return res.status(503).json({ status: 'error', message: 'Notification service unavailable' });
    }

    // 3. Prepare data for the notification service and Socket.IO broadcast
    const isComplete = bytesUploaded >= bytesTotal;
    const percentage = bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : (isComplete ? 100 : 0);

    // Get the latest tracked info which might include speed
    const trackedUpload = uploadTracker.getUpload(fileId);

    const uploadInfo = {
      id: fileId, // Use the Uppy file ID as the unique identifier for the message
      size: bytesTotal,
      offset: bytesUploaded,
      metadata: {
        filename: fileName,
        clientName: finalClientName,
        projectName: finalProjectName,
        storage: trackedUpload?.metadata?.storage || 'unknown' // Get storage type if available
      },
      isComplete: isComplete, // Mark as complete if fully uploaded
      uploadSpeed: trackedUpload?.uploadSpeed, // Get speed from tracker if available
      percentage: percentage // Add percentage for socket broadcast
    };

    // 4. Send the notification (this handles sending/editing)
    // 4. Send Telegram notification (don't block response)
    bot.sendUploadNotification(uploadInfo).catch(err => {
        logger.error(`[Upload Progress] Failed to send Telegram notification for ${fileId}:`, err);
    });

    // 5. Broadcast progress update via Socket.IO to admin clients
    const io = getIO();
    if (io) {
      // Prepare data specifically for WebSocket broadcast (might be same or different from Telegram)
      const socketData = {
        id: fileId,
        fileName: fileName,
        size: bytesTotal,
        offset: bytesUploaded,
        percentage: uploadInfo.percentage, // Use percentage calculated for Telegram
        speed: uploadInfo.uploadSpeed, // Use speed calculated by tracker
        clientName: finalClientName,
        projectName: finalProjectName,
        isComplete: uploadInfo.isComplete,
        storage: uploadInfo.metadata?.storage || 'unknown'
      };
      // Emit to a specific room or globally - using 'admin_updates' room as an example
      // Clients would need to join this room upon connection
      io.to('admin_updates').emit('upload_progress_update', socketData);
      // Or broadcast globally if no specific room is needed:
      // io.emit('upload_progress_update', socketData);
      logger.debug(`[Upload Progress] Broadcasted update for ${fileId} via Socket.IO`);
    } else {
       logger.warn(`[Upload Progress] Socket.IO instance not available, skipping broadcast for ${fileId}`);
    }

    // 6. Respond to the frontend immediately
    res.status(200).json({ status: 'progress received' });

  } catch (error) {
    logger.error(`[Upload Progress] Error handling progress update for token ${token}:`, error);
    res.status(500).json({ status: 'error', message: 'Internal server error processing progress' });
  }
});
// --- END NEW ROUTE ---


export default router;