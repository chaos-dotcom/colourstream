"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
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
dotenv_1.default.config();
const app = (0, express_1.default)();
// Trust proxy (needed for rate limiting behind reverse proxy)
app.set('trust proxy', 1);
// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'https://live.colourstream.johnrogerscolour.co.uk',
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
        app.listen(PORT, () => {
            logger_1.logger.info(`Server is running on port ${PORT}`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
