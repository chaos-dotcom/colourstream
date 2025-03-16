"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeTelegramService = void 0;
const telegramConfig_1 = require("../../config/telegramConfig");
const telegramBot_1 = require("./telegramBot");
const logger_1 = require("../../utils/logger");
/**
 * Initialize the Telegram bot if enabled in configuration
 */
const initializeTelegramService = () => {
    if (telegramConfig_1.telegramConfig.enabled) {
        try {
            logger_1.logger.info(`Initializing Telegram bot with token: ${telegramConfig_1.telegramConfig.botToken.substring(0, 10)}... and chat ID: ${telegramConfig_1.telegramConfig.chatId}`);
            const bot = (0, telegramBot_1.initTelegramBot)({
                botToken: telegramConfig_1.telegramConfig.botToken,
                chatId: telegramConfig_1.telegramConfig.chatId
            });
            // Send a startup message if enabled (default is enabled)
            if (telegramConfig_1.telegramConfig.sendStartupMessage) {
                bot.sendMessage('<b>🚀 ColourStream Upload Monitor Started</b>\n\nThe upload monitoring system is now active. You will receive notifications about upload progress and completions.')
                    .then(success => {
                    if (success) {
                        logger_1.logger.info('Telegram bot initialized and startup message sent');
                    }
                    else {
                        logger_1.logger.warn('Telegram bot initialized but failed to send startup message');
                    }
                })
                    .catch(err => {
                    logger_1.logger.error('Failed to send Telegram startup message:', err);
                });
            }
            else {
                logger_1.logger.info('Telegram bot initialized (startup message disabled)');
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Telegram bot:', error);
        }
    }
    else {
        logger_1.logger.info('Telegram notifications are disabled');
    }
};
exports.initializeTelegramService = initializeTelegramService;
