# GitHub Container Registry

This project uses GitHub Container Registry to publish Docker images. The published images are:

- `ghcr.io/chaos-dotcom/colourstream-frontend:latest`
- `ghcr.io/chaos-dotcom/colourstream-backend:latest`
- `ghcr.io/chaos-dotcom/colourstream-ovenmediaengine:latest`

## Quick Setup

The easiest way to deploy ColourStream is using our setup script:

```bash
curl -s https://raw.githubusercontent.com/chaos-dotcom/colourstream/main/setup-ghcr.sh | bash
```

This script will:
1. Download the necessary configuration files
2. Generate secure random passwords and secrets
3. Configure the application to use the GHCR images
4. Create all required directories and environment files

After running the script, you can simply start the application with:

```bash
docker-compose up -d
```

## Manual Setup

If you prefer to set up manually:

1. Pull the images:
   ```bash
   docker pull ghcr.io/chaos-dotcom/colourstream-frontend:latest
   docker pull ghcr.io/chaos-dotcom/colourstream-backend:latest
   docker pull ghcr.io/chaos-dotcom/colourstream-ovenmediaengine:latest
   ```

2. Download the docker-compose template:
   ```bash
   curl -s https://raw.githubusercontent.com/chaos-dotcom/colourstream/main/docker-compose.template.yml > docker-compose.yml
   ```

3. Configure your environment files and directories
   
4. Start the application:
   ```bash
   docker-compose up -d
   ```

## Publishing New Versions

Images are automatically built and published when:
- Code is pushed to the main branch (tagged as `latest`)
- A version tag is pushed (tagged with the version, e.g., `v1.0.0`)

To create a versioned release:
```bash
git tag v1.0.0
git push origin v1.0.0
``` 