import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs'; // Import standard fs for sync methods
import fsPromises from 'fs/promises'; // Import promises API separately
import { v4 as uuidv4 } from 'uuid';
import xxhash from 'xxhash-wasm';
import { authenticateToken } from '../middleware/auth';
import { uploadTracker } from '../services/uploads/uploadTracker';
import { s3Service } from '../services/s3/s3Service';
import { s3FileProcessor } from '../services/s3/s3FileProcessor'; // Corrected casing
import { logger } from '../utils/logger';
import { getTelegramBot } from '../services/telegram/telegramBot';
import { CompletedPart } from '@aws-sdk/client-s3';

const router = express.Router();
const prisma = new PrismaClient();

// --- In-memory storage for Tusd upload progress ---
// Note: This is basic and will be lost on server restart.
// Consider Redis or a database for production.
interface TusdUploadInfo {
  token: string;
  clientName?: string;
  projectName?: string;
  storage: 'local' | 's3';
  // Optional fields, potentially populated later or from hooks/cache
  size?: number;
  filename?: string;
}
const tusdProgressCache = new Map<string, TusdUploadInfo>();
const TUSD_DATA_DIR = process.env.TUSD_DATA_DIR || '/srv/tusd-data'; // Get tusd data dir
// --- End In-memory storage ---


// --- Helper Function to Get Upload Details ---
async function getUploadDetails(uploadId: string, providedToken?: string): Promise<TusdUploadInfo | null> {
  logger.info(`[getUploadDetails] Fetching details for uploadId: ${uploadId}`);
  // 1. Check cache first
  const cachedInfo = tusdProgressCache.get(uploadId);
  if (cachedInfo?.clientName && cachedInfo?.projectName) {
    logger.info(`[getUploadDetails] Found complete info in cache for ${uploadId}`);
    return cachedInfo;
  }

  let token = providedToken || cachedInfo?.token;
  let size = cachedInfo?.size;
  let filename = cachedInfo?.filename;
  let storage = cachedInfo?.storage || 'local'; // Default to local if not cached

  // 2. If token is missing, try reading from .info file
  if (!token) {
    const infoFilePath = path.join(TUSD_DATA_DIR, `${uploadId}.info`);
    logger.info(`[getUploadDetails] Token not provided or cached, reading info file: ${infoFilePath}`);
    try {
      const infoContent = await fsPromises.readFile(infoFilePath, 'utf-8'); // Use fsPromises
      const infoData = JSON.parse(infoContent);
      token = infoData?.MetaData?.token; // Extract token
      size = infoData?.Size; // Extract size
      filename = infoData?.MetaData?.filename; // Extract filename
      // storage = infoData?.Storage?.Type === 's3' ? 's3' : 'local'; // Potentially get storage type

      if (!token) {
        logger.error(`[getUploadDetails] Token not found in .info file for ${uploadId}`);
        return null; // Cannot proceed without a token
      }
      logger.info(`[getUploadDetails] Extracted token, size, filename from .info file for ${uploadId}`);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        logger.error(`[getUploadDetails] .info file not found for ${uploadId} at ${infoFilePath}`);
      } else {
        logger.error(`[getUploadDetails] Error reading or parsing .info file for ${uploadId}:`, err);
      }
      return null; // Cannot proceed if file reading fails
    }
  }

  // 3. If we have a token, query the database
  if (token) {
    logger.info(`[getUploadDetails] Querying database with token for ${uploadId}`);
    try {
      const uploadLink = await prisma.uploadLink.findUnique({
        where: { token },
        include: { project: { include: { client: true } } }
      });

      if (uploadLink) {
        const fullInfo: TusdUploadInfo = {
          token: token,
          clientName: uploadLink.project.client.name,
          projectName: uploadLink.project.name,
          // Use size/filename from cache/file if available, otherwise set defaults
          size: size ?? 0,
          filename: filename ?? 'Unknown Filename',
          storage: storage,
        };
        // Update cache with full details
        tusdProgressCache.set(uploadId, fullInfo);
        logger.info(`[getUploadDetails] Successfully fetched info from DB and updated cache for ${uploadId}`);
        return fullInfo;
      } else {
        logger.error(`[getUploadDetails] Invalid token '${token}' found for ${uploadId}. Cannot fetch DB details.`);
        // Cache minimal info to avoid re-reading file, but mark as invalid?
         tusdProgressCache.set(uploadId, { token, storage, size: size ?? 0, filename: filename ?? 'Unknown Filename', clientName: 'Invalid Token', projectName: 'Invalid Token' });
        return null;
      }
    } catch (dbError) {
      logger.error(`[getUploadDetails] Database error fetching details for token ${token} (uploadId ${uploadId}):`, dbError);
      return null;
    }
  }

  // Should not reach here if logic is correct, but return null as fallback
  logger.warn(`[getUploadDetails] Could not retrieve details for ${uploadId}`);
  return null;
}
// --- End Helper Function ---


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

      if (!fs.existsSync(uploadDir)) { // Use standard fs for sync check
        fs.mkdirSync(uploadDir, { recursive: true }); // Use standard fs for sync creation
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
        clientCode: uploadLink.project.client.code, // Use client code for consistency
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
        await fsPromises.unlink(file.path); // Use fsPromises
      }
      return res.status(404).json({
        status: 'error',
        message: 'Upload link not found'
      });
    }

    if (uploadLink.expiresAt < new Date()) {
      // Delete uploaded files since the link has expired
      for (const file of files) {
        await fsPromises.unlink(file.path); // Use fsPromises
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
        await fsPromises.unlink(file.path); // Use fsPromises
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
        const fileBuffer = await fsPromises.readFile(file.path); // Use fsPromises
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
          await fsPromises.unlink(file.path); // Use fsPromises

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

          // Enhanced logging for debugging filename issues
          console.log(`File upload request - Original filename: "${file.originalname}"`);
          console.log(`Generated S3 key: "${s3Key}" for file: "${file.originalname}"`);
          console.log(`Client code: "${uploadLink.project.client.code || 'default'}", Project name: "${uploadLink.project.name}"`);

          // Log the generated S3 key for debugging
          console.log(`Generated S3 key for upload: ${s3Key} for file: ${file.originalname}`);

          // Upload file to S3
          fileUrl = await s3Service.uploadFile(
            fileBuffer,
            s3Key,
            file.mimetype,
            {
              clientName: uploadLink.project.client.name,
              projectName: uploadLink.project.name,
              originalName: file.originalname
            }
          );

          // Delete the local file after successful S3 upload
          await fsPromises.unlink(file.path); // Use fsPromises

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
        uploadTracker.completeUpload(xhrUploadId);

        return uploadedFile;
      } catch (error) {
        console.error('Error processing file:', error);
        
        // Track upload error
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
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to process upload'
    });
  }
});

// Delete a project
router.delete('/projects/:projectId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    // Get project with all associated files
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        files: true,
        client: true
      }
    });

    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      });
    }

    // Delete all files from S3
    for (const file of project.files) {
      if (file.storage === 's3' && file.path) {
        try {
          await s3Service.deleteFile(file.path);
          console.log(`Deleted file from S3: ${file.path}`);
        } catch (s3Error) {
          console.error(`Failed to delete file from S3: ${file.path}`, s3Error);
          // Continue with deletion even if S3 deletion fails
        }
      }
    }

    // Delete the project (cascading delete will handle upload links)
    await prisma.project.delete({
      where: { id: projectId }
    });

    res.json({
      status: 'success',
      message: 'Project deleted successfully'
    });
  } catch (error) {
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
      data: { 
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined
      },
      include: {
        client: true
      }
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

// Get a single project
router.get('/projects/:projectId', authenticateToken, async (req: Request, res: Response) => {
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

    // Check if .turbosort file exists for this project
    // Note: The turbosort directory is stored in a .turbosort file in the project directory,
    // not in the database. This allows for easier integration with external file-based tools.
    let turbosortContent = null;
    try {
      // Construct the path to the project directory
      const projectPath = path.join(process.env.UPLOAD_DIR || 'uploads', projectId);
      const turbosortPath = path.join(projectPath, '.turbosort');
      
      // Check if the file exists locally
      if (fs.existsSync(turbosortPath)) { // Use standard fs for sync check
        // Read the content of the .turbosort file
        turbosortContent = fs.readFileSync(turbosortPath, 'utf8').trim(); // Use standard fs for sync read
      }
      // If not found locally and we have client info, try to get from S3
      else if (project.client && project.client.code) {
        try {
          // Generate S3 key based on client and project name
          const s3Key = s3Service.generateKey(
            project.client.code,
            project.name,
            '.turbosort'
          );

          // Try to get the file from S3
          const s3Object = await s3Service.getFileContent(s3Key);
          if (s3Object) {
            turbosortContent = s3Object.toString('utf8').trim();
            
            // Cache the S3 content locally for future use
            if (!fs.existsSync(projectPath)) { // Use standard fs for sync check
              fs.mkdirSync(projectPath, { recursive: true }); // Use standard fs for sync creation
            }
            fs.writeFileSync(turbosortPath, turbosortContent); // Use standard fs for sync write
            console.log(`Cached turbosort file from S3 to local path: ${turbosortPath}`);
          }
        } catch (s3Error) {
          console.error('Failed to get turbosort file from S3:', s3Error);
          // Don't fail the request if we can't get the file from S3
        }
      }
    } catch (err) {
      console.error('Error reading .turbosort file:', err);
      // Don't fail the request if we can't read the file
    }

    // Add the turbosort content to the response
    res.json({
      status: 'success',
      data: {
        ...project,
        turbosortDirectory: turbosortContent
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

// Delete a client
router.delete('/clients/:clientId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    
    // Check if client exists and get all associated data
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

    // Delete all files from S3 for each project
    for (const project of client.projects) {
      for (const file of project.files) {
        if (file.storage === 's3' && file.path) {
          try {
            await s3Service.deleteFile(file.path);
            console.log(`Deleted file from S3: ${file.path}`);
          } catch (s3Error) {
            console.error(`Failed to delete file from S3: ${file.path}`, s3Error);
            // Continue with deletion even if S3 deletion fails
          }
        }
      }
    }
    
    // Delete the client (cascading delete will handle projects and upload links)
    await prisma.client.delete({
      where: { id: clientId }
    });
    
    res.json({
      status: 'success',
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete client:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to delete client. Make sure there are no active uploads for this client.'
    });
  }
});

// Delete an upload link
router.delete('/upload-links/:linkId', authenticateToken, async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('Failed to delete upload link:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to delete upload link'
    });
  }
});

// Update upload link
router.put('/upload-links/:linkId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { linkId } = req.params;
    const { expiresAt, maxUses } = req.body;
    
    // Check if upload link exists
    const uploadLink = await prisma.uploadLink.findUnique({
      where: { id: linkId },
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
    
    // Update the upload link
    const updatedLink = await prisma.uploadLink.update({
      where: { id: linkId },
      data: {
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        maxUses: maxUses !== undefined ? maxUses : undefined
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

// Get all upload links with client and project information (with a fixed route name)
router.get('/upload-links-all', authenticateToken, async (req: Request, res: Response) => {
  try {
    console.log('GET /upload-links-all - Request received');
    console.log('User ID from auth token:', req.user?.userId);
    console.log('Auth headers:', req.headers.authorization);
    
    // Check if we have upload links in the database
    const count = await prisma.uploadLink.count();
    console.log(`Total upload links in database: ${count}`);
    
    // Always return links regardless of auth to debug the issue
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
    
    console.log(`Found ${uploadLinks.length} upload links`);
    
    res.json({
      status: 'success',
      data: uploadLinks
    });
  } catch (error) {
    console.error('Failed to fetch upload links:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch upload links'
    });
  }
});

// --- Interfaces for Backend Signing Request Bodies ---
interface CreateMultipartBody {
  filename: string;
  contentType: string;
  metadata: Record<string, any>; // Includes token, clientCode, project, etc.
}

interface SignPartBody {
  key: string;
  uploadId: string;
  partNumber: number;
  metadata: Record<string, any>;
}

interface CompleteMultipartBody {
  key: string;
  uploadId: string;
  parts: CompletedPart[]; // Use the imported type
  metadata: Record<string, any>;
}

interface AbortMultipartBody {
  key: string;
  uploadId: string;
  metadata: Record<string, any>;
}

// --- NEW: Backend signing endpoints for AwsS3 plugin ---
// These endpoints are called by the @uppy/aws-s3 plugin when configured
// for backend signing. They handle the S3 interactions securely.

// 1. Create Multipart Upload
router.post('/s3/multipart/create', async (req: Request<{}, {}, CreateMultipartBody>, res: Response) => {
  try {
    const { filename, contentType, metadata } = req.body;
    const token = metadata?.token; // Extract token from metadata

    if (!token || !filename || !contentType) {
      logger.error('[/s3/multipart/create] Missing filename, contentType, or token in metadata');
      return res.status(400).json({ status: 'error', message: 'Missing required fields (filename, contentType, token)' });
    }

    // Validate token and get project/client info
    const uploadLink = await prisma.uploadLink.findUnique({
      where: { token },
      include: { project: { include: { client: true } } }
    });

    if (!uploadLink) {
      logger.error(`[/s3/multipart/create] Invalid token: ${token}`);
      return res.status(403).json({ status: 'error', message: 'Invalid upload token' });
    }

    // Generate the S3 key using the validated client/project info
    const s3Key = s3Service.generateKey(
      uploadLink.project.client.code || 'default',
      uploadLink.project.name,
      filename
    );

    logger.info(`[/s3/multipart/create] Request for key: ${s3Key}`);

    const { uploadId, key } = await s3Service.createMultipartUpload(s3Key, filename);

    res.json({
      status: 'success',
      data: { key, uploadId } // Return the generated key and uploadId
    });
  } catch (error) {
    logger.error('[/s3/multipart/create] Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create multipart upload' });
  }
});

// 2. Sign Part URL
router.post('/s3/multipart/sign-part', async (req: Request<{}, {}, SignPartBody>, res: Response) => {
  try {
    const { key, uploadId, partNumber, metadata } = req.body;
    const token = metadata?.token; // Extract token

    if (!key || !uploadId || !partNumber || !token) {
       logger.error('[/s3/multipart/sign-part] Missing key, uploadId, partNumber, or token');
       return res.status(400).json({ status: 'error', message: 'Missing required fields (key, uploadId, partNumber, token)' });
    }

    // Optional: Validate token again for extra security
    const uploadLink = await prisma.uploadLink.findUnique({ where: { token } });
    if (!uploadLink) {
      logger.error(`[/s3/multipart/sign-part] Invalid token: ${token}`);
      return res.status(403).json({ status: 'error', message: 'Invalid upload token' });
    }

    logger.info(`[/s3/multipart/sign-part] Request for key: ${key}, part: ${partNumber}`);
    const url = await s3Service.getPresignedUrlForPart(key, uploadId, partNumber);

    res.json({
      status: 'success',
      data: { url } // Return the presigned URL for the part
    });
  } catch (error) {
    logger.error('[/s3/multipart/sign-part] Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to sign part URL' });
  }
});

// 3. Complete Multipart Upload
router.post('/s3/multipart/complete', async (req: Request<{}, {}, CompleteMultipartBody>, res: Response) => {
  try {
    const { key, uploadId, parts, metadata } = req.body;
    const token = metadata?.token; // Extract token

    if (!key || !uploadId || !parts || !token) {
      logger.error('[/s3/multipart/complete] Missing key, uploadId, parts, or token');
      return res.status(400).json({ status: 'error', message: 'Missing required fields (key, uploadId, parts, token)' });
    }

    // Validate token and get project/client info
    const uploadLink = await prisma.uploadLink.findUnique({
      where: { token },
      include: { project: { include: { client: true } } }
    });

    if (!uploadLink) {
      logger.error(`[/s3/multipart/complete] Invalid token: ${token}`);
      return res.status(403).json({ status: 'error', message: 'Invalid upload token' });
    }

    logger.info(`[/s3/multipart/complete] Request for key: ${key}, parts: ${parts.length}`);

    // Complete the upload in S3
    const { location } = await s3Service.completeMultipartUpload(key, uploadId, parts);

    // --- Database record creation after successful S3 completion ---
    // Get file info from metadata (assuming Uppy sends it)
    const filename = metadata?.name || key.split('/').pop() || 'unknown';
    const mimeType = metadata?.type || s3Service.getContentTypeFromFileName(filename);
    // We don't have the exact size here without another S3 call, use 0 or estimate if needed
    const size = metadata?.size || 0;

    // Create the database record
    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        name: filename,
        path: key, // Store the S3 key as the path
        size: size,
        mimeType: mimeType,
        hash: `s3-multipart-${uploadId}`, // Use uploadId or ETag if available from complete response
        project: { connect: { id: uploadLink.projectId } },
        status: 'completed',
        completedAt: new Date(),
        storage: 's3',
        url: location // Store the final S3 URL
      }
    });

    // Increment usage count
    await prisma.uploadLink.update({
      where: { id: uploadLink.id },
      data: { usedCount: { increment: 1 } }
    });

    // Track completion
    uploadTracker.completeUpload(`s3-multipart-${uploadId}`); // Use a consistent ID format

    logger.info(`[/s3/multipart/complete] Successfully completed and recorded file: ${key}, DB ID: ${uploadedFile.id}`);

    res.json({
      status: 'success',
      data: { location } // Return the final location URL
    });

  } catch (error) {
    logger.error('[/s3/multipart/complete] Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to complete multipart upload' });
  }
});

// 4. Abort Multipart Upload
router.post('/s3/multipart/abort', async (req: Request<{}, {}, AbortMultipartBody>, res: Response) => {
  try {
    const { key, uploadId, metadata } = req.body;
    const token = metadata?.token; // Extract token

    if (!key || !uploadId || !token) {
      logger.error('[/s3/multipart/abort] Missing key, uploadId, or token');
      return res.status(400).json({ status: 'error', message: 'Missing required fields (key, uploadId, token)' });
    }

    // Optional: Validate token
    const uploadLink = await prisma.uploadLink.findUnique({ where: { token } });
    if (!uploadLink) {
      logger.error(`[/s3/multipart/abort] Invalid token: ${token}`);
      // Don't necessarily fail the abort if token is invalid, just log
    }

    logger.info(`[/s3/multipart/abort] Request for key: ${key}`);
    await s3Service.abortMultipartUpload(key, uploadId);

    res.json({
      status: 'success',
      message: 'Multipart upload aborted successfully'
    });
  } catch (error) {
    logger.error('[/s3/multipart/abort] Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to abort multipart upload' });
  }
});
// --- End NEW backend signing endpoints ---

// --- NEW: Tusd Post-Finish Hook Handler ---
// This endpoint is called by the Tusd server after an upload is completed.
// Tusd must be configured with: -hooks-endpoint <this-url> -hooks-http-forward-headers Upload-Metadata
router.post('/tusd-hook', async (req: Request, res: Response) => {
  logger.info('[/tusd-hook] Received hook call from Tusd');
  
  // Tusd sends upload metadata in the 'Hook-Data' header or forwarded headers
  // We configured Tusd to forward 'Upload-Metadata'
  const metadataHeader = req.headers['upload-metadata'] as string;
  const fileInfo = req.body; // Tusd sends file info in the request body

  logger.info(`[/tusd-hook] Headers: ${JSON.stringify(req.headers)}`);
  logger.info(`[/tusd-hook] Body: ${JSON.stringify(fileInfo)}`);

  if (!metadataHeader || !fileInfo || !fileInfo.Storage || !fileInfo.Storage.Path) {
    logger.error('[/tusd-hook] Missing required data from Tusd hook (Upload-Metadata header or file info body)');
    return res.status(400).json({ status: 'error', message: 'Missing data from Tusd hook' });
  }

  try {
    // 1. Parse Metadata
    const metadata: Record<string, string> = {};
    metadataHeader.split(',').forEach(pair => {
      const [key, valueBase64] = pair.split(' ');
      if (key && valueBase64) {
        try {
          // Decode base64 and then URI component
          metadata[key] = decodeURIComponent(Buffer.from(valueBase64, 'base64').toString('utf-8'));
        } catch (e) {
          logger.warn(`[/tusd-hook] Failed to decode metadata pair: ${key}`, e);
        }
      }
    });

    const {
      token,
      clientCode, // Use clientCode directly
      project: projectName, // Rename for clarity
      filename: originalFilename, // Original filename from metadata
      filetype: mimeType = 'application/octet-stream' // Default mime type
    } = metadata;
    
    const tusId = fileInfo.ID;
    const fileSize = fileInfo.Size;
    const tusFilePath = fileInfo.Storage.Path; // Path where Tusd stored the file

    logger.info(`[/tusd-hook] Parsed Metadata: ${JSON.stringify(metadata)}`);
    logger.info(`[/tusd-hook] File Info: ID=${tusId}, Size=${fileSize}, Path=${tusFilePath}`);

    if (!token || !clientCode || !projectName || !originalFilename) {
      logger.error('[/tusd-hook] Missing required metadata fields (token, clientCode, project, filename)');
      // Attempt to delete the orphaned file left by Tusd
      try {
        await fsPromises.unlink(tusFilePath); // Use fsPromises
        logger.warn(`[/tusd-hook] Deleted orphaned Tusd file due to missing metadata: ${tusFilePath}`);
      } catch (unlinkError) {
        logger.error(`[/tusd-hook] Failed to delete orphaned Tusd file: ${tusFilePath}`, unlinkError);
      }
      return res.status(400).json({ status: 'error', message: 'Missing required metadata' });
    }

    // 2. Validate Token
    const uploadLink = await prisma.uploadLink.findUnique({
      where: { token },
      include: { project: { include: { client: true } } } // Include client for validation/consistency
    });

    if (!uploadLink) {
      logger.error(`[/tusd-hook] Invalid token: ${token}`);
      // Attempt to delete the orphaned file
      try {
        await fsPromises.unlink(tusFilePath); // Use fsPromises
        logger.warn(`[/tusd-hook] Deleted orphaned Tusd file due to invalid token: ${tusFilePath}`);
      } catch (unlinkError) {
        logger.error(`[/tusd-hook] Failed to delete orphaned Tusd file: ${tusFilePath}`, unlinkError);
      }
      return res.status(403).json({ status: 'error', message: 'Invalid upload token' });
    }

    // Optional: Verify clientCode and projectName from token match metadata
    if (uploadLink.project.client.code !== clientCode || uploadLink.project.name !== projectName) {
       logger.warn(`[/tusd-hook] Metadata mismatch for token ${token}: DB Client=${uploadLink.project.client.code}, DB Project=${uploadLink.project.name} vs Meta Client=${clientCode}, Meta Project=${projectName}`);
       // Decide whether to proceed or reject based on policy
    }

    // Check expiry and usage limits
    if (uploadLink.expiresAt < new Date() || (uploadLink.maxUses !== null && uploadLink.usedCount >= uploadLink.maxUses)) {
       logger.warn(`[/tusd-hook] Expired or over-limit token used: ${token}`);
       // Attempt to delete the orphaned file
       try {
         await fsPromises.unlink(tusFilePath); // Use fsPromises
         logger.warn(`[/tusd-hook] Deleted orphaned Tusd file due to expired/over-limit token: ${tusFilePath}`);
       } catch (unlinkError) {
         logger.error(`[/tusd-hook] Failed to delete orphaned Tusd file: ${tusFilePath}`, unlinkError);
       }
       return res.status(403).json({ status: 'error', message: 'Upload link expired or limit reached' });
    }

    // 3. Determine Final Destination & Move/Upload File
    let finalPath: string;
    let finalUrl: string | null = null;
    const storageType: 'local' | 's3' = process.env.TUS_STORAGE_TYPE === 's3' ? 's3' : 'local'; // Determine storage type (e.g., via env var)

    // Generate a safe filename (similar to XHR route)
    const safeFilename = originalFilename.replace(/[\/\\:*?"<>|]/g, '_');

    if (storageType === 's3') {
      // Upload from Tusd's path to S3
      const s3Key = s3Service.generateKey(clientCode, projectName, safeFilename);
      logger.info(`[/tusd-hook] Uploading Tusd file ${tusFilePath} to S3 key: ${s3Key}`);

      const fileBuffer = await fsPromises.readFile(tusFilePath); // Use fsPromises
      finalUrl = await s3Service.uploadFile(
        fileBuffer,
        s3Key,
        mimeType,
        {
          clientName: uploadLink.project.client.name, // Use name from DB lookup
          projectName: uploadLink.project.name,
          originalName: originalFilename // Keep original name in S3 metadata
        }
      );
      finalPath = s3Key; // Store S3 key as the path

      // Delete the local file left by Tusd after successful S3 upload
      try {
        await fsPromises.unlink(tusFilePath); // Use fsPromises
        logger.info(`[/tusd-hook] Deleted local Tusd file after S3 upload: ${tusFilePath}`);
      } catch (unlinkError) {
        logger.error(`[/tusd-hook] Failed to delete local Tusd file after S3 upload: ${tusFilePath}`, unlinkError);
        // Continue processing, but log the error
      }

    } else {
      // Move file locally
      const organizedDir = process.env.TUS_ORGANIZED_DIR || path.join(__dirname, '../../organized'); // Use a specific organized dir for Tusd files
      const clientProjectDir = path.join(organizedDir, clientCode, projectName);

      if (!fs.existsSync(clientProjectDir)) { // Use standard fs for sync check
        await fsPromises.mkdir(clientProjectDir, { recursive: true }); // Use fsPromises
      }

      finalPath = path.join(clientProjectDir, safeFilename);
      logger.info(`[/tusd-hook] Moving Tusd file from ${tusFilePath} to ${finalPath}`);

      try {
        await fsPromises.rename(tusFilePath, finalPath); // Use fsPromises
      } catch (renameError) {
         // Handle potential cross-device link error (EXDEV) by copying and unlinking
         if ((renameError as NodeJS.ErrnoException).code === 'EXDEV') {
            logger.warn(`[/tusd-hook] Cross-device link error (EXDEV) moving ${tusFilePath} to ${finalPath}. Attempting copy/unlink.`);
            await fsPromises.copyFile(tusFilePath, finalPath); // Use fsPromises
            await fsPromises.unlink(tusFilePath); // Use fsPromises
            logger.info(`[/tusd-hook] Successfully copied and unlinked file across devices.`);
         } else {
            logger.error(`[/tusd-hook] Failed to move Tusd file: ${renameError}`);
            throw renameError; // Re-throw other errors
         }
      }
    }

    // 4. Calculate Hash (Optional but recommended)
    // Note: Hashing large files here can be resource-intensive. Consider doing it async or skipping if not critical.
    let fileHash = `tus-${tusId}`; // Default hash if calculation fails or is skipped
    try {
      const finalFileBuffer = await fsPromises.readFile(finalPath); // Read the *final* file if local // Use fsPromises
      const xxhash64 = await xxhash();
      fileHash = xxhash64.h64Raw(Buffer.from(finalFileBuffer)).toString(16);
      logger.info(`[/tusd-hook] Calculated hash for ${finalPath}: ${fileHash}`);
    } catch (hashError) {
      logger.error(`[/tusd-hook] Failed to calculate hash for ${finalPath}:`, hashError);
      // Use the default hash
    }

    // 5. Create Database Record
    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        name: originalFilename, // Store original filename
        path: finalPath,
        size: parseFloat(fileSize.toString()),
        mimeType: mimeType,
        hash: fileHash,
        project: { connect: { id: uploadLink.projectId } },
        status: 'completed',
        completedAt: new Date(),
        storage: storageType,
        url: finalUrl
      }
    });
    logger.info(`[/tusd-hook] Created database record for file: ${uploadedFile.id}`);

    // 6. Update Upload Link Usage Count
    await prisma.uploadLink.update({
      where: { id: uploadLink.id },
      data: { usedCount: { increment: 1 } }
    });
    logger.info(`[/tusd-hook] Incremented usage count for link: ${uploadLink.id}`);

    // 7. Update Upload Tracker (Optional)
    // Mark the corresponding upload tracked via frontend progress as complete
    // Note: The 'uploadId' used in the progress endpoint might differ from tusId.
    // We might need a way to correlate them if using the tracker this way.
    // For simplicity, we can use the tusId here.
    uploadTracker.completeUpload(tusId);
    logger.info(`[/tusd-hook] Marked upload complete in tracker (using tusId): ${tusId}`);

    // Respond to Tusd hook
    res.status(200).json({ status: 'success', message: 'Tusd upload processed successfully' });

  } catch (error) {
    logger.error('[/tusd-hook] Error processing Tusd hook:', error);
    // Don't delete the file here, as the error might be temporary (e.g., DB connection)
    // Manual cleanup might be needed if processing fails permanently.
    res.status(500).json({ status: 'error', message: 'Internal server error processing Tusd hook' });
  }
});
// --- End Tusd Hook Handler ---


// Endpoint for Companion to notify backend after successful S3 upload
router.post('/s3-callback', async (req: Request, res: Response) => {
  try {
    // Correct logic starts here: Access data directly from Companion's request body
    const { name, size, mimeType, metadata, s3 } = req.body;
    const s3Key = s3?.key; // Key where Companion uploaded the file

    logger.info('[/s3-callback] Received callback from Companion');
    logger.info('[/s3-callback] Body:', JSON.stringify(req.body, null, 2));

    // Validate required data from Companion

    if (!metadata || !metadata.token || !s3Key) {
      logger.error('[/s3-callback] Missing required metadata (token) or S3 key from Companion callback');
      return res.status(400).json({ status: 'error', message: 'Missing required data from Companion' });
    }

    const token = metadata.token;

    // Validate the token
    const uploadLink = await prisma.uploadLink.findUnique({
      where: { token },
      include: { project: { include: { client: true } } }
    });

    if (!uploadLink) {
      logger.error(`[/s3-callback] Invalid token received: ${token}`);
      // Optionally delete the orphaned file from S3
      // await s3Service.deleteFile(s3Key);
      return res.status(403).json({ status: 'error', message: 'Invalid upload token' });
    }

    // Check expiry and usage limits
    if (uploadLink.expiresAt < new Date() || (uploadLink.maxUses !== null && uploadLink.usedCount >= uploadLink.maxUses)) {
       logger.warn(`[/s3-callback] Expired or over-limit token used: ${token}`);
       // Optionally delete the orphaned file from S3
       // await s3Service.deleteFile(s3Key);
       return res.status(403).json({ status: 'error', message: 'Upload link expired or limit reached' });
    }

    // Generate a unique ID for tracking this specific upload instance
    const trackerId = `s3-companion-${s3Key.replace(/\//g, '-')}`;

    // Create the database record (initially with Companion's key)
    // We'll use the s3FileProcessor later to rename and update the path/URL
    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        name: metadata.name || name || 'unknown', // Use metadata name if available
        path: s3Key, // Store Companion's key initially
        size: size || 0,
        mimeType: mimeType || 'application/octet-stream',
        hash: `s3-companion-${uuidv4()}`, // Placeholder hash, could get ETag from S3 later if needed
        project: { connect: { id: uploadLink.projectId } },
        status: 'processing', // Mark as processing until renamed
        completedAt: new Date(),
        storage: 's3',
        url: null // URL will be set after renaming
      }
    });

    // Increment usage count immediately
    await prisma.uploadLink.update({
      where: { id: uploadLink.id },
      data: { usedCount: { increment: 1 } }
    });

    // Trigger the S3 file processor to rename/organize the file
    // Pass the newly created file ID and the token
    logger.info(`[/s3-callback] Triggering S3 file processing for file ID: ${uploadedFile.id}, S3 Key: ${s3Key}`);
    s3FileProcessor.processFile(uploadedFile.id, token)
      .then(success => {
        if (success) {
          logger.info(`[/s3-callback] S3 file processing successful for file ID: ${uploadedFile.id}`);
          // Mark upload complete in tracker AFTER successful processing
          uploadTracker.completeUpload(trackerId); 
        } else {
          logger.error(`[/s3-callback] S3 file processing failed for file ID: ${uploadedFile.id}`);
          // Handle failure - maybe update status to 'failed'?
          prisma.uploadedFile.update({ where: { id: uploadedFile.id }, data: { status: 'failed' } }).catch();
        }
      })
      .catch(error => {
        logger.error(`[/s3-callback] Error during S3 file processing for file ID: ${uploadedFile.id}`, error);
        prisma.uploadedFile.update({ where: { id: uploadedFile.id }, data: { status: 'failed' } }).catch();
      });

    // Respond to Companion immediately - processing happens async
    res.status(200).json({ status: 'success', message: 'Upload received, processing started' });

  } catch (error) {
    logger.error('[/s3-callback] Error processing Companion callback:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error processing callback' });
  }
});


// Add an endpoint to trigger S3 filename cleanup manually
router.post('/cleanup-filenames', authenticateToken, async (_req: Request, res: Response) => {
  try {
    // Start the cleanup process using the imported processor
    await s3FileProcessor.processAllFiles();
    
    res.json({
      status: 'success',
      message: 'S3 filename cleanup process completed successfully'
    });
  } catch (error) {
    console.error('Failed to run filename cleanup:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to run filename cleanup process'
    });
  }
});


// --- NEW: Tusd Hook Progress Handler ---
// Endpoint called by post-create, post-receive, post-finish hooks
router.post('/hook-progress', async (req: Request, res: Response) => {
  const { uploadId, status, offset, token, filename, size } = req.body;
  const telegramBot = getTelegramBot();

  if (!telegramBot) {
    logger.error('[Hook Progress] Telegram bot not initialized.');
    // Don't fail the hook, just log
    return res.status(200).json({ status: 'warning', message: 'Telegram bot not available, progress not sent.' });
  }

  if (!uploadId || !status) {
    logger.warn('[Hook Progress] Received incomplete payload (missing uploadId or status):', req.body);
    return res.status(400).json({ status: 'error', message: 'Missing uploadId or status' });
  }

  logger.info(`[Hook Progress] Received status '${status}' for uploadId: ${uploadId}`);

  try {
    switch (status) {
      case 'created':
        // Initial notification when upload starts
        if (token === undefined || filename === undefined || size === undefined) {
           logger.warn(`[Hook Progress] 'created' status missing token, filename, or size for ${uploadId}`);
           return res.status(400).json({ status: 'error', message: 'Missing token, filename, or size for created status' });
        }

        // Use helper function to get details and populate cache
        const initialDetails = await getUploadDetails(uploadId, token);

        if (!initialDetails) {
           logger.error(`[Hook Progress] Failed to get initial details for ${uploadId} with token ${token}`);
           // Decide if we should fail the hook or proceed with defaults
           return res.status(403).json({ status: 'error', message: 'Failed to validate upload token or get details' });
        }

        // Ensure size and filename from body are stored if helper didn't get them from file
        initialDetails.size = Number(size);
        initialDetails.filename = filename;
        tusdProgressCache.set(uploadId, initialDetails); // Ensure cache is updated
        logger.info(`[Hook Progress] Cached initial info for ${uploadId}`);


        // Send initial Telegram message using fetched details
        await telegramBot.sendUploadNotification({
          id: uploadId,
          size: initialDetails.size ?? 0,
          offset: 0, // Starts at 0
          metadata: {
            filename: initialDetails.filename ?? 'Unknown Filename',
            clientName: initialDetails.clientName || 'Unknown Client',
            projectName: initialDetails.projectName || 'Unknown Project',
            token: initialDetails.token, // Use initialDetails
          },
          storage: initialDetails.storage, // Use initialDetails
          isComplete: false,
        });
        break;

      case 'receiving':
        // Update progress as chunks arrive
        if (offset === undefined) {
          logger.warn(`[Hook Progress] 'receiving' status missing offset for ${uploadId}`);
          return res.status(400).json({ status: 'error', message: 'Missing offset for receiving status' });
        }

        // Use helper function to get details (checks cache first, then file/DB)
        const receivingDetails = await getUploadDetails(uploadId);

        if (!receivingDetails) {
          logger.error(`[Hook Progress] Failed to get details for 'receiving' status, uploadId: ${uploadId}. Sending notification with defaults.`);
          // Send notification with defaults if details can't be fetched
          await telegramBot.sendUploadNotification({
            id: uploadId,
            size: 0, // Unknown size
            offset: Number(offset),
            metadata: {
              filename: 'Unknown Filename',
              clientName: 'Unknown Client',
              projectName: 'Unknown Project',
              token: 'Unknown',
            },
            storage: 'local',
            isComplete: false,
          });
           // Allow hook to succeed even if details are missing
           return res.status(200).json({ status: 'warning', message: 'Upload details not found, sent default notification.' });
        }

        // Send updated Telegram message using potentially refreshed details
        await telegramBot.sendUploadNotification({
          id: uploadId,
          size: receivingDetails.size ?? 0,
          offset: Number(offset),
          metadata: {
            filename: receivingDetails.filename ?? 'Unknown Filename',
            clientName: receivingDetails.clientName || 'Unknown Client',
            projectName: receivingDetails.projectName || 'Unknown Project',
            token: receivingDetails.token,
          },
          storage: receivingDetails.storage,
          isComplete: false,
        });
        break;

      case 'finished':
        // Final notification when upload completes (before file move/processing)
        // Use helper function to get details (checks cache first, then file/DB)
        const finishedDetails = await getUploadDetails(uploadId);

        if (!finishedDetails) {
           logger.error(`[Hook Progress] Failed to get details for 'finished' status, uploadId: ${uploadId}. Cannot send final notification or cleanup.`);
           // Attempt cleanup anyway? Or just warn?
           await telegramBot.cleanupUploadMessage(uploadId); // Try cleanup even if details failed
           tusdProgressCache.delete(uploadId); // Clean cache
           return res.status(200).json({ status: 'warning', message: 'Upload details not found for finished status.' });
        }

        // Send final "complete" Telegram message using potentially refreshed details
        await telegramBot.sendUploadNotification({
          id: uploadId,
          size: finishedDetails.size ?? 0,
          offset: finishedDetails.size ?? 0, // Mark as fully uploaded
          metadata: {
            filename: finishedDetails.filename ?? 'Unknown Filename',
            clientName: finishedDetails.clientName || 'Unknown Client',
            projectName: finishedDetails.projectName || 'Unknown Project',
            token: finishedDetails.token,
          },
          storage: finishedDetails.storage,
          isComplete: true, // Mark as complete
        });

        // Clean up the message ID storage in the bot
        await telegramBot.cleanupUploadMessage(uploadId);

        // Remove from cache
        tusdProgressCache.delete(uploadId);
        logger.info(`[Hook Progress] Processed 'finished' status and cleaned up cache for ${uploadId}`);
        break;

      default:
        logger.warn(`[Hook Progress] Received unknown status '${status}' for uploadId: ${uploadId}`);
        return res.status(400).json({ status: 'error', message: `Unknown status: ${status}` });
    }

    // Respond successfully to the hook
    res.status(200).json({ status: 'success', message: `Status '${status}' processed for ${uploadId}` });

  } catch (error) {
    logger.error(`[Hook Progress] Error processing status '${status}' for ${uploadId}:`, error);
    // Respond with error but allow hook to potentially succeed on Tusd side
    res.status(500).json({ status: 'error', message: 'Internal server error processing hook progress' });
  }
});
// --- End Tusd Hook Progress Handler ---


// The duplicate /s3-callback endpoint below was removed as it was erroneous and redundant.
// The correct /s3-callback endpoint is defined earlier in the file (around line 1180).

// Set turbosort directory for a project
// Note: The turbosort directory is stored in a .turbosort file in the project directory,
// not in the database. This allows for easier integration with external file-based tools.
router.post('/projects/:projectId/turbosort', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { directory } = req.body;

    if (!directory || typeof directory !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Directory name is required'
      });
    }

    // Validate that the project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true
      }
    });

    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      });
    }

    // Construct the path to the project directory
    const projectPath = path.join(process.env.UPLOAD_DIR || 'uploads', projectId);
    
    // Create the project directory if it doesn't exist
    if (!fs.existsSync(projectPath)) { // Use standard fs for sync check
      fs.mkdirSync(projectPath, { recursive: true }); // Use standard fs for sync creation
    }

    // Write the directory name to the .turbosort file
    const turbosortPath = path.join(projectPath, '.turbosort');
    fs.writeFileSync(turbosortPath, directory); // Use standard fs for sync write

    // Also save the .turbosort file to S3 if project has a client
    if (project.client && project.client.code) {
      try {
        // Generate S3 key based on client and project name
        const s3Key = s3Service.generateKey(
          project.client.code,
          project.name,
          '.turbosort'
        );

        // Upload the .turbosort file to S3
        await s3Service.uploadFile(
          Buffer.from(directory),
          s3Key,
          'text/plain',
          {
            clientName: project.client.name,
            projectName: project.name,
            turbosortDirectory: 'true'
          }
        );

        console.log(`Turbosort file uploaded to S3 at key: ${s3Key}`);
      } catch (s3Error) {
        console.error('Failed to upload turbosort file to S3:', s3Error);
        // Don't fail the request if S3 upload fails, we still have the local file
      }
    }

    res.json({
      status: 'success',
      message: 'Turbosort directory set successfully',
      data: { directory }
    });
  } catch (error) {
    console.error('Failed to set turbosort directory:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to set turbosort directory'
    });
  }
});

// Delete turbosort file for a project
router.delete('/projects/:projectId/turbosort', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    // Validate that the project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true
      }
    });

    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      });
    }

    // Construct the path to the .turbosort file
    const projectPath = path.join(process.env.UPLOAD_DIR || 'uploads', projectId);
    const turbosortPath = path.join(projectPath, '.turbosort');

    // Check if the file exists before attempting to delete
    if (fs.existsSync(turbosortPath)) { // Use standard fs for sync check
      fs.unlinkSync(turbosortPath); // Use standard fs for sync unlink
    }

    // Also delete from S3 if project has a client
    if (project.client && project.client.code) {
      try {
        // Generate S3 key based on client and project name
        const s3Key = s3Service.generateKey(
          project.client.code,
          project.name,
          '.turbosort'
        );

        // Delete the .turbosort file from S3
        await s3Service.deleteFile(s3Key);
        console.log(`Turbosort file deleted from S3 at key: ${s3Key}`);
      } catch (s3Error) {
        console.error('Failed to delete turbosort file from S3:', s3Error);
        // Don't fail the request if S3 deletion fails
      }
    }

    res.json({
      status: 'success',
      message: 'Turbosort file deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete turbosort file:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete turbosort file'
    });
  }
});

export default router; 
