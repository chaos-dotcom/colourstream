# Build stage
FROM node:20-alpine as build

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

# Install curl for debugging
RUN apk add --no-cache curl

# Copy package files and install production dependencies
COPY package*.json ./

# Copy Prisma files including migrations
COPY prisma ./prisma/
RUN npm ci --production

# Generate Prisma client in production
RUN npx prisma generate

# Copy built files and Prisma client
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Create data directory and set permissions
RUN mkdir -p /app/data && chown -R node:node /app && chmod -R 777 /app

# Copy entrypoint script and set permissions
COPY --chown=node:node docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Switch to non-root user
USER node

# Expose port
EXPOSE 5001

# Set the entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"] 