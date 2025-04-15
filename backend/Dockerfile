# Build stage
FROM node:20-alpine as builder

WORKDIR /app

# Create app user first
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy package files and Prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to app user for all operations
USER appuser

# Install dependencies and generate Prisma client
RUN if [ ! -f package-lock.json ]; then \
        echo "No package-lock.json found, creating one..." && \
        npm install; \
    else \
        npm ci; \
    fi && \
    npx prisma generate

# Copy source code (as app user)
COPY --chown=appuser:appgroup . .

# Build TypeScript code
RUN npm run build

# Production stage
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache curl postgresql-client netcat-openbsd

# Create app user (same UID/GID as builder)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy package files and Prisma schema
COPY --chown=appuser:appgroup package*.json ./
COPY --chown=appuser:appgroup prisma ./prisma/

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to app user for all remaining operations
USER appuser

# Install production dependencies and generate Prisma client
RUN if [ ! -f package-lock.json ]; then \
        echo "No package-lock.json found, creating one..." && \
        npm install --production; \
    else \
        npm ci --production; \
    fi && \
    npx prisma generate

# Copy built files from builder (as app user)
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.prisma ./node_modules/.prisma



# Copy and set permissions for startup script
COPY --chown=appuser:appgroup docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Create uploads directory (as app user)
RUN mkdir -p /app/uploads

# Expose port
EXPOSE 5001

# Set the entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"] 