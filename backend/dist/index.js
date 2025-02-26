"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.obsService = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const errorHandler_1 = require("./middleware/errorHandler");
const security_1 = require("./middleware/security");
const auth_1 = __importDefault(require("./routes/auth"));
const rooms_1 = __importDefault(require("./routes/rooms"));
const obs_1 = __importDefault(require("./routes/obs"));
const omen_1 = __importDefault(require("./routes/omen"));
const security_2 = __importDefault(require("./routes/security"));
const logger_1 = require("./utils/logger");
const initPassword_1 = require("./utils/initPassword");
const mirotalk_1 = __importDefault(require("./routes/mirotalk"));
const websocket_1 = __importDefault(require("./services/websocket"));
const obsService_1 = __importDefault(require("./services/obsService"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Initialize WebSocket service
const wsService = new websocket_1.default(server);
// Initialize OBS service with WebSocket service
exports.obsService = new obsService_1.default(wsService);
// Trust proxy (needed for rate limiting behind reverse proxy)
app.set('trust proxy', 1);
// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [process.env.FRONTEND_URL || 'https://live.colourstream.johnrogerscolour.co.uk', 'http://localhost:8000'];
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
// Security middleware
app.use(security_1.ipBlocker);
app.use(security_1.generalLimiter);
// Standard middleware
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
// Get base path from environment variable
const basePath = process.env.BASE_PATH || '/api';
// Routes with base path
app.use(`${basePath}/auth`, auth_1.default);
app.use(`${basePath}/rooms`, rooms_1.default);
app.use(`${basePath}/obs`, obs_1.default);
app.use(`${basePath}/omen`, omen_1.default);
app.use(`${basePath}/security`, security_2.default);
app.use('/api/mirotalk', mirotalk_1.default);
// Error handling
app.use(errorHandler_1.errorHandler);
const startServer = async () => {
    try {
        // Initialize the admin password hash
        await (0, initPassword_1.initializePassword)();
        const PORT = process.env.PORT || 5001;
        server.listen(PORT, () => {
            logger_1.logger.info(`Server is running on port ${PORT}`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
// Cleanup on server shutdown
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM received. Cleaning up...');
    wsService.cleanup();
    exports.obsService.cleanup();
    server.close(() => {
        logger_1.logger.info('Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT received. Cleaning up...');
    wsService.cleanup();
    exports.obsService.cleanup();
    server.close(() => {
        logger_1.logger.info('Server closed');
        process.exit(0);
    });
});
exports.default = server;
