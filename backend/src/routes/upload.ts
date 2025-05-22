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
// Import the controller function for the finished upload hook
import { handleProcessFinishedUpload } from '../controllers/uploadController';

const router = express.Router();
const prisma = new PrismaClient();

// Removed the separate /process-finished route, as all hooks go to /hook-progress now.
// router.post('/process-finished', handleProcessFinishedUpload);

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

  // Prioritize cached info if it's complete (has client/project)
  if (cachedInfo?.clientName && cachedInfo?.projectName) {
    logger.info(`[getUploadDetails] Found complete info in cache for ${uploadId}`);
    return cachedInfo;
  }

  // Initialize variables from cache or defaults
  let token = providedToken || cachedInfo?.token;
  let size = cachedInfo?.size;
  let filename = cachedInfo?.filename;
  let storage = cachedInfo?.storage || 'local';

  // 2. If token is still missing, try reading from .info file
  if (!token) {
    const infoFilePath = path.join(TUSD_DATA_DIR, `${uploadId}.info`);
    logger.info(`[getUploadDetails] Token not cached, attempting to read info file: ${infoFilePath}`);
    try {
      const infoContent = await fsPromises.readFile(infoFilePath, 'utf-8'); // Use fsPromises
      const infoData = JSON.parse(infoContent);
      // Extract potential values from .info file
      const infoToken = infoData?.MetaData?.token;
      const infoSize = infoData?.Size;
      const infoFilename = infoData?.MetaData?.filename || infoData?.MetaData?.name; // Check both common keys
      const infoStorage = infoData?.Storage?.Type === 's3store' ? 's3' : 'local'; // Map tusd storage type

      // Update local variables ONLY if they weren't already set from cache/providedToken
      if (!token && infoToken) {
          token = infoToken;
          logger.info(`[getUploadDetails] Extracted token from .info file for ${uploadId}`);
      }
      if (size === undefined && infoSize !== undefined) { // Use === undefined to allow size 0
          size = infoSize;
          logger.info(`[getUploadDetails] Extracted size (${size}) from .info file for ${uploadId}`);
      }
      if (!filename && infoFilename) {
          filename = infoFilename;
          logger.info(`[getUploadDetails] Extracted filename (${filename}) from .info file for ${uploadId}`);
      }
      // Update storage only if not already set differently
      if (storage === 'local' && infoStorage === 's3') {
          storage = infoStorage;
          logger.info(`[getUploadDetails] Updated storage to 's3' based on .info file for ${uploadId}`);
      }

    } catch (err: any) {
      // Log errors but don't necessarily fail yet, DB lookup might still work if token was cached/provided
      if (err.code === 'ENOENT') {
        logger.warn(`[getUploadDetails] .info file not found for ${uploadId} at ${infoFilePath}. Proceeding with cached/provided info if available.`);
      } else {
        logger.error(`[getUploadDetails] Error reading or parsing .info file for ${uploadId}:`, err);
      }
      // Do not return null here, allow DB lookup attempt if token exists
    }
  }

  // 3. If we have a token (from cache, param, or .info file), query the database for authoritative info
  if (token) {
    logger.info(`[getUploadDetails] Have token, querying database for ${uploadId}`);
    try {
      const uploadLink = await prisma.uploadLink.findUnique({
        where: { token },
        include: { project: { include: { client: true } } }
      });

      if (uploadLink) {
        logger.info(`[getUploadDetails] DB Query Result for token ${token}: Client=${uploadLink.project?.client?.name}, Project=${uploadLink.project?.name}`); // Log DB result more concisely
        const fullInfo: TusdUploadInfo = {
          token: token,
          clientName: uploadLink.project.client.name, // Authoritative from DB
          projectName: uploadLink.project.name, // Authoritative from DB
          // Use size/filename from earlier steps (cache/.info) if available, otherwise set defaults
          size: size ?? 0, // Use size derived from cache/.info
          filename: filename ?? 'Unknown Filename', // Use filename derived from cache/.info
          storage: storage, // Use storage derived from cache/.info
        };
        // Update cache ONLY with successfully fetched, complete details
        tusdProgressCache.set(uploadId, fullInfo);
        logger.info(`[getUploadDetails] Successfully fetched info from DB and updated cache for ${uploadId}`);
        return fullInfo;
      } else {
        // Token was invalid according to DB
        logger.error(`[getUploadDetails] Invalid token '${token}' found for ${uploadId} (DB lookup failed).`);
        // Do NOT cache invalid token info. Remove potentially stale cache entry.
        tusdProgressCache.delete(uploadId);
        return null; // Indicate failure
      }
    } catch (dbError) {
      logger.error(`[getUploadDetails] Database error fetching details for token ${token} (uploadId ${uploadId}):`, dbError);
      // Do not cache on DB error. Remove potentially stale cache entry.
      tusdProgressCache.delete(uploadId);
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
      
      // Replace spaces with underscores to match expected directory structure
      const projectNameWithUnderscores = uploadLink.project.name.replace(/ /g, '_');
      const uploadDir = path.join(organizedDir, 
        uploadLink.project.client.code || 'default',
        projectNameWithUnderscores
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

    // First, delete all files from the database
    if (project.files.length > 0) {
      // Delete all files from S3 first
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
      
      // Delete all files from the database
      await prisma.uploadedFile.deleteMany({
        where: { projectId }
      });
      
      console.log(`Deleted all files for project ${projectId} from database`);
    }

    // Now delete the project (cascading delete will handle upload links)
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
    
    // Define all possible locations where .turbosort file might exist
    const locations = [];
    
    // 1. Standard upload directory (legacy)
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    const projectUploadPath = path.join(uploadDir, projectId);
    locations.push(projectUploadPath);
    
    // 2. TUSD organized directory
    const tusdOrganizedDir = process.env.TUS_ORGANIZED_DIR || path.join(__dirname, '../../organized');
    if (project.client && project.client.code) {
      // Replace spaces with underscores to match expected directory structure
      // This MUST match exactly how files are stored (Marco_Grade not Marco Grade)
      const projectNameWithUnderscores = project.name.replace(/ /g, '_');
      const tusdProjectPath = path.join(
        tusdOrganizedDir,
        project.client.code,
        projectNameWithUnderscores
      );
      locations.push(tusdProjectPath);
    }
    
    // 3. TUSD data directory (where uploads are initially stored)
    const tusdDataDir = process.env.TUSD_DATA_DIR || '/srv/tusd-data';
    // Create a project-specific subdirectory in the TUSD data directory
    // Replace spaces with underscores to match expected directory structure
    // This MUST match exactly how files are stored (Marco_Grade not Marco Grade)
    const projectNameWithUnderscores = project.name.replace(/ /g, '_');
    const tusdProjectPath = path.join(tusdDataDir, project.client?.code || 'default', projectNameWithUnderscores);
    locations.push(tusdProjectPath);
    
    // Try to find .turbosort file in any of the locations
    for (const location of locations) {
      try {
        const turbosortPath = path.join(location, '.turbosort');
        
        // Check if the file exists
        if (fs.existsSync(turbosortPath)) {
          // Read the content of the .turbosort file
          turbosortContent = fs.readFileSync(turbosortPath, 'utf8').trim();
          logger.info(`Found .turbosort file at: ${turbosortPath} with content: ${turbosortContent}`);
          break; // Stop searching once found
        }
      } catch (fsError) {
        logger.error(`Error checking/reading .turbosort file at ${location}:`, fsError);
        // Continue to next location
      }
    }
    
    // If not found in any local location and we have client info, try to get from S3
    if (turbosortContent === null && project.client && project.client.code) {
      try {
        // Generate S3 key based on client and project name
        // Replace spaces with underscores to match expected directory structure
        const projectNameWithUnderscores = project.name.replace(/ /g, '_');
        const s3Key = s3Service.generateKey(
          project.client.code,
          projectNameWithUnderscores,
          '.turbosort'
        );

        // Try to get the file from S3
        const s3Object = await s3Service.getFileContent(s3Key);
        if (s3Object) {
          turbosortContent = s3Object.toString('utf8').trim();
          logger.info(`Retrieved .turbosort file from S3 with content: ${turbosortContent}`);
          
          // Cache the S3 content locally in all locations
          for (const location of locations) {
            try {
              if (!fs.existsSync(location)) {
                fs.mkdirSync(location, { recursive: true });
              }
              const turbosortPath = path.join(location, '.turbosort');
              fs.writeFileSync(turbosortPath, turbosortContent);
              logger.info(`Cached turbosort file from S3 to local path: ${turbosortPath}`);
            } catch (fsError) {
              logger.error(`Failed to cache turbosort file to ${location}:`, fsError);
              // Continue to next location
            }
          }
        }
      } catch (s3Error) {
        logger.error('Failed to get turbosort file from S3:', s3Error);
        // Don't fail the request if we can't get the file from S3
      }
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

    // First, delete all files from S3 and database for each project
    for (const project of client.projects) {
      if (project.files.length > 0) {
        // Delete files from S3
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
        
        // Delete files from database
        await prisma.uploadedFile.deleteMany({
          where: { projectId: project.id }
        });
        
        console.log(`Deleted all files for project ${project.id} from database`);
      }
      
      // Delete upload links for this project
      await prisma.uploadLink.deleteMany({
        where: { projectId: project.id }
      });
      
      console.log(`Deleted all upload links for project ${project.id}`);
    }
    
    // Delete all projects for this client
    await prisma.project.deleteMany({
      where: { clientId }
    });
    
    console.log(`Deleted all projects for client ${clientId}`);
    
    // Finally, delete the client
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

// --- Redundant /tusd-hook endpoint removed ---


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
// Endpoint called by Tusd HTTP hooks (post-create, post-receive, post-finish, post-terminate)
router.post('/hook-progress', async (req: Request, res: Response) => {
  // Extract data from the Tusd HTTP hook payload structure
  const hookPayload = req.body;
  const hookType = hookPayload?.Type; // e.g., "post-create", "post-finish"
  const uploadData = hookPayload?.Event?.Upload;
  const uploadId = uploadData?.ID;
  const offset = uploadData?.Offset;
  const size = uploadData?.Size;
  const metadata = uploadData?.MetaData;
  const token = metadata?.token;
  const filename = metadata?.filename || metadata?.name;

  const telegramBot = getTelegramBot();

  if (!telegramBot) {
    logger.error(`[Hook Progress:${uploadId}] Telegram bot not initialized.`);
    // Don't fail the hook, just log
    // Don't fail the hook, just log
    // Allow processing to continue without Telegram if needed
  }

  // Validate the essential parts extracted from the hook payload
  if (!uploadId || !hookType) {
    logger.warn('[Hook Progress] Received incomplete hook payload (missing Upload.ID or Type):', JSON.stringify(hookPayload));
    // Use the correct message based on previous logs
    return res.status(400).json({ status: 'error', message: 'Missing uploadId or status' });
  }

  logger.info(`[Hook Progress] Received hook type '${hookType}' for uploadId: ${uploadId}`);

  try {
    // Use hookType (e.g., "post-create") instead of the old 'status' variable
    switch (hookType) {
      case 'post-create':
        // Initial notification when upload starts
        if (token === undefined || filename === undefined || size === undefined) {
           logger.warn(`[Hook Progress] 'post-create' hook missing token, filename, or size in metadata/upload data for ${uploadId}`);
           return res.status(400).json({ status: 'error', message: 'Missing token, filename, or size for post-create hook' });
        }

        // Use helper function to get details and populate cache
        logger.info(`[Hook Progress - created] Received: uploadId=${uploadId}, token=${token ? token.substring(0,8)+'...' : 'MISSING'}, filename=${filename}, size=${size}`); // Log received data (mask token)
        const initialDetails = await getUploadDetails(uploadId, token);

        if (!initialDetails) {
           logger.error(`[Hook Progress] Failed to get initial details for ${uploadId} with token ${token}`);
           // Decide if we should fail the hook or proceed with defaults
           return res.status(403).json({ status: 'error', message: 'Failed to validate upload token or get details' });
        }

        // Ensure size and filename from body are stored if helper didn't get them from file
        logger.info(`[Hook Progress - created] initialDetails from getUploadDetails: size=${initialDetails.size}, filename=${initialDetails.filename}, client=${initialDetails.clientName}, project=${initialDetails.projectName}`); // Log before assignment
        initialDetails.size = Number(size);
        initialDetails.filename = filename;
        logger.info(`[Hook Progress - created] initialDetails after assigning hook payload: size=${initialDetails.size}, filename=${initialDetails.filename}`); // Log after assignment
        tusdProgressCache.set(uploadId, initialDetails); // Ensure cache is updated
        logger.info(`[Hook Progress] Cached initial info for ${uploadId}`);


        // Send initial Telegram message using fetched details (check if bot exists)
        if (telegramBot) {
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
        } else {
            logger.warn(`[Hook Progress] Telegram bot not available, skipping initial notification for ${uploadId}`);
        }
        // The erroneous duplicate block and stray characters have been removed from here.
        break;

      case 'post-receive':
        // Update progress as chunks arrive
        if (offset === undefined) {
          logger.warn(`[Hook Progress] 'post-receive' hook missing offset for ${uploadId}`);
          return res.status(400).json({ status: 'error', message: 'Missing offset for post-receive hook' });
        }

        // Use helper function to get details (checks cache first, then file/DB)
        let receivingDetails = await getUploadDetails(uploadId);

        if (!receivingDetails) {
          logger.warn(`[Hook Progress] Failed to get complete details via getUploadDetails for 'receiving' status, uploadId: ${uploadId}. Checking cache for partial info.`);
          // Attempt to get partial info (filename/size) from cache if full details failed
          const cachedInfo = tusdProgressCache.get(uploadId);
          if (cachedInfo) {
             logger.info(`[Hook Progress] Found partial info in cache for ${uploadId}. Using it for notification.`);
             receivingDetails = cachedInfo; // Use cached info, even if incomplete
          } else {
             logger.error(`[Hook Progress] No details found in getUploadDetails or cache for ${uploadId}. Sending notification with defaults.`);
             // Send notification with defaults only if absolutely no info is available AND bot exists
             if (telegramBot) { // Add null check here
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
                 storage: 'local', // Default storage
                 isComplete: false,
               });
             } else {
                 logger.warn(`[Hook Progress] Telegram bot not available, skipping default notification for ${uploadId}`);
             }
             // The erroneous duplicate block and stray characters have been removed from here.
             // Allow hook to succeed even if details are missing
             return res.status(200).json({ status: 'warning', message: 'Upload details not found, default notification attempted.' });
          }
        }

        // Send updated Telegram message using best available details (check if bot exists)
        if (telegramBot) {
          await telegramBot.sendUploadNotification({
            id: uploadId,
            // Use size from details if available and valid, otherwise default to 0
            size: (receivingDetails?.size !== undefined && receivingDetails.size >= 0) ? receivingDetails.size : 0,
            offset: Number(offset),
            metadata: {
              // Use filename from details if available, otherwise default
              filename: receivingDetails?.filename || 'Unknown Filename',
              // Use client/project from details if available, otherwise default
              clientName: receivingDetails?.clientName || 'Unknown Client',
              projectName: receivingDetails?.projectName || 'Unknown Project',
              // Include token if available
              token: receivingDetails?.token || 'Unknown',
            },
            // Use storage from details if available, otherwise default
            storage: receivingDetails?.storage || 'local',
            isComplete: false,
          });
        } else {
            logger.warn(`[Hook Progress] Telegram bot not available, skipping progress notification for ${uploadId}`);
        }
        // The erroneous duplicate block and stray characters have been removed from here.
        break;

      case 'post-finish':
        // Upload is fully received by Tusd. Trigger final processing.
        logger.info(`[Hook Progress] Received 'post-finish' hook for ${uploadId}. Triggering final processing.`);
        // Call the controller function, passing the correct uploadId extracted from the hook payload.
        // The controller will read the .info file using this ID.
        // We need to pass a modified request or just the ID. Let's pass req/res for now.
        // The controller already expects to extract uploadId from req.body (which we set up for the 'finished' case previously).
        // We need to ensure the controller *can* get the ID from the *actual* hook payload structure.
        // Let's modify the call to pass the ID explicitly for clarity, and adjust the controller.
        // handleProcessFinishedUpload(req, res); // Old call
        // Instead of passing req/res, we'll just trigger the logic.
        // The controller needs refactoring to accept just the ID and fetch info.
        // For now, let's adapt the controller call slightly:
        // Create a simplified body for the controller to parse temporarily
        req.body = { uploadId: uploadId }; // Overwrite req.body for the controller
        handleProcessFinishedUpload(req, res);
        // Prevent the default success response below.
        return;

      // Removed the conflicting 'post-terminate' case from this handler.
      // It is now correctly handled by TusdHooksController via tusdHooksRoutes.ts

      default:
        // Use hookType in the log message
        logger.warn(`[Hook Progress] Received unknown hook type '${hookType}' for uploadId: ${uploadId}`);
        return res.status(400).json({ status: 'error', message: `Unknown hook type: ${hookType}` });
    }

    // Respond successfully to the hook (for non-finished cases or successful terminate)
    res.status(200).json({ status: 'success', message: `Hook type '${hookType}' processed for ${uploadId}` });

  } catch (error) {
    // Use hookType in the log message
    logger.error(`[Hook Progress] Error processing hook type '${hookType}' for ${uploadId}:`, error);
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

    // Get all possible storage locations to ensure the .turbosort file is accessible everywhere
    const locations = [];
    
    // 1. Standard upload directory (legacy)
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    const projectUploadPath = path.join(uploadDir, projectId);
    locations.push(projectUploadPath);
    
    // 2. TUSD organized directory
    const tusdOrganizedDir = process.env.TUS_ORGANIZED_DIR || path.join(__dirname, '../../organized');
    if (project.client && project.client.code) {
      // Replace spaces with underscores to match the file paths
      const projectNameWithUnderscores = project.name.replace(/ /g, '_');
      const tusdProjectPath = path.join(
        tusdOrganizedDir,
        project.client.code,
        projectNameWithUnderscores
      );
      locations.push(tusdProjectPath);
    }
    
    // 3. TUSD data directory (where uploads are initially stored)
    const tusdDataDir = process.env.TUSD_DATA_DIR || '/srv/tusd-data';
    // Create a project-specific subdirectory in the TUSD data directory
    // Replace spaces with underscores to match expected directory structure
    const projectNameWithUnderscores = project.name.replace(/ /g, '_');
    const tusdProjectPath = path.join(tusdDataDir, project.client?.code || 'default', projectNameWithUnderscores);
    locations.push(tusdProjectPath);
    
    // Log all locations for debugging
    logger.info(`Setting turbosort directory "${directory}" for project ${projectId} in locations:`, locations);
    
    // Create directories and write .turbosort file to all locations
    for (const location of locations) {
      try {
        // Create the directory if it doesn't exist
        if (!fs.existsSync(location)) {
          logger.info(`Creating directory: ${location}`);
          fs.mkdirSync(location, { recursive: true });
        }
        
        // Write the .turbosort file
        const turbosortPath = path.join(location, '.turbosort');
        logger.info(`Writing .turbosort file to: ${turbosortPath}`);
        fs.writeFileSync(turbosortPath, directory);
      } catch (fsError) {
        logger.error(`Failed to write .turbosort file to ${location}:`, fsError);
        // Continue to next location, don't fail the entire request
      }
    }

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

        logger.info(`Turbosort file uploaded to S3 at key: ${s3Key}`);
      } catch (s3Error) {
        logger.error('Failed to upload turbosort file to S3:', s3Error);
        // Don't fail the request if S3 upload fails, we still have the local files
      }
    }

    res.json({
      status: 'success',
      message: 'Turbosort directory set successfully',
      data: { directory }
    });
  } catch (error) {
    logger.error('Failed to set turbosort directory:', error);
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

    // Get all possible storage locations to ensure the .turbosort file is deleted everywhere
    const locations = [];
    
    // 1. Standard upload directory (legacy)
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    const projectUploadPath = path.join(uploadDir, projectId);
    locations.push(projectUploadPath);
    
    // 2. TUSD organized directory
    const tusdOrganizedDir = process.env.TUS_ORGANIZED_DIR || path.join(__dirname, '../../organized');
    if (project.client && project.client.code) {
      const tusdProjectPath = path.join(
        tusdOrganizedDir,
        project.client.code,
        project.name
      );
      locations.push(tusdProjectPath);
    }
    
    // 3. TUSD data directory (where uploads are initially stored)
    const tusdDataDir = process.env.TUSD_DATA_DIR || '/srv/tusd-data';
    // Create a project-specific subdirectory in the TUSD data directory
    const tusdProjectPath = path.join(tusdDataDir, project.client?.code || 'default', project.name);
    locations.push(tusdProjectPath);
    
    // Log all locations for debugging
    logger.info(`Deleting turbosort file for project ${projectId} from locations:`, locations);
    
    // Delete .turbosort file from all locations
    for (const location of locations) {
      try {
        const turbosortPath = path.join(location, '.turbosort');
        
        // Check if the file exists before attempting to delete
        if (fs.existsSync(turbosortPath)) {
          logger.info(`Deleting .turbosort file from: ${turbosortPath}`);
          fs.unlinkSync(turbosortPath);
        }
      } catch (fsError) {
        logger.error(`Failed to delete .turbosort file from ${location}:`, fsError);
        // Continue to next location, don't fail the entire request
      }
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
        logger.info(`Turbosort file deleted from S3 at key: ${s3Key}`);
      } catch (s3Error) {
        logger.error('Failed to delete turbosort file from S3:', s3Error);
        // Don't fail the request if S3 deletion fails
      }
    }

    res.json({
      status: 'success',
      message: 'Turbosort file deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete turbosort file:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete turbosort file'
    });
  }
});

export default router; 
