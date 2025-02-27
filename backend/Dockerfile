# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install curl for debugging and PostgreSQL client for migrations and netcat for wait script
RUN apk add --no-cache curl postgresql-client netcat-openbsd

# Copy package files and install production dependencies
COPY package*.json ./

# Copy Prisma files including migrations
COPY prisma ./prisma/
RUN npm ci --production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create directories with appropriate permissions
RUN mkdir -p /app/data /app/uploads /app/logs \
    && chown -R node:node /app/data /app/uploads /app/logs \
    && chmod 755 /app \
    && chmod 755 /app/prisma \
    && chmod 755 /app/dist \
    && chmod 755 /app/node_modules \
    && chmod 775 /app/data \
    && chmod 775 /app/uploads \
    && chmod 775 /app/logs

# Copy entrypoint script and set permissions
COPY --chown=node:node docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Switch to non-root user
USER node

# Expose port
EXPOSE 5001

# Set the entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"] 