import axios from 'axios';
import { logger } from '../../utils/logger';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma client for database operations
const prisma = new PrismaClient();

interface TelegramConfig {
  botToken: string;
  chatId: string;
  messageStoragePath?: string; // This is kept for backward compatibility
}

export class TelegramBot {
  private botToken: string;
  private chatId: string;
  private baseUrl: string;
  private messageIdCache: Map<string, number>; // In-memory cache for message IDs

  constructor(config: TelegramConfig) {
    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.messageIdCache = new Map<string, number>(); // Initialize the cache
    
    // Log initialization
    console.log('[TELEGRAM-DEBUG] Telegram API Base URL:', `https://api.telegram.org/bot${this.botToken.substring(0, 10)}...`);
    logger.info('Telegram API Base URL:', `https://api.telegram.org/bot${this.botToken.substring(0, 10)}...`);
  }

  /**
   * Get the message ID for a specific upload from the database
   */
  private async getMessageId(uploadId: string): Promise<number | null> {
    // First check the in-memory cache for immediate retrieval
    if (this.messageIdCache.has(uploadId)) {
      const messageId = this.messageIdCache.get(uploadId);
      console.log(`[TELEGRAM-DEBUG] Found message ID ${messageId} in memory cache for upload ${uploadId}`);
      return messageId || null;
    }
    
    try {
      // Query the database for the message ID
      // Check if our model exists yet (after migration) to avoid runtime errors
      // @ts-ignore - We're checking this at runtime
      if (!prisma.telegramMessage) {
        console.log(`[TELEGRAM-DEBUG] TelegramMessage model not yet available in Prisma client`);
        return null;
      }
      
      // @ts-ignore - We've checked it exists at runtime
      const messageRecord = await prisma.telegramMessage.findUnique({
        where: { uploadId }
      });
      
      if (messageRecord) {
        // Update the in-memory cache
        this.messageIdCache.set(uploadId, messageRecord.messageId);
        console.log(`[TELEGRAM-DEBUG] Found existing message ID ${messageRecord.messageId} for upload ${uploadId} in database`);
        return messageRecord.messageId;
      }
      
      console.log(`[TELEGRAM-DEBUG] No message ID found for upload ${uploadId}`);
      return null;
    } catch (error) {
      console.error(`[TELEGRAM-DEBUG] Error retrieving message ID for upload ${uploadId}:`, error);
      return null;
    }
  }

  /**
   * Store a message ID for a specific upload in the database
   */
  private async storeMessageId(uploadId: string, messageId: number): Promise<boolean> {
    try {
      // Update the in-memory cache first for immediate access
      this.messageIdCache.set(uploadId, messageId);
      
      // Check if our model exists yet (after migration) to avoid runtime errors
      // @ts-ignore - We're checking this at runtime
      if (!prisma.telegramMessage) {
        console.log(`[TELEGRAM-DEBUG] TelegramMessage model not yet available in Prisma client, using memory cache only`);
        return true;
      }
      
      // Then store in the database
      // @ts-ignore - We've checked it exists at runtime
      await prisma.telegramMessage.upsert({
        where: { uploadId },
        update: { 
          messageId,
          chatId: this.chatId
        },
        create: {
          uploadId,
          messageId,
          chatId: this.chatId
        }
      });
      
      console.log(`[TELEGRAM-DEBUG] Stored message ID ${messageId} for upload ${uploadId} in database`);
      return true;
    } catch (error) {
      console.error(`[TELEGRAM-DEBUG] Error storing message ID for upload ${uploadId}:`, error);
      return false;
    }
  }

  /**
   * Delete a stored message ID when it's no longer needed
   */
  private async deleteMessageId(uploadId: string): Promise<boolean> {
    try {
      // Remove from the in-memory cache first
      this.messageIdCache.delete(uploadId);
      
      // Check if our model exists yet (after migration) to avoid runtime errors
      // @ts-ignore - We're checking this at runtime
      if (!prisma.telegramMessage) {
        console.log(`[TELEGRAM-DEBUG] TelegramMessage model not yet available in Prisma client, using memory cache only`);
        return true;
      }
      
      // Then remove from the database
      // @ts-ignore - We've checked it exists at runtime
      await prisma.telegramMessage.delete({
        where: { uploadId }
      });
      
      console.log(`[TELEGRAM-DEBUG] Deleted message ID for upload ${uploadId} from database`);
      return true;
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
        messageId = await this.getMessageId(uploadId);
      }
      
      let response;
      if (messageId) {
        // Edit existing message
        console.log(`[TELEGRAM-DEBUG] Editing existing message ${messageId} for upload ${uploadId}`);
        try {
          response = await axios.post(`${this.baseUrl}/editMessageText`, {
            chat_id: chatId,
            message_id: messageId,
            text: message,
            parse_mode: 'HTML',
          });
          console.log('[TELEGRAM-DEBUG] Successfully edited message');
        } catch (editError: any) {
          console.error('[TELEGRAM-DEBUG] Error editing message:', editError.message);
          console.log('[TELEGRAM-DEBUG] Edit error response:', editError.response?.data || 'No response data');
          
          // If editing fails, send a new message instead
          console.log(`[TELEGRAM-DEBUG] Falling back to sending a new message for ${uploadId}`);
          response = await axios.post(`${this.baseUrl}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
          });
          
          // Update the message ID for this upload
          if (uploadId && response.data.ok && response.data.result && response.data.result.message_id) {
            await this.storeMessageId(uploadId, response.data.result.message_id);
          }
        }
      } else {
        // Send new message
        console.log(`[TELEGRAM-DEBUG] No existing message found for ${uploadId || 'unknown'}, sending new message`);
        response = await axios.post(`${this.baseUrl}/sendMessage`, {
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        });
        
        // Store the message ID if this is for a specific upload
        if (uploadId && response.data.ok && response.data.result && response.data.result.message_id) {
          await this.storeMessageId(uploadId, response.data.result.message_id);
        }
      }
      
      console.log('[TELEGRAM-DEBUG] Telegram API response:', JSON.stringify(response.data));
      
      return response.data.ok;
    } catch (error: any) {
      console.error('[TELEGRAM-DEBUG] Failed to send/edit Telegram message:', error.message);
      logger.error('Failed to send/edit Telegram message:', error.message);
      
      // If all else fails, try sending a new message
      if (uploadId) {
        try {
          console.log(`[TELEGRAM-DEBUG] Final fallback: sending new message for upload ${uploadId}`);
          const chatId = !isNaN(Number(this.chatId)) ? Number(this.chatId) : this.chatId;
          
          const response = await axios.post(`${this.baseUrl}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
          });
          
          // Store the new message ID
          if (response.data.ok && response.data.result && response.data.result.message_id) {
            await this.storeMessageId(uploadId, response.data.result.message_id);
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
    uploadSpeed?: number;
    storage?: string;
  }): Promise<boolean> {
    const { id, size, offset, metadata, isComplete, uploadSpeed } = uploadInfo;
    
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

    // Format transfer speed in human-readable format
    const formatSpeed = (bytesPerSecond: number): string => {
      if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(2)} B/s`;
      if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`;
      if (bytesPerSecond < 1024 * 1024 * 1024) return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
      return `${(bytesPerSecond / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
    };

    // Get emojis for status - keep these important ones
    const getProgressEmoji = (progress: number): string => {
      if (progress === 0) return '🆕';
      if (progress < 50) return '🔄';
      if (progress < 100) return '📤';
      return '✅';
    };

    // Create message with upload details and fewer emojis
    let message = '';
    if (isComplete) {
      message = `<b>✅ Upload Completed!</b>\n`;
    } else {
      const progressEmoji = getProgressEmoji(progress);
      message = `<b>${progressEmoji} Upload in Progress</b>\n`;
    }
    
    message += `<b>File:</b> ${metadata?.filename || 'Unknown'}\n`;
    message += `<b>Size:</b> ${formatFileSize(size)}\n`;
    message += `<b>ID:</b> ${id}\n`;
    
    // Add specific details about progress
    if (progress < 100) {
      message += `<b>Progress:</b> ${progress}% (${formatFileSize(offset)} / ${formatFileSize(size)})\n`;
    } else {
      message += `<b>Progress:</b> 100% Complete!\n`;
    }
    
    // Add upload speed if available and not a completed upload
    if (uploadSpeed && !isComplete && uploadSpeed > 0) {
      message += `<b>Speed:</b> ${formatSpeed(uploadSpeed)}\n`;
    }
    
    // Add client and project information if available
    if (metadata?.clientName) {
      message += `<b>Client:</b> ${metadata.clientName}\n`;
    }
    
    if (metadata?.projectName) {
      message += `<b>Project:</b> ${metadata.projectName}\n`;
    }
    
    // Add upload type/method if available
    if (id.startsWith('xhr-')) {
      message += `<b>Method:</b> XHR Upload\n`;
    } else {
      message += `<b>Method:</b> TUS Upload\n`;
    }
    
    // Add estimated time remaining if not complete
    if (!isComplete && offset > 0 && size > offset) {
      if (uploadSpeed && uploadSpeed > 0) {
        // Calculate estimated time remaining based on current speed
        const remainingBytes = size - offset;
        const remainingTimeSeconds = remainingBytes / uploadSpeed;
        
        // Format the remaining time
        let remainingTimeStr: string;
        if (remainingTimeSeconds < 60) {
          remainingTimeStr = `${Math.ceil(remainingTimeSeconds)} seconds`;
        } else if (remainingTimeSeconds < 3600) {
          remainingTimeStr = `${Math.ceil(remainingTimeSeconds / 60)} minutes`;
        } else {
          const hours = Math.floor(remainingTimeSeconds / 3600);
          const minutes = Math.ceil((remainingTimeSeconds % 3600) / 60);
          remainingTimeStr = `${hours} hours, ${minutes} minutes`;
        }
        
        message += `<b>Time remaining:</b> ${remainingTimeStr}\n`;
      } else {
        // Fallback if we don't have speed data
        const remainingBytes = size - offset;
        const remainingTime = remainingBytes > 0 ? 'Calculating...' : 'Almost done';
        message += `<b>Time remaining:</b> ${remainingTime}\n`;
      }
    }
    
    // Add completion timestamp if completed
    if (isComplete) {
      const now = new Date();
      message += `<b>Completed at:</b> ${now.toLocaleString()}\n`;
    }

    // Check if there's already a message ID for this upload before sending
    const existingMessageId = await this.getMessageId(id);
    console.log(`[TELEGRAM-DEBUG] Looking for existing message ID for upload ${id}: ${existingMessageId ? existingMessageId : 'Not found'}`);
    
    // If we have a message ID, indicate we're editing
    if (existingMessageId) {
      console.log(`[TELEGRAM-DEBUG] Editing existing message ${existingMessageId} for upload ${id}`);
    } else {
      console.log(`[TELEGRAM-DEBUG] Sending new message for upload ${id}`);
    }

    // Send message with upload ID for editing
    const success = await this.sendMessage(message, id);
    
    // If upload is complete, we should clean up the message ID after a delay
    // to ensure proper editing has occurred
    if (isComplete && success) {
      // Wait 10 seconds before removing the message ID 
      // to ensure edit operations have completed
      setTimeout(async () => {
        console.log(`[TELEGRAM-DEBUG] Cleaning up message ID after completion for ${id}`);
        await this.deleteMessageId(id);
      }, 10000);
    }
    
    return success;
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