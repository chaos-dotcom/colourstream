# Build stage
FROM node:20-alpine as build

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

# Install serve for static file serving
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Start static file server
CMD ["serve", "-s", "build", "-l", "3000"]
