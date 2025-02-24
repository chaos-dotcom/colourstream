"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
// Initialize Prisma Client with the generated types
const prisma = new client_1.PrismaClient();
exports.default = prisma;
