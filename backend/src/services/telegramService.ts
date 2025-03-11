import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

class TelegramService {
  private botToken: string;
  private chatId: string;
  private baseUrl: string;
  private enabled: boolean;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.enabled = Boolean(this.botToken && this.chatId);
    
    if (!this.enabled) {
      logger.warn('Telegram notifications are disabled. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables to enable.');
    } else {
      logger.info('Telegram notification service initialized');
    }
  }

  /**
   * Send a notification about a file upload
   * @param fileId The ID of the uploaded file
   * @returns Promise<boolean> Whether the notification was sent successfully
   */
  async sendFileUploadNotification(fileId: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      // Fetch file details from the database
      const file = await prisma.uploadedFile.findUnique({
        where: { id: fileId },
        include: {
          project: {
            include: {
              client: true
            }
          }
        }
      });

      if (!file) {
        logger.error(`File with ID ${fileId} not found for Telegram notification`);
        return false;
      }

      // Format the message
      const message = this.formatFileUploadMessage(file);
      
      // Send the message to Telegram
      await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: this.chatId,
        text: message,
        parse_mode: 'HTML'
      });

      logger.info(`Telegram notification sent for file upload ID: ${fileId}`);
      return true;
    } catch (error) {
      logger.error('Error sending Telegram notification:', error);
      return false;
    }
  }

  /**
   * Format a message for a file upload notification
   */
  private formatFileUploadMessage(file: any): string {
    const clientName = file.project.client.name || 'Unknown Client';
    const projectName = file.project.name || 'Unknown Project';
    const fileName = file.name || 'Unnamed File';
    const fileSize = this.formatFileSize(file.size || 0);
    const uploadedAt = new Date(file.completedAt || Date.now()).toLocaleString();

    return `<b>🔔 New File Upload</b>\n\n` +
           `<b>Client:</b> ${clientName}\n` +
           `<b>Project:</b> ${projectName}\n` +
           `<b>File:</b> ${fileName}\n` +
           `<b>Size:</b> ${fileSize}\n` +
           `<b>Uploaded at:</b> ${uploadedAt}`;
  }

  /**
   * Format file size in a human-readable format
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const telegramService = new TelegramService(); 