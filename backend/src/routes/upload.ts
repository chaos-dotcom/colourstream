import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import xxhash from 'xxhash-wasm';
import { v4 as uuidv4 } from 'uuid';
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
  destination: async (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
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
        uploadLink.project.client.code,
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
  filename: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Create a new client
router.post('/clients', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, code } = req.body;
    const client = await prisma.client.create({
      data: {
        name,
        code: code.toUpperCase(), // Ensure consistent casing for folder structure
      }
    });
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Get all clients
router.get('/clients', authenticateToken, async (req: Request, res: Response) => {
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
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch clients' });
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
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' });
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
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
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
    const uploadUrl = `https://upload.colourstream.johnrogerscolour.co.uk/upload/${uploadLink.token}`;
    
    res.json({
      ...uploadLink,
      uploadUrl
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create upload link' });
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
      return res.status(404).json({ error: 'Upload link not found' });
    }

    if (uploadLink.expiresAt < new Date()) {
      return res.status(403).json({ error: 'Upload link has expired' });
    }

    if (uploadLink.maxUses && uploadLink.useCount >= uploadLink.maxUses) {
      return res.status(403).json({ error: 'Upload link has reached maximum uses' });
    }

    res.json({
      clientName: uploadLink.project.client.name,
      projectName: uploadLink.project.name,
      expiresAt: uploadLink.expiresAt
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to validate upload link' });
  }
});

// Handle file upload
router.post('/upload/:token', upload.array('files'), async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const files = (req as MulterRequest).files;

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
      return res.status(404).json({ error: 'Upload link not found' });
    }

    if (uploadLink.expiresAt < new Date()) {
      return res.status(403).json({ error: 'Upload link has expired' });
    }

    if (uploadLink.maxUses && uploadLink.useCount >= uploadLink.maxUses) {
      return res.status(403).json({ error: 'Upload link has reached maximum uses' });
    }

    // Initialize XXHash64
    const xxhash64 = await xxhash();

    const uploadedFiles = await Promise.all(files.map(async (file) => {
      const fileBuffer = await fs.promises.readFile(file.path);
      const hash = xxhash64.h64Raw(Buffer.from(fileBuffer)).toString(16);

      return prisma.uploadedFile.create({
        data: {
          filename: file.originalname,
          path: file.path,
          size: BigInt(file.size),
          mimeType: file.mimetype,
          xxhash64: hash,
          projectId: uploadLink.project.id,
          uploadLinkId: uploadLink.id
        }
      });
    }));

    await prisma.uploadLink.update({
      where: { id: uploadLink.id },
      data: { useCount: { increment: 1 } }
    });

    res.json(uploadedFiles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Get project files
router.get('/projects/:projectId/files', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const files = await prisma.uploadedFile.findMany({
      where: { projectId },
      include: {
        uploadLink: true,
        project: {
          include: {
            client: true
          }
        }
      }
    });
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

export default router; 