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

# Production stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
