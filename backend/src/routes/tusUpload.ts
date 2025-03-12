import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const prisma = new PrismaClient();

// Define the UploadStatus enum inline since it seems to be missing from the Prisma client
enum UploadStatus {
  uploading = 'uploading',
  completed = 'completed',
  cancelled = 'cancelled',
  error = 'error'
}

interface TusHookEvent {
  Upload: {
    ID: string;
    Size: number;
    MetaData: {
      filename: string;
      filetype: string;
      projectId?: string;
      token?: string;
      clientName?: string;
      projectName?: string;
    };
    Storage: {
      Type: string;
      Path: string;
      Bucket?: string;
      Key?: string;
    };
  };
  Type: 'pre-create' | 'post-create' | 'post-finish' | 'post-terminate';
}

// Define the uploads directory path
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// TUS webhook handler
router.post('/hooks', async (req: Request, res: Response) => {
  try {
    console.log('TUS webhook received:', JSON.stringify(req.body));
    const event = req.body as TusHookEvent;
    const { Upload, Type } = event;
    
    // Handle case where MetaData might be missing or incomplete
    const filename = Upload.MetaData?.filename || 'unnamed-file';
    const token = Upload.MetaData?.token || null;
    const clientName = Upload.MetaData?.clientName || null;
    const projectName = Upload.MetaData?.projectName || null;
    let projectId = Upload.MetaData?.projectId || 'default';

    // Log the metadata we received
    console.log('Upload metadata:', {
      filename,
      token,
      clientName,
      projectName,
      projectId
    });

    // If token is provided, try to find the associated project
    if (token) {
      try {
        const uploadLink = await prisma.uploadLink.findUnique({
          where: { token },
          include: {
            project: true
          }
        });

        if (uploadLink) {
          // Found a valid upload link, use its project ID
          projectId = uploadLink.projectId;
          
          // Update the upload link usage count for post-finish events
          if (Type === 'post-finish') {
            await prisma.uploadLink.update({
              where: { id: uploadLink.id },
              data: { usedCount: { increment: 1 } }
            });
          }
          
          console.log(`Using project ID ${projectId} from upload link token ${token}`);
        }
      } catch (err) {
        console.error('Error finding upload link by token:', err);
      }
    }

    switch (Type) {
      case 'pre-create':
        // Validate the upload request
        // For the default project, we'll skip project validation
        if (projectId !== 'default') {
          const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { client: true }
          });

          if (!project) {
            return res.status(404).json({
              status: 'error',
              message: 'Project not found'
            });
          }
        }

        // Additional validations can be added here
        return res.status(200).json({ status: 'success' });

      case 'post-create':
        // Record the upload initiation
        await prisma.uploadedFile.create({
          data: {
            project: {
              connect: { id: projectId }
            },
            name: filename,
            size: parseFloat(Upload.Size.toString()), // Use parseFloat for Float type
            mimeType: Upload.MetaData.filetype || 'application/octet-stream',
            status: UploadStatus.uploading,
            tusId: Upload.ID,
            path: Upload.Storage.Path,
            s3Key: Upload.Storage.Key,
            s3Bucket: Upload.Storage.Bucket,
          }
        });
        break;

      case 'post-finish':
        // For local storage, create a symlink to the uploaded file
        // with a more recognizable name
        const sourcePath = Upload.Storage.Path;
        const destPath = path.join(UPLOADS_DIR, `${Upload.ID}_${filename}`);
        
        // Create a symlink to the original file
        try {
          if (fs.existsSync(sourcePath)) {
            // On Linux/macOS, create a symlink
            fs.symlinkSync(sourcePath, destPath);
            console.log(`Created symlink from ${sourcePath} to ${destPath}`);
          } else {
            console.error(`Source file not found: ${sourcePath}`);
          }
        } catch (err) {
          console.error('Error creating symlink:', err);
        }

        // Update the file status to completed
        await prisma.uploadedFile.updateMany({
          where: {
            tusId: Upload.ID
          },
          data: {
            status: UploadStatus.completed,
            completedAt: new Date(),
            path: destPath, // Update the path to the symlink
          }
        });
        break;

      case 'post-terminate':
        // Update the file status to cancelled
        await prisma.uploadedFile.updateMany({
          where: {
            tusId: Upload.ID
          },
          data: {
            status: UploadStatus.cancelled,
          }
        });
        break;
    }

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('TUS webhook error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process TUS webhook'
    });
  }
});

// Get upload status
router.get('/status/:tusId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tusId } = req.params;
    const file = await prisma.uploadedFile.findFirst({
      where: {
        tusId
      },
      include: {
        project: {
          include: {
            client: true
          }
        }
      }
    });

    if (!file) {
      return res.status(404).json({
        status: 'error',
        message: 'Upload not found'
      });
    }

    // No need to convert size to string anymore since it's a float
    const response = {
      status: 'success',
      data: file
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch upload status'
    });
  }
});

export default router; 