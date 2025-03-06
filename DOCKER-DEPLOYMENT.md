# Docker Deployment with GitHub Container Registry

This document explains how to deploy the ColourStream application using Docker containers published to GitHub Container Registry (GHCR).

## Overview

The application has been configured to:
1. Build Docker images with runtime configuration capabilities
2. Publish these images to GitHub Container Registry
3. Allow deployment using container images instead of building locally

## Prerequisites

- GitHub account with access to the repository
- Docker and Docker Compose installed on your development and deployment machines
- Access to the GitHub Container Registry for your organization

## Setting Up GitHub Container Registry

1. **Enable GitHub Container Registry for your repository**:
   - Go to your GitHub repository settings
   - Navigate to "Packages" 
   - Ensure GitHub Container Registry is enabled

2. **Configure GitHub Actions permissions**:
   - A GitHub Actions workflow has been created at `.github/workflows/docker-publish.yml`
   - This workflow will automatically build and publish Docker images when:
     - Code is pushed to the main branch
     - A version tag (v*.*.*, e.g., v1.0.0) is pushed

3. **Configure Access to Private Packages** (if your repository is private):
   - Generate a GitHub Personal Access Token (PAT) with `read:packages` scope
   - On your deployment server, log in to GitHub Container Registry:
     ```bash
     echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
     ```

## Deployment

### First-time Deployment

1. **Create your environment file**:
   ```bash
   cp .env.deploy.template .env.deploy
   ```

2. **Edit the environment variables** in `.env.deploy`:
   - Set `ORGANIZATION` to your GitHub organization/username
   - Set `TAG` to the desired version (e.g., `latest` or a specific version like `v1.0.0`)
   - Configure your domain names and database credentials
   - Set secure random strings for JWT and admin secrets

3. **Deploy the application**:
   ```bash
   env $(cat .env.deploy | grep -v "^#") docker-compose -f docker-compose.deploy.yml up -d
   ```

### Updating the Deployment

To update to a new version:

1. **Update the TAG in your .env.deploy file**:
   ```
   TAG=v1.0.1
   ```

2. **Pull the new images and restart the containers**:
   ```bash
   env $(cat .env.deploy | grep -v "^#") docker-compose -f docker-compose.deploy.yml pull
   env $(cat .env.deploy | grep -v "^#") docker-compose -f docker-compose.deploy.yml up -d
   ```

## Runtime Configuration

The application now supports runtime configuration:

### Frontend Configuration

The frontend container reads environment variables at startup and injects them into a runtime configuration file. This means you can change environment variables without rebuilding the container.

Available environment variables:
- `VITE_API_URL`: URL of the backend API
- `VITE_WEBRTC_WS_HOST`: WebRTC WebSocket host
- `VITE_WEBRTC_WS_PORT`: WebRTC WebSocket port
- `VITE_WEBRTC_WS_PROTOCOL`: WebRTC WebSocket protocol (ws/wss)
- `VITE_WEBRTC_APP_PATH`: WebRTC application path
- `VITE_VIDEO_URL`: URL of the video service
- `VITE_OVENPLAYER_SCRIPT_URL`: URL of the OvenPlayer script

### Backend Configuration

The backend container also reads environment variables at runtime. These can be provided directly in the docker-compose file or through environment files.

## Development vs. Production

- **Development**: Use the original docker-compose.yml, which builds the images locally
- **Production**: Use docker-compose.deploy.yml, which pulls pre-built images from GHCR

## Troubleshooting

### Common Issues

1. **Authorization error when pulling images**:
   - Ensure you're logged in to GHCR: `docker login ghcr.io`
   - Check if your PAT has the `read:packages` scope

2. **Environment variables not being applied**:
   - Check that your .env.deploy file is correctly formatted
   - Ensure you're using the env command correctly when running docker-compose

3. **Container isn't using the latest configuration**:
   - Recreate the container: `docker-compose -f docker-compose.deploy.yml up -d --force-recreate frontend`

## Security Considerations

1. **Environment Variables**: 
   - Never commit .env files with real credentials to version control
   - Use secrets management in production environments

2. **GitHub Container Registry**:
   - Use private repositories for sensitive code
   - Regularly rotate GitHub PATs used for authentication

3. **Docker Images**:
   - Regularly update base images to include security patches
   - Consider using vulnerability scanning for container images 