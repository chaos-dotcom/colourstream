# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Define build args for environment variables
ARG VITE_API_URL
ARG VITE_OIDC_AUTH_ENDPOINT
ARG VITE_WEBRTC_WS_HOST
ARG VITE_WEBRTC_WS_PORT
ARG VITE_WEBRTC_WS_PROTOCOL
ARG VITE_WEBRTC_APP_PATH
ARG VITE_VIDEO_URL
ARG VITE_OVENPLAYER_SCRIPT_URL

# Set environment variables from build args
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_OIDC_AUTH_ENDPOINT=${VITE_OIDC_AUTH_ENDPOINT}
ENV VITE_WEBRTC_WS_HOST=${VITE_WEBRTC_WS_HOST}
ENV VITE_WEBRTC_WS_PORT=${VITE_WEBRTC_WS_PORT}
ENV VITE_WEBRTC_WS_PROTOCOL=${VITE_WEBRTC_WS_PROTOCOL}
ENV VITE_WEBRTC_APP_PATH=${VITE_WEBRTC_APP_PATH}
ENV VITE_VIDEO_URL=${VITE_VIDEO_URL}
ENV VITE_OVENPLAYER_SCRIPT_URL=${VITE_OVENPLAYER_SCRIPT_URL}

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

# Display environment variables for debugging during build
RUN echo "Building with VITE_API_URL=$VITE_API_URL, VITE_WEBRTC_WS_HOST=$VITE_WEBRTC_WS_HOST"

# Build the app - Vite will use the environment variables
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
