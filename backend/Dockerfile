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
COPY prisma ./prisma/
RUN npm ci --production

# Copy built files and Prisma schema
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Expose port
EXPOSE 5001

# Start the server
CMD ["npm", "start"] 