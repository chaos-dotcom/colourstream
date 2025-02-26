"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.obsService = void 0;
const websocket_1 = __importDefault(require("./websocket"));
const obsService_1 = __importDefault(require("./obsService"));
const http_1 = __importDefault(require("http"));
// Create a dummy server for WebSocket service initialization
const dummyServer = http_1.default.createServer();
const wsService = new websocket_1.default(dummyServer);
// Initialize and export the OBS service instance
exports.obsService = new obsService_1.default(wsService);
