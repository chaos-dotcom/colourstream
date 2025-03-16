"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
exports.telegramConfig = {
    enabled: process.env.TELEGRAM_ENABLED === 'true',
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    sendStartupMessage: process.env.TELEGRAM_SEND_STARTUP_MESSAGE !== 'false', // Default to true if not specified
};
// Validate configuration if enabled
if (exports.telegramConfig.enabled) {
    if (!exports.telegramConfig.botToken) {
        console.warn('TELEGRAM_BOT_TOKEN is not set. Telegram notifications will not work.');
        exports.telegramConfig.enabled = false;
    }
    if (!exports.telegramConfig.chatId) {
        console.warn('TELEGRAM_CHAT_ID is not set. Telegram notifications will not work.');
        exports.telegramConfig.enabled = false;
    }
}
