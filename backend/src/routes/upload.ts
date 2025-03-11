import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import xxhash from 'xxhash-wasm';
import { authenticateToken } from '../middleware/auth';

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

      const uploadDir = path.join(__dirname, '../../uploads', 
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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

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

// Create an upload link for a project
router.post('/projects/:projectId/upload-links', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { expiresAt, maxUses } = req.body;
    
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
    const uploadUrl = `https://live.colourstream.johnrogerscolour.co.uk/files/${uploadLink.token}`;
    
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

    if (uploadLink.maxUses && uploadLink.usedCount >= uploadLink.maxUses) {
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

    if (uploadLink.maxUses && uploadLink.usedCount >= uploadLink.maxUses) {
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
        return existingFile;
      }

      // Create new file record
      const uploadedFile = await prisma.uploadedFile.create({
        data: {
          name: file.originalname,
          path: file.path,
          size: parseFloat(file.size.toString()),
          mimeType: file.mimetype,
          hash: fileHash,
          project: {
            connect: { id: uploadLink.projectId }
          }
        }
      });

      return uploadedFile;
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

    res.json({
      status: 'success',
      data: project
    });
  } catch (error) {
    console.error('Failed to fetch project:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch project'
    });
  }
});

export default router; 