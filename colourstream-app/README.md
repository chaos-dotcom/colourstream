# Colourstream Application

A secure streaming platform that combines OvenPlayer for video streaming and MiroTalk for real-time communication.

## Features

- Password-protected streaming rooms
- Admin portal for room management
- Integration with OvenPlayer for video streaming
- Integration with MiroTalk for communication
- Secure authentication system
- Custom room links support

## Setup

1. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

2. Update the environment variables in `.env`:
```
# Change these values for security
SESSION_SECRET=your-secure-session-secret
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-secure-admin-password
ACCESS_PASSWORD=your-secure-access-password
```

3. The application is designed to run in Docker with the provided docker-compose.yml. The following services are included:
- MongoDB for data storage
- Traefik for reverse proxy and SSL
- The main Colourstream application
- MiroTalk for communication
- OvenMediaEngine for streaming

## Deployment

1. Ensure Docker and Docker Compose are installed on your system.

2. Build and start the services:
```bash
docker-compose up -d
```

3. The following endpoints will be available:
- Main application: https://colourstream.johnrogerscolour.co.uk
- Admin portal: https://admin.colourstream.johnrogerscolour.co.uk
- Video streaming: https://video.colourstream.johnrogerscolour.co.uk

## Usage

### Admin Portal

1. Access the admin portal at https://admin.colourstream.johnrogerscolour.co.uk
2. Log in with your admin credentials
3. Create new rooms with optional custom links
4. Manage existing rooms (view, delete)
5. Copy room links to share with users

### User Access

1. Users visit the provided room link
2. Enter the access password when prompted
3. Access the combined OvenPlayer and MiroTalk interface
4. Video stream appears in the top half
5. MiroTalk communication window in the bottom half

## Security

- All traffic is encrypted using SSL
- Admin portal is password protected
- Room access requires a password
- Session management for authenticated users
- Secure password hashing
- HTTP security headers enabled

## Architecture

The application uses:
- Node.js with Express for the backend
- EJS for server-side rendering
- MongoDB for data storage
- Docker for containerization
- Traefik for routing and SSL
- Integration with OvenPlayer and MiroTalk

## Maintenance

### Logs
View container logs:
```bash
docker-compose logs -f colourstream-app
```

### Updates
Update the application:
```bash
docker-compose pull
docker-compose up -d
```

### Backup
Backup MongoDB data:
```bash
docker-compose exec mongodb mongodump --out /dump
docker cp colourstream-mongodb:/dump ./backup
