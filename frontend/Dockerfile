# Build stage
FROM node:20-alpine AS builder

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
ENV VITE_API_URL=https://live.colourstream.johnrogerscolour.co.uk/api

# Build the app
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install serve
RUN npm install -g serve

# Copy only the built files from builder stage
COPY --from=builder /app/build ./build

# Expose port
EXPOSE 3000

# Start static file server with SPA support
CMD ["serve", "-s", "build", "-l", "3000"]
