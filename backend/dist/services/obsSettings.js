"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOBSSettings = exports.getOBSSettings = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const logger_1 = require("../utils/logger");
const getOBSSettings = async () => {
    var _a;
    try {
        const settings = await prisma_1.default.obssettings.findUnique({
            where: { id: 'default' }
        });
        if (!settings)
            return null;
        // Convert null values to undefined and ensure correct types
        return {
            ...settings,
            streamType: 'rtmp_custom',
            password: settings.password || undefined,
            srtUrl: settings.srtUrl || undefined,
            protocol: (settings.protocol || 'rtmp'),
            // Ensure all required properties exist
            useLocalNetwork: (_a = settings.useLocalNetwork) !== null && _a !== void 0 ? _a : true,
            localNetworkMode: (settings.localNetworkMode || 'frontend'),
            localNetworkHost: settings.localNetworkHost || 'localhost',
            localNetworkPort: settings.localNetworkPort || 4455
        };
    }
    catch (error) {
        logger_1.logger.error('Error getting OBS settings:', error);
        throw error;
    }
};
exports.getOBSSettings = getOBSSettings;
const updateOBSSettings = async (settings) => {
    var _a, _b, _c;
    try {
        const updatedSettings = await prisma_1.default.obssettings.upsert({
            where: { id: 'default' },
            update: {
                ...settings,
                streamType: 'rtmp_custom',
                // Make sure to update all fields
                useLocalNetwork: (_a = settings.useLocalNetwork) !== null && _a !== void 0 ? _a : true,
                localNetworkMode: settings.localNetworkMode || 'frontend',
                localNetworkHost: settings.localNetworkHost || settings.host || 'localhost',
                localNetworkPort: settings.localNetworkPort || settings.port || 4455,
                updatedAt: new Date()
            },
            create: {
                id: 'default',
                ...settings,
                streamType: 'rtmp_custom',
                useLocalNetwork: (_b = settings.useLocalNetwork) !== null && _b !== void 0 ? _b : true,
                localNetworkMode: settings.localNetworkMode || 'frontend',
                localNetworkHost: settings.localNetworkHost || settings.host || 'localhost',
                localNetworkPort: settings.localNetworkPort || settings.port || 4455,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        });
        logger_1.logger.info('Updated OBS settings:', updatedSettings);
        return {
            ...updatedSettings,
            streamType: 'rtmp_custom',
            password: updatedSettings.password || undefined,
            srtUrl: updatedSettings.srtUrl || undefined,
            protocol: (updatedSettings.protocol || 'rtmp'),
            useLocalNetwork: (_c = updatedSettings.useLocalNetwork) !== null && _c !== void 0 ? _c : true,
            localNetworkMode: (updatedSettings.localNetworkMode || 'frontend'),
            localNetworkHost: updatedSettings.localNetworkHost || 'localhost',
            localNetworkPort: updatedSettings.localNetworkPort || 4455
        };
    }
    catch (error) {
        logger_1.logger.error('Error updating OBS settings:', error);
        throw error;
    }
};
exports.updateOBSSettings = updateOBSSettings;
