# Build stage
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with clean slate
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Set environment variables for build
ENV NODE_ENV=production
ENV VITE_API_URL=https://live.colourstream.johnrogerscolour.co.uk/api

# Build the app
RUN npm run build

# Serve stage
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
