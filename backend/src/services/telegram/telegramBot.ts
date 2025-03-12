import axios from 'axios';
import { logger } from '../../utils/logger';

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export class TelegramBot {
  private botToken: string;
  private chatId: string;
  private baseUrl: string;

  constructor(config: TelegramConfig) {
    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Send a message to the configured Telegram chat
   */
  async sendMessage(message: string): Promise<boolean> {
    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: this.chatId,
        text: message,
        parse_mode: 'HTML',
      });
      
      return response.data.ok;
    } catch (error) {
      logger.error('Failed to send Telegram message:', error);
      return false;
    }
  }

  /**
   * Send an upload status notification
   */
  async sendUploadNotification(uploadInfo: {
    id: string;
    size: number;
    offset: number;
    metadata?: Record<string, string>;
    isComplete?: boolean;
    createdAt?: Date;
    storage?: string;
  }): Promise<boolean> {
    const { id, size, offset, metadata, isComplete } = uploadInfo;
    
    // Calculate progress percentage
    const progress = size > 0 ? Math.round((offset / size) * 100) : 0;
    
    // Format file size in human-readable format
    const formatFileSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };

    // Create message with upload details
    let message = `<b>Upload Status${isComplete ? ' - COMPLETED' : ''}</b>\n`;
    message += `<b>ID:</b> ${id}\n`;
    message += `<b>Size:</b> ${formatFileSize(size)}\n`;
    message += `<b>Progress:</b> ${progress}% (${formatFileSize(offset)} / ${formatFileSize(size)})\n`;
    
    // Add metadata if available
    if (metadata && Object.keys(metadata).length > 0) {
      message += '\n<b>Metadata:</b>\n';
      Object.entries(metadata).forEach(([key, value]) => {
        message += `- ${key}: ${value}\n`;
      });
    }

    // Add estimated time remaining if not complete
    if (!isComplete && offset > 0 && size > offset) {
      // This is a very simple estimation and might not be accurate
      // A more sophisticated approach would track upload speed over time
      const remainingBytes = size - offset;
      const remainingTime = remainingBytes > 0 ? 'Calculating...' : 'Almost done';
      message += `\n<b>Estimated time remaining:</b> ${remainingTime}`;
    }

    return this.sendMessage(message);
  }
}

// Singleton instance
let botInstance: TelegramBot | null = null;

export const initTelegramBot = (config: TelegramConfig): TelegramBot => {
  if (!botInstance) {
    botInstance = new TelegramBot(config);
  }
  return botInstance;
};

export const getTelegramBot = (): TelegramBot | null => {
  return botInstance;
}; 