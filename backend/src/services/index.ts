import WebSocketService from './websocket';
import OBSService from './obsService';
import http from 'http';
import { telegramService } from './telegramService';

// Create a dummy server for WebSocket service initialization
const dummyServer = http.createServer();
const wsService = new WebSocketService(dummyServer);

// Initialize and export the OBS service instance
export const obsService = new OBSService(wsService);
export { telegramService }; 