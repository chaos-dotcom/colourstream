# GitHub Container Registry

This project uses GitHub Container Registry to publish Docker images. The published images are:

- `ghcr.io/johnr24/colourstream-frontend:latest`
- `ghcr.io/johnr24/colourstream-backend:latest`

## Using the Published Images

To use these images in your own deployment:

1. Pull the images:
   ```bash
   docker pull ghcr.io/johnr24/colourstream-frontend:latest
   docker pull ghcr.io/johnr24/colourstream-backend:latest
   ```

2. Reference them in your docker-compose.yml:
   ```yaml
   services:
     frontend:
       image: ghcr.io/johnr24/colourstream-frontend:latest
       # Your configuration here...
       
     backend:
       image: ghcr.io/johnr24/colourstream-backend:latest
       # Your configuration here...
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