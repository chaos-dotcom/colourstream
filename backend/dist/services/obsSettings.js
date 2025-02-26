"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOBSSettings = exports.getOBSSettings = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const logger_1 = require("../utils/logger");
const getOBSSettings = async () => {
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
            localNetworkHost: settings.localNetworkHost || undefined,
            localNetworkPort: settings.localNetworkPort || undefined,
            srtUrl: settings.srtUrl || undefined,
            protocol: (settings.protocol || 'rtmp'),
            localNetworkMode: (settings.localNetworkMode || 'frontend')
        };
    }
    catch (error) {
        logger_1.logger.error('Error getting OBS settings:', error);
        throw error;
    }
};
exports.getOBSSettings = getOBSSettings;
const updateOBSSettings = async (settings) => {
    try {
        const updatedSettings = await prisma_1.default.obssettings.upsert({
            where: { id: 'default' },
            update: {
                ...settings,
                streamType: 'rtmp_custom',
                password: settings.password || null,
                localNetworkHost: settings.localNetworkHost || null,
                localNetworkPort: settings.localNetworkPort || null,
                srtUrl: settings.srtUrl || null
            },
            create: {
                ...settings,
                id: 'default',
                streamType: 'rtmp_custom',
                password: settings.password || null,
                localNetworkHost: settings.localNetworkHost || null,
                localNetworkPort: settings.localNetworkPort || null,
                srtUrl: settings.srtUrl || null
            }
        });
        // Convert null values to undefined in the return value
        return {
            ...updatedSettings,
            streamType: 'rtmp_custom',
            password: updatedSettings.password || undefined,
            localNetworkHost: updatedSettings.localNetworkHost || undefined,
            localNetworkPort: updatedSettings.localNetworkPort || undefined,
            srtUrl: updatedSettings.srtUrl || undefined,
            protocol: (updatedSettings.protocol || 'rtmp'),
            localNetworkMode: (updatedSettings.localNetworkMode || 'frontend')
        };
    }
    catch (error) {
        logger_1.logger.error('Error updating OBS settings:', error);
        throw error;
    }
};
exports.updateOBSSettings = updateOBSSettings;
