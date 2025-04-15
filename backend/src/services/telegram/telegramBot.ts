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
  private uploadInfoCache: Map<string, any> = new Map<string, any>(); // Cache for upload information

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
   * Get the chat ID for this bot
   */
  getChatId(): string {
    return this.chatId;
  }
  
  /**
   * Get the bot token (masked for security)
   */
  getBotToken(): string {
    return this.botToken;
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
   * Delete a stored message ID when it's no longer needed (from cache and DB)
   * Made public for use after sending termination/completion messages.
   */
  public async cleanupUploadMessage(uploadId: string): Promise<boolean> {
    console.log(`[TELEGRAM-DEBUG] Cleaning up message ID for upload ${uploadId}`);
    try {
      // Remove from the in-memory cache first
      this.messageIdCache.delete(uploadId);
      this.uploadInfoCache.delete(uploadId); // Also clear related upload info cache

      // Check if our model exists yet (after migration) to avoid runtime errors
      // @ts-ignore - We're checking this at runtime
      if (!prisma.telegramMessage) {
        console.log(`[TELEGRAM-DEBUG] TelegramMessage model not yet available in Prisma client, using memory cache only for cleanup`);
        return true;
      }

      // Then remove from the database if the record exists
      // @ts-ignore - We've checked it exists at runtime
      const existing = await prisma.telegramMessage.findUnique({ where: { uploadId } });
      if (existing) {
        // @ts-ignore - We've checked it exists at runtime
        await prisma.telegramMessage.delete({
          where: { uploadId }
        });
        console.log(`[TELEGRAM-DEBUG] Deleted message ID for upload ${uploadId} from database`);
      } else {
        console.log(`[TELEGRAM-DEBUG] No message ID found in database for upload ${uploadId} to delete.`);
      }

      return true;
    } catch (error) {
      // Log error but don't throw, cleanup failure shouldn't break main flow
      console.error(`[TELEGRAM-DEBUG] Error deleting message ID for upload ${uploadId}:`, error);
      logger.error(`[TELEGRAM-DEBUG] Error cleaning up message ID for ${uploadId}: ${error instanceof Error ? error.message : error}`);
      return false; // Indicate cleanup failed
    }
  }

  /**
   * Delete a stored message ID when it's no longer needed (Internal Implementation)
   * Kept private as the public interface is now cleanupUploadMessage
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
          const errorData = editError.response?.data;
          console.log('[TELEGRAM-DEBUG] Edit error response:', errorData || 'No response data');

          // Check if the error is specifically "message is not modified"
          if (errorData?.error_code === 400 && errorData?.description?.includes('message is not modified')) {
            console.log(`[TELEGRAM-DEBUG] Edit failed because message content is identical. Treating as success for upload ${uploadId}.`);
            // Message is already correct, no need to send a new one. Return true.
            return true; 
          } else {
            // For other edit errors, fall back to sending a new message
            console.log(`[TELEGRAM-DEBUG] Falling back to sending a new message for ${uploadId} due to edit error.`);
            response = await axios.post(`${this.baseUrl}/sendMessage`, {
              chat_id: chatId,
              text: message,
              parse_mode: 'HTML',
            });
             
            // Update the message ID for this upload if fallback succeeds
            if (uploadId && response.data.ok && response.data.result && response.data.result.message_id) {
              await this.storeMessageId(uploadId, response.data.result.message_id);
           }
         }
       }
     } // End of the 'if (messageId)' block

     // If no messageId existed OR editing failed and fell through, send a new message
     if (!response) { // Check if 'response' is still undefined (meaning we need to send new)
       console.log(`[TELEGRAM-DEBUG] No existing message found or edit failed for ${uploadId || 'unknown'}, sending new message`);
       response = await axios.post(`${this.baseUrl}/sendMessage`, {
         chat_id: chatId,
         text: message, // Corrected syntax
         parse_mode: 'HTML', // Corrected syntax
       }); // Correctly close the axios data object

       // Store the message ID if this is for a specific upload and the call was successful
       if (uploadId && response.data.ok && response.data.result && response.data.result.message_id) {
         await this.storeMessageId(uploadId, response.data.result.message_id);
       }
     } // This closing brace corresponds to the 'if (!response)' block

     // Ensure response is defined before proceeding (it should be after the above block)
     if (!response) {
        // This should ideally not happen if the logic above is correct, but log an error if it does
        logger.error(`[TELEGRAM-DEBUG] Critical error: Response object is unexpectedly undefined after attempting send/edit for upload ${uploadId || 'unknown'}`);
        return false; // Cannot proceed without a response object
     }

     console.log('[TELEGRAM-DEBUG] Telegram API response:', JSON.stringify(response.data));

     // Store the message ID *again* if it was a *new* message (messageId was null initially)
     // This might be slightly redundant if the store inside the `if (!response)` block worked,
     // but ensures it's stored if the initial edit failed and the fallback send worked.
     if (!messageId && uploadId && response.data.ok && response.data.result && response.data.result.message_id) {
         await this.storeMessageId(uploadId, response.data.result.message_id);
     }

      return response.data.ok;
    } catch (error: any) { // This is the main catch block for sendMessage
      console.error('[TELEGRAM-DEBUG] Failed to send/edit Telegram message:', error.message);
      logger.error('Failed to send/edit Telegram message:', error.message);

      if (error.response) {
        console.error('[TELEGRAM-DEBUG] Error response data:', JSON.stringify(error.response.data));
      }

      // --- Final Fallback Logic ---
      // If the initial send/edit failed, try sending a completely new message as a last resort.
      // This is useful if the original error was related to editing a non-existent message ID.
      if (uploadId) {
        console.log(`[TELEGRAM-DEBUG] Entering final fallback: attempting to send a new message for upload ${uploadId}`);
        try { // Start a new try block specifically for the fallback
          const chatId = !isNaN(Number(this.chatId)) ? Number(this.chatId) : this.chatId;
          const fallbackResponse = await axios.post(`${this.baseUrl}/sendMessage`, { // Use a different variable name
            chat_id: chatId,
            text: message, // Use the original message content
            parse_mode: 'HTML',
          });

          console.log('[TELEGRAM-DEBUG] Fallback sendMessage API response:', JSON.stringify(fallbackResponse.data));

          // Store the new message ID if the fallback was successful
          if (fallbackResponse.data.ok && fallbackResponse.data.result && fallbackResponse.data.result.message_id) {
            await this.storeMessageId(uploadId, fallbackResponse.data.result.message_id);
            return true; // Fallback succeeded
          } else {
             console.error('[TELEGRAM-DEBUG] Fallback message send failed (API returned not ok):', fallbackResponse.data);
             return false; // Fallback failed (API error)
          }
        } catch (fallbackError: any) { // Catch errors specifically from the fallback attempt
          console.error('[TELEGRAM-DEBUG] Fallback message send attempt threw an error:', fallbackError.message);
          if (fallbackError.response) {
            console.error('[TELEGRAM-DEBUG] Fallback error response data:', JSON.stringify(fallbackError.response.data));
          }
          return false; // Fallback failed (exception)
        }
      }
      // --- End Final Fallback Logic ---

      // If no uploadId or fallback failed, return false from the main catch block
      return false;
    } // End of the main catch block
  } // End of sendMessage method


  /**
   * Sends a dedicated termination message for an upload.
   * This method ALWAYS sends a new message and does NOT attempt to edit.
   * It also cleans up any stored message ID for the upload afterwards.
   */
  async sendTerminationMessage(uploadId: string, message: string): Promise<boolean> {
    const chatId = !isNaN(Number(this.chatId)) ? Number(this.chatId) : this.chatId;
    console.log(`[TELEGRAM-DEBUG] Sending dedicated termination message for upload ${uploadId}`);

    try {
      // Always send a new message for termination
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      });

      console.log('[TELEGRAM-DEBUG] Termination message sent via API. Response:', JSON.stringify(response.data));

      if (response.data.ok) {
        logger.info(`Successfully sent termination notification for upload ${uploadId}`);
        // Crucially, clean up any old message ID *after* sending the new one
        await this.cleanupUploadMessage(uploadId);
        return true;
      } else {
        logger.error(`Telegram API failed to send termination message for ${uploadId}: ${response.data.description}`);
        // Attempt cleanup even if sending failed, to prevent future issues
        await this.cleanupUploadMessage(uploadId);
        return false;
      }
    } catch (error: any) {
      console.error(`[TELEGRAM-DEBUG] Failed to send termination message for upload ${uploadId}:`, error.message);
      logger.error(`Failed to send termination message for ${uploadId}:`, error.message);
      if (error.response) {
        console.error('[TELEGRAM-DEBUG] Error response data:', JSON.stringify(error.response.data));
      }
      // Attempt cleanup even if sending failed, to prevent future issues
      await this.cleanupUploadMessage(uploadId);
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
    terminated?: boolean;
  }): Promise<boolean> {
    const { id, size, offset, metadata, isComplete, uploadSpeed, createdAt, terminated } = uploadInfo;

    logger.info(`[sendUploadNotification] Received data for ID ${id}: size=${size}, offset=${offset}, filename=${metadata?.filename}, client=${metadata?.clientName}, project=${metadata?.projectName}, isComplete=${isComplete}, speed=${uploadSpeed}, terminated=${terminated}`);
    
    // Debug log for upload speed
    console.log(`[TELEGRAM-DEBUG] Upload speed for ${id}: ${uploadSpeed} bytes/sec`);
    
    // Calculate speed if not provided but we have enough data
    let effectiveSpeed = uploadSpeed;
    if (!effectiveSpeed && offset > 0 && createdAt) {
      const elapsedSeconds = (Date.now() - createdAt.getTime()) / 1000;
      if (elapsedSeconds > 0) {
        effectiveSpeed = offset / elapsedSeconds;
        console.log(`[TELEGRAM-DEBUG] Calculated speed for ${id}: ${effectiveSpeed} bytes/sec (${offset} bytes in ${elapsedSeconds} seconds)`);
      }
    }
    
    // Force isComplete to true if offset equals size (upload is complete)
    const actuallyComplete = isComplete || (offset === size);
    
    // Handle terminated uploads
    const isTerminated = terminated === true;

    console.log('[TELEGRAM-DEBUG] Creating/Updating upload notification message for upload:', id);

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
    const formatSpeed = (bytesPerSecond: number | undefined): string => {
      // Add extra debug logging
      console.log(`[TELEGRAM-DEBUG] Formatting speed: ${bytesPerSecond} bytes/sec`);
      
      if (bytesPerSecond === undefined) {
        console.log('[TELEGRAM-DEBUG] Speed is undefined');
        return 'N/A';
      }
      
      if (bytesPerSecond <= 0) {
        console.log('[TELEGRAM-DEBUG] Speed is zero or negative');
        return 'N/A';
      }
      
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
    if (isTerminated) {
      message = `<b>❌ Upload Terminated</b>\n`;
    } else if (actuallyComplete) {
      message = `<b>✅ Upload Completed!</b>\n`;
    } else {
      const progressEmoji = getProgressEmoji(progress);
      message = `<b>${progressEmoji} Upload in Progress</b>\n`;
    }
    
    message += `<b>File:</b> ${metadata?.filename || 'Unknown'}\n`;
    message += `<b>Size:</b> ${formatFileSize(size)}\n`;
    
    // Add specific details about progress
    if (isTerminated) {
      message += `<b>Progress:</b> Cancelled at ${progress}% (${formatFileSize(offset)} / ${formatFileSize(size)})\n`;
    } else if (progress < 100) {
      message += `<b>Progress:</b> ${progress}% (${formatFileSize(offset)} / ${formatFileSize(size)})\n`;
    } else {
      message += `<b>Progress:</b> 100% Complete!\n`;
    }

    // Add upload speed if available and not a completed or terminated upload
    // Log whether we're showing speed
    console.log(`[TELEGRAM-DEBUG] Upload speed check: complete=${actuallyComplete}, terminated=${isTerminated}, speed=${uploadSpeed}`);
    
    // Always show speed if it's available, even if it's very small
    if (!actuallyComplete && !isTerminated && (uploadSpeed !== undefined || effectiveSpeed !== undefined)) {
      // Force a minimum display value for very small speeds
      const speedToUse = uploadSpeed !== undefined ? uploadSpeed : effectiveSpeed;
      // Only use Math.max if speedToUse is defined and not zero/negative
      const displaySpeed = speedToUse !== undefined && speedToUse > 0 ? Math.max(speedToUse, 1) : undefined;
      message += `<b>Speed:</b> ${formatSpeed(displaySpeed)}\n`;
    }

    // Add client and project information if available
    if (metadata?.clientName) {
      message += `<b>Client:</b> ${metadata.clientName}\n`;
    }
    
    if (metadata?.projectName) {
      message += `<b>Project:</b> ${metadata.projectName}\n`;
    }
        
    // Add estimated time remaining if not complete and not terminated
    if (!actuallyComplete && !isTerminated && offset > 0 && size > offset) {
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

    // Add completion timestamp and duration if completed or terminated
    if (actuallyComplete || isTerminated) {
      const completedTime = new Date();
      message += `<b>Completed at:</b> ${completedTime.toLocaleString()}\n`;
      if (createdAt) { // Calculate duration if start time is known
         const durationMs = completedTime.getTime() - createdAt.getTime();
         const durationSeconds = Math.round(durationMs / 1000);
         const durationMinutes = Math.floor(durationSeconds / 60);
         const remainingSeconds = durationSeconds % 60;
         message += `<b>Duration:</b> ${durationMinutes}m ${remainingSeconds}s\n`;
         
         // Calculate and show average speed for completed uploads
         if (durationSeconds > 0) {
           const avgSpeedBps = size / durationSeconds;
           message += `<b>Average Speed:</b> ${formatSpeed(avgSpeedBps)}\n`;
         }
      }
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
    
    // If upload is complete/terminated and the notification was sent/edited successfully,
    // schedule cleanup after a delay to ensure the completion message is visible
    if ((actuallyComplete || isTerminated) && success) {
      const delayMinutes = isTerminated ? 2 : 5; // Shorter delay for terminated uploads
      console.log(`[TELEGRAM-DEBUG] Upload ${id} is ${isTerminated ? 'terminated' : 'complete'}, scheduling cleanup in ${delayMinutes} minutes`);
      setTimeout(() => {
        this.cleanupUploadMessage(id).then(cleaned => {
          console.log(`[TELEGRAM-DEBUG] Cleanup for upload ${id} completed: ${cleaned}`);
        });
      }, delayMinutes * 60 * 1000);
    }
    
    return success;
  }

  // Removed unused handleTerminatedUpload method

  /**
   * Format bytes to human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
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
