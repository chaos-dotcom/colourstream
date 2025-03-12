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
    console.log('[TELEGRAM-DEBUG] Telegram API Base URL:', `https://api.telegram.org/bot${this.botToken.substring(0, 10)}...`);
    logger.info('Telegram API Base URL:', `https://api.telegram.org/bot${this.botToken.substring(0, 10)}...`);
  }

  /**
   * Send a message to the configured Telegram chat
   */
  async sendMessage(message: string): Promise<boolean> {
    try {
      // Convert the chat_id to a number if it's a numeric string
      const chatId = !isNaN(Number(this.chatId)) ? Number(this.chatId) : this.chatId;
      
      console.log('[TELEGRAM-DEBUG] Sending Telegram message to chat ID:', chatId);
      console.log('[TELEGRAM-DEBUG] Message content:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
      
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      });
      
      console.log('[TELEGRAM-DEBUG] Telegram API response:', JSON.stringify(response.data));
      
      return response.data.ok;
    } catch (error: any) {
      console.error('[TELEGRAM-DEBUG] Failed to send Telegram message:', error);
      logger.error('Failed to send Telegram message:', error);
      if (error.response) {
        console.error('[TELEGRAM-DEBUG] Error response data:', JSON.stringify(error.response.data));
      }
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
    
    console.log('[TELEGRAM-DEBUG] Creating upload notification message for upload:', id);
    
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

  /**
   * Send a test message to verify the bot is working
   */
  async sendTestMessage(): Promise<boolean> {
    const message = `<b>🧪 Test Message</b>\n\nThis is a test message from the ColourStream Upload Monitor. If you can see this message, the bot is properly configured to send notifications.`;
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