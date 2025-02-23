"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePasswordHash = updatePasswordHash;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
async function updatePasswordHash(newHash) {
    try {
        const envPath = path_1.default.join(process.cwd(), '.env');
        const envContent = await promises_1.default.readFile(envPath, 'utf-8');
        const updatedContent = envContent.replace(/ADMIN_PASSWORD_HASH=.*/, `ADMIN_PASSWORD_HASH=${newHash}`);
        await promises_1.default.writeFile(envPath, updatedContent);
    }
    catch (error) {
        console.error('Failed to update .env file:', error);
        throw error;
    }
}
