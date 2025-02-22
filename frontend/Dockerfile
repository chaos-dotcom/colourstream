FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install
RUN apk add --no-cache curl

# Create a directory for the app source code
RUN mkdir -p /app/src

# Create a volume mount point for node_modules
VOLUME /app/node_modules

EXPOSE 3000

CMD ["npm", "start"]
