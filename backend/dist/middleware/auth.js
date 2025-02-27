"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errorHandler_1 = require("./errorHandler");
const verifyToken = async (token) => {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.ADMIN_AUTH_SECRET);
        return decoded;
    }
    catch (error) {
        throw new errorHandler_1.AppError(401, 'Invalid or expired token');
    }
};
exports.verifyToken = verifyToken;
const authenticateToken = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            throw new errorHandler_1.AppError(401, 'Access token is required');
        }
        const decoded = await (0, exports.verifyToken)(token);
        req.userId = decoded.userId;
        req.type = decoded.type;
        next();
    }
    catch (error) {
        next(new errorHandler_1.AppError(401, 'Invalid or expired token'));
    }
};
exports.authenticateToken = authenticateToken;
