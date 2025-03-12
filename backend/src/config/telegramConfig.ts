import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const telegramConfig = {
  enabled: process.env.TELEGRAM_ENABLED === 'true',
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  sendStartupMessage: process.env.TELEGRAM_SEND_STARTUP_MESSAGE !== 'false', // Default to true if not specified
};

// Validate configuration if enabled
if (telegramConfig.enabled) {
  if (!telegramConfig.botToken) {
    console.warn('TELEGRAM_BOT_TOKEN is not set. Telegram notifications will not work.');
    telegramConfig.enabled = false;
  }
  
  if (!telegramConfig.chatId) {
    console.warn('TELEGRAM_CHAT_ID is not set. Telegram notifications will not work.');
    telegramConfig.enabled = false;
  }
} 