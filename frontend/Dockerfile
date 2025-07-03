# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies - handle case where package-lock.json might not exist
RUN if [ ! -f package-lock.json ]; then \
        echo "No package-lock.json found, creating one..." && \
        npm install --package-lock-only && \
        npm install; \
    else \
        npm ci --legacy-peer-deps; \
    fi

# Copy source code
COPY . .

# Set environment variables for build
ENV NODE_ENV=production
ARG REACT_APP_GIT_TAG
ENV REACT_APP_GIT_TAG=$REACT_APP_GIT_TAG

# Build the app with default/placeholder values
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install serve
RUN npm install -g serve

# Copy only the built files from builder stage
COPY --from=builder /app/build ./build

# Create a directory for runtime configuration
RUN mkdir -p /app/config

# Copy the entrypoint script (you'll create this next)
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Use the entrypoint script to start the application
ENTRYPOINT ["/app/docker-entrypoint.sh"]
