import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

// Initialize Prisma Client with logging options
const prisma = new PrismaClient({
  log: [
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
    { level: 'info', emit: 'stdout' },
    ...(process.env.NODE_ENV === 'development' ? [{ level: 'query', emit: 'stdout' }] : []),
  ] as Prisma.LogDefinition[],
});

// Add custom logging
const originalConnect = prisma.$connect;
prisma.$connect = async () => {
  try {
    logger.info('Connecting to database...');
    await originalConnect.apply(prisma);
    logger.info('Successfully connected to the database');
    return;
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
};

// Connect with retry logic
const connectWithRetry = async (retries = 5, delay = 5000) => {
  try {
    // Test the connection
    await prisma.$connect();
    return true;
  } catch (error) {
    if (retries <= 0) {
      logger.error('Failed to connect to the database after multiple attempts:', error);
      throw error;
    }
    
    logger.warn(`Failed to connect to the database. Retrying in ${delay}ms... (${retries} attempts left)`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return connectWithRetry(retries - 1, delay);
  }
};

// Connect to the database on startup
connectWithRetry()
  .catch((error) => {
    logger.error('Failed to establish database connection:', error);
    process.exit(1); // Exit if we can't connect to the database
  });

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received. Closing database connections...');
  await prisma.$disconnect();
  logger.info('Database connections closed');
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Closing database connections...');
  await prisma.$disconnect();
  logger.info('Database connections closed');
});

export default prisma; 