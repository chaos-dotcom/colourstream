import fs from 'fs/promises';
import path from 'path';

export async function updatePasswordHash(newHash: string): Promise<void> {
  try {
    const envPath = path.join(process.cwd(), '.env');
    const envContent = await fs.readFile(envPath, 'utf-8');
    const updatedContent = envContent.replace(
      /ADMIN_PASSWORD_HASH=.*/,
      `ADMIN_PASSWORD_HASH=${newHash}`
    );
    await fs.writeFile(envPath, updatedContent);
  } catch (error) {
    console.error('Failed to update .env file:', error);
    throw error;
  }
} 