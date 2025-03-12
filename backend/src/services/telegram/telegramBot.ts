import axios from 'axios';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

interface TelegramConfig {
  botToken: string;
  chatId: string;
  messageStoragePath?: string; // Path to store message IDs
}

export class TelegramBot {
  private botToken: string;
  private chatId: string;
  private baseUrl: string;
  private messageStoragePath: string;

  constructor(config: TelegramConfig) {
    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.messageStoragePath = config.messageStoragePath || '/tmp/telegram-messages';
    
    // Ensure the message storage directory exists
    if (!fs.existsSync(this.messageStoragePath)) {
      try {
        fs.mkdirSync(this.messageStoragePath, { recursive: true });
        console.log(`[TELEGRAM-DEBUG] Created message storage directory: ${this.messageStoragePath}`);
      } catch (error) {
        console.error(`[TELEGRAM-DEBUG] Failed to create message storage directory: ${error}`);
        logger.error(`Failed to create message storage directory: ${error}`);
      }
    }
    
    console.log('[TELEGRAM-DEBUG] Telegram API Base URL:', `https://api.telegram.org/bot${this.botToken.substring(0, 10)}...`);
    logger.info('Telegram API Base URL:', `https://api.telegram.org/bot${this.botToken.substring(0, 10)}...`);
  }

  /**
   * Get the message ID for a specific upload if it exists
   */
  private getMessageId(uploadId: string): number | null {
    try {
      const messagePath = path.join(this.messageStoragePath, `${uploadId}.msgid`);
      if (fs.existsSync(messagePath)) {
        const messageId = Number(fs.readFileSync(messagePath, 'utf8').trim());
        if (!isNaN(messageId)) {
          console.log(`[TELEGRAM-DEBUG] Found existing message ID ${messageId} for upload ${uploadId}`);
          return messageId;
        }
      }
      return null;
    } catch (error) {
      console.error(`[TELEGRAM-DEBUG] Error reading message ID for upload ${uploadId}:`, error);
      return null;
    }
  }

  /**
   * Store a message ID for a specific upload
   */
  private storeMessageId(uploadId: string, messageId: number): boolean {
    try {
      const messagePath = path.join(this.messageStoragePath, `${uploadId}.msgid`);
      fs.writeFileSync(messagePath, messageId.toString());
      console.log(`[TELEGRAM-DEBUG] Stored message ID ${messageId} for upload ${uploadId}`);
      return true;
    } catch (error) {
      console.error(`[TELEGRAM-DEBUG] Error storing message ID for upload ${uploadId}:`, error);
      return false;
    }
  }

  /**
   * Delete a stored message ID when it's no longer needed
   */
  private deleteMessageId(uploadId: string): boolean {
    try {
      const messagePath = path.join(this.messageStoragePath, `${uploadId}.msgid`);
      if (fs.existsSync(messagePath)) {
        fs.unlinkSync(messagePath);
        console.log(`[TELEGRAM-DEBUG] Deleted message ID for upload ${uploadId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[TELEGRAM-DEBUG] Error deleting message ID for upload ${uploadId}:`, error);
      return false;
    }
  }

  /**
   * Send a message to the configured Telegram chat
   */
  async sendMessage(message: string, uploadId?: string): Promise<boolean> {
    try {
      // Convert the chat_id to a number if it's a numeric string
      const chatId = !isNaN(Number(this.chatId)) ? Number(this.chatId) : this.chatId;
      
      console.log('[TELEGRAM-DEBUG] Sending Telegram message to chat ID:', chatId);
      console.log('[TELEGRAM-DEBUG] Message content:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
      
      // Check if we should edit an existing message
      let messageId = null;
      if (uploadId) {
        messageId = this.getMessageId(uploadId);
      }
      
      let response;
      if (messageId) {
        // Edit existing message
        console.log(`[TELEGRAM-DEBUG] Editing existing message ${messageId} for upload ${uploadId}`);
        response = await axios.post(`${this.baseUrl}/editMessageText`, {
          chat_id: chatId,
          message_id: messageId,
          text: message,
          parse_mode: 'HTML',
        });
      } else {
        // Send new message
        response = await axios.post(`${this.baseUrl}/sendMessage`, {
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        });
        
        // Store the message ID if this is for a specific upload
        if (uploadId && response.data.ok && response.data.result && response.data.result.message_id) {
          this.storeMessageId(uploadId, response.data.result.message_id);
        }
      }
      
      console.log('[TELEGRAM-DEBUG] Telegram API response:', JSON.stringify(response.data));
      
      return response.data.ok;
    } catch (error: any) {
      console.error('[TELEGRAM-DEBUG] Failed to send/edit Telegram message:', error);
      logger.error('Failed to send/edit Telegram message:', error);
      
      // If editing failed, try sending a new message
      if (uploadId && error.response && error.response.data && error.response.status === 400) {
        try {
          console.log(`[TELEGRAM-DEBUG] Edit failed, sending new message for upload ${uploadId}`);
          const chatId = !isNaN(Number(this.chatId)) ? Number(this.chatId) : this.chatId;
          
          const response = await axios.post(`${this.baseUrl}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
          });
          
          // Store the new message ID
          if (response.data.ok && response.data.result && response.data.result.message_id) {
            this.storeMessageId(uploadId, response.data.result.message_id);
          }
          
          return response.data.ok;
        } catch (fallbackError) {
          console.error('[TELEGRAM-DEBUG] Fallback message send also failed:', fallbackError);
        }
      }
      
      if (error.response) {
        console.error('[TELEGRAM-DEBUG] Error response data:', JSON.stringify(error.response.data));
      }
      return false;
    }
  }

  /**
   * Edit an existing message
   */
  async editMessage(messageId: number, message: string): Promise<boolean> {
    try {
      // Convert the chat_id to a number if it's a numeric string
      const chatId = !isNaN(Number(this.chatId)) ? Number(this.chatId) : this.chatId;
      
      console.log('[TELEGRAM-DEBUG] Editing Telegram message ID:', messageId);
      console.log('[TELEGRAM-DEBUG] New message content:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
      
      const response = await axios.post(`${this.baseUrl}/editMessageText`, {
        chat_id: chatId,
        message_id: messageId,
        text: message,
        parse_mode: 'HTML',
      });
      
      console.log('[TELEGRAM-DEBUG] Telegram API response:', JSON.stringify(response.data));
      
      return response.data.ok;
    } catch (error: any) {
      console.error('[TELEGRAM-DEBUG] Failed to edit Telegram message:', error);
      logger.error('Failed to edit Telegram message:', error);
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

    // Delete the message ID if the upload is complete (for cleanup)
    if (isComplete) {
      const success = await this.sendMessage(message, id);
      this.deleteMessageId(id);
      return success;
    }

    return this.sendMessage(message, id);
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