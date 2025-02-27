"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePasswordHash = updatePasswordHash;
const promises_1 = __importDefault(require("fs/promises"));
// import path from 'path';
const logger_1 = require("./logger");
async function updatePasswordHash(newPassword) {
    try {
        const envPath = '/app/.env';
        const envContent = await promises_1.default.readFile(envPath, 'utf-8');
        const updatedContent = envContent.replace(/ADMIN_PASSWORD=.*/, `ADMIN_PASSWORD=${newPassword}`);
        await promises_1.default.writeFile(envPath, updatedContent);
        logger_1.logger.info('Successfully updated .env file');
    }
    catch (error) {
        logger_1.logger.error('Failed to update .env file:', error);
        throw error;
    }
}
