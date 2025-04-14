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
    try {
      // First check the in-memory cache for immediate retrieval
      if (this.messageIdCache.has(uploadId)) {
        const messageId = this.messageIdCache.get(uploadId);
        logger.info(`[TELEGRAM] Found message ID ${messageId} in memory cache for upload ${uploadId}`);
        console.log(`[TELEGRAM] Found message ID ${messageId} in memory cache for upload ${uploadId}`);
        return messageId || null;
      }
      
      // Check if our model exists yet (after migration) to avoid runtime errors
      // @ts-ignore - We're checking this at runtime
      if (!prisma.telegramMessage) {
        logger.warn(`[TELEGRAM] TelegramMessage model not yet available in Prisma client`);
        console.log(`[TELEGRAM] TelegramMessage model not yet available in Prisma client`);
        return null;
      }
      
      try {
        // @ts-ignore - We've checked it exists at runtime
        const messageRecord = await prisma.telegramMessage.findUnique({
          where: { uploadId }
        });
        
        if (messageRecord) {
          // Update the in-memory cache
          this.messageIdCache.set(uploadId, messageRecord.messageId);
          logger.info(`[TELEGRAM] Found message ID ${messageRecord.messageId} for upload ${uploadId} in database`);
          console.log(`[TELEGRAM] Found message ID ${messageRecord.messageId} for upload ${uploadId} in database`);
          return messageRecord.messageId;
        }
        
        logger.info(`[TELEGRAM] No message ID found for upload ${uploadId}`);
        console.log(`[TELEGRAM] No message ID found for upload ${uploadId}`);
        return null;
      } catch (dbError: any) {
        // Handle database-specific errors
        logger.error(`[TELEGRAM] Database error retrieving message ID for upload ${uploadId}: ${dbError.message}`);
        console.error(`[TELEGRAM] Database error retrieving message ID for upload ${uploadId}:`, dbError.message);
        return null;
      }
    } catch (error: any) {
      logger.error(`[TELEGRAM] Error retrieving message ID for upload ${uploadId}: ${error.message}`);
      console.error(`[TELEGRAM] Error retrieving message ID for upload ${uploadId}:`, error.message);
      return null;
    }
  }

  /**
   * Store a message ID for a specific upload in the database
   */
  private async storeMessageId(uploadId: string, messageId: number): Promise<boolean> {
    try {
      // Validate inputs
      if (!uploadId || !messageId) {
        logger.error(`[TELEGRAM] Invalid inputs for storeMessageId: uploadId=${uploadId}, messageId=${messageId}`);
        console.error(`[TELEGRAM] Invalid inputs for storeMessageId: uploadId=${uploadId}, messageId=${messageId}`);
        return false;
      }
      
      // Update the in-memory cache first for immediate access
      this.messageIdCache.set(uploadId, messageId);
      logger.info(`[TELEGRAM] Updated in-memory cache with message ID ${messageId} for upload ${uploadId}`);
      console.log(`[TELEGRAM] Updated in-memory cache with message ID ${messageId} for upload ${uploadId}`);
      
      // Check if our model exists yet (after migration) to avoid runtime errors
      // @ts-ignore - We're checking this at runtime
      if (!prisma.telegramMessage) {
        logger.warn(`[TELEGRAM] TelegramMessage model not yet available in Prisma client, using memory cache only`);
        console.log(`[TELEGRAM] TelegramMessage model not yet available in Prisma client, using memory cache only`);
        return true;
      }
      
      try {
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
        
        logger.info(`[TELEGRAM] Successfully stored message ID ${messageId} for upload ${uploadId} in database`);
        console.log(`[TELEGRAM] Successfully stored message ID ${messageId} for upload ${uploadId} in database`);
        return true;
      } catch (dbError: any) {
        logger.error(`[TELEGRAM] Database error storing message ID for upload ${uploadId}: ${dbError.message}`);
        console.error(`[TELEGRAM] Database error storing message ID for upload ${uploadId}:`, dbError.message);
        
        // Even if DB storage fails, we still have the in-memory cache
        logger.info(`[TELEGRAM] Falling back to in-memory cache only for message ID ${messageId} (upload ${uploadId})`);
        console.log(`[TELEGRAM] Falling back to in-memory cache only for message ID ${messageId} (upload ${uploadId})`);
        return true;
      }
    } catch (error: any) {
      logger.error(`[TELEGRAM] Error storing message ID for upload ${uploadId}: ${error.message}`);
      console.error(`[TELEGRAM] Error storing message ID for upload ${uploadId}:`, error.message);
      return false;
    }
  }

  /**
   * Public method to clean up the stored message ID for a given upload.
   * This is typically called after termination or successful completion handling.
   */
  public async cleanupUploadMessage(uploadId: string): Promise<boolean> {
    console.log(`[TELEGRAM-DEBUG] Received request to clean up message ID for upload ${uploadId}`);
    // Call the private method internally
    return this.deleteMessageId(uploadId);
  }

  /**
   * Delete a stored message ID when it's no longer needed
   */
  private async deleteMessageId(uploadId: string): Promise<boolean> {
    try {
      // Validate input
      if (!uploadId) {
        logger.error(`[TELEGRAM] Invalid uploadId for deleteMessageId: ${uploadId}`);
        console.error(`[TELEGRAM] Invalid uploadId for deleteMessageId: ${uploadId}`);
        return false;
      }
      
      // Remove from the in-memory cache first
      const hadCachedValue = this.messageIdCache.has(uploadId);
      this.messageIdCache.delete(uploadId);
      
      logger.info(`[TELEGRAM] Removed message ID for upload ${uploadId} from memory cache (existed: ${hadCachedValue})`);
      console.log(`[TELEGRAM] Removed message ID for upload ${uploadId} from memory cache (existed: ${hadCachedValue})`);
      
      // Check if our model exists yet (after migration) to avoid runtime errors
      // @ts-ignore - We're checking this at runtime
      if (!prisma.telegramMessage) {
        logger.warn(`[TELEGRAM] TelegramMessage model not yet available in Prisma client, using memory cache only`);
        console.log(`[TELEGRAM] TelegramMessage model not yet available in Prisma client, using memory cache only`);
        return true;
      }
      
      try {
        // Check if the record exists before trying to delete it
        // @ts-ignore - We've checked it exists at runtime
        const existingRecord = await prisma.telegramMessage.findUnique({
          where: { uploadId }
        });
        
        if (existingRecord) {
          // Then remove from the database
          // @ts-ignore - We've checked it exists at runtime
          await prisma.telegramMessage.delete({
            where: { uploadId }
          });
          
          logger.info(`[TELEGRAM] Successfully deleted message ID for upload ${uploadId} from database`);
          console.log(`[TELEGRAM] Successfully deleted message ID for upload ${uploadId} from database`);
        } else {
          logger.info(`[TELEGRAM] No database record found for upload ${uploadId} to delete`);
          console.log(`[TELEGRAM] No database record found for upload ${uploadId} to delete`);
        }
        
        return true;
      } catch (dbError: any) {
        // Handle specific database errors
        if (dbError.code === 'P2025') { // Prisma's "Record not found" error code
          logger.info(`[TELEGRAM] No database record found for upload ${uploadId} to delete`);
          console.log(`[TELEGRAM] No database record found for upload ${uploadId} to delete`);
          return true; // Not an error if record doesn't exist
        }
        
        logger.error(`[TELEGRAM] Database error deleting message ID for upload ${uploadId}: ${dbError.message}`);
        console.error(`[TELEGRAM] Database error deleting message ID for upload ${uploadId}:`, dbError.message);
        return false;
      }
    } catch (error: any) {
      logger.error(`[TELEGRAM] Error deleting message ID for upload ${uploadId}: ${error.message}`);
      console.error(`[TELEGRAM] Error deleting message ID for upload ${uploadId}:`, error.message);
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
      
      logger.info(`[TELEGRAM] Sending message to chat ID: ${chatId}, upload ID: ${uploadId || 'N/A'}`);
      console.log('[TELEGRAM] Sending message to chat ID:', chatId, 'upload ID:', uploadId || 'N/A');
      
      // Check if we should edit an existing message
      let messageId = null;
      if (uploadId) {
        messageId = await this.getMessageId(uploadId);
        logger.info(`[TELEGRAM] Message ID for upload ${uploadId}: ${messageId || 'Not found'}`);
      }
      
      let response;
      if (messageId) {
        // Edit existing message
        logger.info(`[TELEGRAM] Editing existing message ${messageId} for upload ${uploadId}`);
        console.log(`[TELEGRAM] Editing existing message ${messageId} for upload ${uploadId}`);
        
        try {
          response = await axios.post(`${this.baseUrl}/editMessageText`, {
            chat_id: chatId,
            message_id: messageId,
            text: message,
            parse_mode: 'HTML',
          });
          logger.info(`[TELEGRAM] Successfully edited message ${messageId}`);
          console.log(`[TELEGRAM] Successfully edited message ${messageId}`);
        } catch (editError: any) {
          logger.error(`[TELEGRAM] Error editing message ${messageId}: ${editError.message}`);
          console.error(`[TELEGRAM] Error editing message ${messageId}:`, editError.message);
          
          const errorData = editError.response?.data;
          logger.error(`[TELEGRAM] Edit error response: ${JSON.stringify(errorData || 'No response data')}`);
          
          // Check if the error is specifically "message is not modified"
          if (errorData?.error_code === 400 && errorData?.description?.includes('message is not modified')) {
            logger.info(`[TELEGRAM] Edit failed because message content is identical. Treating as success for upload ${uploadId}.`);
            console.log(`[TELEGRAM] Edit failed because message content is identical. Treating as success for upload ${uploadId}.`);
            // Message is already correct, no need to send a new one. Return true.
            return true; 
          } else if (errorData?.error_code === 400 && errorData?.description?.includes('message to edit not found')) {
            // Message was deleted or doesn't exist anymore
            logger.warn(`[TELEGRAM] Message ${messageId} to edit not found. Will send as new message.`);
            console.log(`[TELEGRAM] Message ${messageId} to edit not found. Will send as new message.`);
            // Remove the invalid message ID from our cache and database
            await this.deleteMessageId(uploadId);
            messageId = null; // Reset messageId so we'll send a new message below
          } else {
            // For other edit errors, fall back to sending a new message
            logger.warn(`[TELEGRAM] Falling back to sending a new message for ${uploadId} due to edit error.`);
            console.log(`[TELEGRAM] Falling back to sending a new message for ${uploadId} due to edit error.`);
            
            try {
              response = await axios.post(`${this.baseUrl}/sendMessage`, {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
              });
              
              // Update the message ID for this upload if fallback succeeds
              if (uploadId && response.data.ok && response.data.result && response.data.result.message_id) {
                const newMessageId = response.data.result.message_id;
                logger.info(`[TELEGRAM] Fallback successful, storing new message ID ${newMessageId} for upload ${uploadId}`);
                console.log(`[TELEGRAM] Fallback successful, storing new message ID ${newMessageId} for upload ${uploadId}`);
                await this.storeMessageId(uploadId, newMessageId);
              }
            } catch (fallbackError: any) {
              logger.error(`[TELEGRAM] Fallback send also failed: ${fallbackError.message}`);
              console.error(`[TELEGRAM] Fallback send also failed:`, fallbackError.message);
              // We'll handle this in the main catch block
              throw fallbackError;
            }
          }
        }
      }

      // If no messageId existed OR editing failed and we need to send a new message
      if (!response && messageId === null) {
        logger.info(`[TELEGRAM] Sending new message for upload ${uploadId || 'unknown'}`);
        console.log(`[TELEGRAM] Sending new message for upload ${uploadId || 'unknown'}`);
        
        try {
          response = await axios.post(`${this.baseUrl}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
          });
          
          // Store the message ID if this is for a specific upload and the call was successful
          if (uploadId && response.data.ok && response.data.result && response.data.result.message_id) {
            const newMessageId = response.data.result.message_id;
            logger.info(`[TELEGRAM] New message sent, storing message ID ${newMessageId} for upload ${uploadId}`);
            console.log(`[TELEGRAM] New message sent, storing message ID ${newMessageId} for upload ${uploadId}`);
            await this.storeMessageId(uploadId, newMessageId);
          }
        } catch (sendError: any) {
          logger.error(`[TELEGRAM] Error sending new message: ${sendError.message}`);
          console.error(`[TELEGRAM] Error sending new message:`, sendError.message);
          throw sendError; // Re-throw to be caught by the main catch block
        }
      }

      // Ensure response is defined before proceeding
      if (!response) {
        logger.error(`[TELEGRAM] Critical error: Response object is undefined after send/edit attempts for upload ${uploadId || 'unknown'}`);
        console.error(`[TELEGRAM] Critical error: Response object is undefined after send/edit attempts for upload ${uploadId || 'unknown'}`);
        return false;
      }

      logger.info(`[TELEGRAM] API response: ${JSON.stringify(response.data)}`);
      
      return response.data.ok;
    } catch (error: any) {
      logger.error(`[TELEGRAM] Failed to send/edit message: ${error.message}`);
      console.error(`[TELEGRAM] Failed to send/edit message:`, error.message);

      if (error.response) {
        logger.error(`[TELEGRAM] Error response data: ${JSON.stringify(error.response.data)}`);
        console.error(`[TELEGRAM] Error response data:`, JSON.stringify(error.response.data));
      }

      // Final fallback - try one more time with a simple message if we have an uploadId
      if (uploadId) {
        logger.info(`[TELEGRAM] Attempting final fallback for upload ${uploadId}`);
        console.log(`[TELEGRAM] Attempting final fallback for upload ${uploadId}`);
        
        try {
          // Simplify the message to reduce chances of parsing errors
          const simplifiedMessage = `Upload Status: ${uploadId}\n\n${message.replace(/<[^>]*>/g, '')}`;
          
          const chatId = !isNaN(Number(this.chatId)) ? Number(this.chatId) : this.chatId;
          const fallbackResponse = await axios.post(`${this.baseUrl}/sendMessage`, {
            chat_id: chatId,
            text: simplifiedMessage,
            parse_mode: 'Markdown', // Try markdown instead of HTML as fallback
          });

          if (fallbackResponse.data.ok && fallbackResponse.data.result && fallbackResponse.data.result.message_id) {
            const newMessageId = fallbackResponse.data.result.message_id;
            logger.info(`[TELEGRAM] Final fallback successful, storing message ID ${newMessageId} for upload ${uploadId}`);
            console.log(`[TELEGRAM] Final fallback successful, storing message ID ${newMessageId} for upload ${uploadId}`);
            await this.storeMessageId(uploadId, newMessageId);
            return true;
          }
        } catch (fallbackError: any) {
          logger.error(`[TELEGRAM] Final fallback failed: ${fallbackError.message}`);
          console.error(`[TELEGRAM] Final fallback failed:`, fallbackError.message);
        }
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
    
    logger.info(`[TELEGRAM] Creating upload notification for upload: ${id}, progress: ${size > 0 ? Math.round((offset / size) * 100) : 0}%, complete: ${isComplete ? 'yes' : 'no'}`);
    console.log(`[TELEGRAM] Creating upload notification for upload: ${id}, progress: ${size > 0 ? Math.round((offset / size) * 100) : 0}%, complete: ${isComplete ? 'yes' : 'no'}`);
    
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
    logger.info(`[TELEGRAM] Existing message ID for upload ${id}: ${existingMessageId ? existingMessageId : 'Not found'}`);
    
    // Send message with upload ID for editing
    const success = await this.sendMessage(message, id);
    logger.info(`[TELEGRAM] Send result for upload ${id}: ${success ? 'Success' : 'Failed'}`);
    
    // If upload is complete, we should clean up the message ID after a delay
    // to ensure proper editing has occurred
    if (isComplete && success) {
      logger.info(`[TELEGRAM] Upload ${id} is complete, scheduling message ID cleanup`);
      console.log(`[TELEGRAM] Upload ${id} is complete, scheduling message ID cleanup`);
      
      // Wait 30 seconds before removing the message ID 
      // to ensure edit operations have completed and any retries have happened
      setTimeout(async () => {
        logger.info(`[TELEGRAM] Executing scheduled cleanup for upload ${id}`);
        console.log(`[TELEGRAM] Executing scheduled cleanup for upload ${id}`);
        await this.deleteMessageId(id);
      }, 30000); // Increased from 10s to 30s for more reliability
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
