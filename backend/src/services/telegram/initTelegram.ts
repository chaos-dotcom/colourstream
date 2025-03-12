import { telegramConfig } from '../../config/telegramConfig';
import { initTelegramBot } from './telegramBot';
import { logger } from '../../utils/logger';

/**
 * Initialize the Telegram bot if enabled in configuration
 */
export const initializeTelegramService = (): void => {
  if (telegramConfig.enabled) {
    try {
      logger.info(`Initializing Telegram bot with token: ${telegramConfig.botToken.substring(0, 10)}... and chat ID: ${telegramConfig.chatId}`);
      
      const bot = initTelegramBot({
        botToken: telegramConfig.botToken,
        chatId: telegramConfig.chatId
      });
      
      // Send a startup message
      bot.sendMessage('<b>🚀 ColourStream Upload Monitor Started</b>\n\nThe upload monitoring system is now active. You will receive notifications about upload progress and completions.')
        .then(success => {
          if (success) {
            logger.info('Telegram bot initialized and startup message sent');
          } else {
            logger.warn('Telegram bot initialized but failed to send startup message');
          }
        })
        .catch(err => {
          logger.error('Failed to send Telegram startup message:', err);
        });
    } catch (error) {
      logger.error('Failed to initialize Telegram bot:', error);
    }
  } else {
    logger.info('Telegram notifications are disabled');
  }
}; 