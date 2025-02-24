import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';

export async function updatePasswordHash(newPassword: string): Promise<void> {
  try {
    const envPath = '/app/.env';
    const envContent = await fs.readFile(envPath, 'utf-8');
    const updatedContent = envContent.replace(
      /ADMIN_PASSWORD=.*/,
      `ADMIN_PASSWORD=${newPassword}`
    );
    await fs.writeFile(envPath, updatedContent);
    logger.info('Successfully updated .env file');
  } catch (error) {
    logger.error('Failed to update .env file:', error);
    throw error;
  }
} 