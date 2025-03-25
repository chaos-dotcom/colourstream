import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Use connection URL from environment or fallback to localhost
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/colourstream';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

console.log('Using database URL:', databaseUrl.replace(/:([^:@]+)@/, ':****@')); // Hide password in logs

async function createTestUploadLinks() {
  try {
    console.log('Starting to create test upload links...');

    // First, check if we already have clients
    const clientCount = await prisma.client.count();
    
    if (clientCount === 0) {
      console.log('No clients found. Creating a test client...');
      // Create a test client
      const client = await prisma.client.create({
        data: {
          name: 'Test Client',
          code: 'TEST'
        }
      });
      
      console.log(`Created test client with ID: ${client.id}`);
      
      // Create a test project
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          description: 'A test project for upload links',
          clientId: client.id
        }
      });
      
      console.log(`Created test project with ID: ${project.id}`);
      
      // Create test upload links
      for (let i = 1; i <= 3; i++) {
        const token = crypto.randomBytes(16).toString('hex');
        
        const uploadLink = await prisma.uploadLink.create({
          data: {
            token: token,
            projectId: project.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
            maxUses: i === 1 ? null : 10, // first one unlimited, others 10 uses
            usedCount: 0,
            isActive: true
          }
        });
        
        console.log(`Created test upload link #${i} with ID: ${uploadLink.id} and token: ${uploadLink.token}`);
      }
    } else {
      console.log('Clients already exist. Fetching first client...');
      // Get the first client
      const client = await prisma.client.findFirst();
      
      if (!client) {
        throw new Error('No clients found even though count > 0');
      }
      
      // Check if there are projects for this client
      const projectCount = await prisma.project.count({
        where: { clientId: client.id }
      });
      
      let projectId: string;
      
      if (projectCount === 0) {
        console.log('No projects found for client. Creating a test project...');
        // Create a test project
        const project = await prisma.project.create({
          data: {
            name: 'Test Project',
            description: 'A test project for upload links',
            clientId: client.id
          }
        });
        
        console.log(`Created test project with ID: ${project.id}`);
        projectId = project.id;
      } else {
        console.log('Projects already exist. Fetching first project...');
        // Get the first project
        const project = await prisma.project.findFirst({
          where: { clientId: client.id }
        });
        
        if (!project) {
          throw new Error('No projects found even though count > 0');
        }
        
        projectId = project.id;
      }
      
      // Check if there are already upload links
      const uploadLinkCount = await prisma.uploadLink.count();
      
      if (uploadLinkCount > 0) {
        console.log(`There are already ${uploadLinkCount} upload links in the database. Skipping creation.`);
      } else {
        console.log('No upload links found. Creating test upload links...');
        // Create test upload links
        for (let i = 1; i <= 3; i++) {
          const token = crypto.randomBytes(16).toString('hex');
          
          const uploadLink = await prisma.uploadLink.create({
            data: {
              token: token,
              projectId: projectId,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
              maxUses: i === 1 ? null : 10, // first one unlimited, others 10 uses
              usedCount: 0,
              isActive: true
            }
          });
          
          console.log(`Created test upload link #${i} with ID: ${uploadLink.id} and token: ${uploadLink.token}`);
        }
      }
    }

    console.log('Test upload links created successfully');
  } catch (error) {
    console.error('Error creating test upload links:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUploadLinks().catch(e => {
  console.error(e);
  process.exit(1);
}); 