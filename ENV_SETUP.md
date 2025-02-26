# Environment Setup for ColourStream

This document explains how to set up the environment variables for the ColourStream application.

## Overview

ColourStream uses multiple environment files to configure its services:

1. `global.env` - Contains shared variables used across multiple services
2. `backend/.env` - Backend-specific configuration
3. `frontend/.env` - Frontend-specific configuration
4. `mirotalk/.env` - MiroTalk-specific configuration
5. `ovenmediaengine/.env` - OvenMediaEngine-specific configuration

## Setup Instructions

1. Copy each example file to create your actual environment files:

```bash
cp global.env.example global.env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp mirotalk/.env.example mirotalk/.env
cp ovenmediaengine/.env.example ovenmediaengine/.env
```

2. Edit each file to set your specific values:

### Global Environment Variables

In `global.env`, set:
- Your domain names
- Security keys and secrets
- WebAuthn configuration
- MiroTalk configuration

### Backend Configuration

In `backend/.env`, set:
- Database connection
- OvenMedia API token
- Admin password
- Other backend-specific settings

### Frontend Configuration

In `frontend/.env`, set:
- API URL (should match your domain)

### MiroTalk Configuration

In `mirotalk/.env`, set:
- Host configuration
- Authentication settings

### OvenMediaEngine Configuration

In `ovenmediaengine/.env`, set:
- Host IP
- Port configurations
- API access token

## Security Considerations

- Never commit your actual `.env` files to version control
- Use strong, unique values for security keys and secrets
- Rotate security keys periodically
- Keep your environment files secure

## Validation

After setting up your environment files, validate your configuration with:

```bash
docker-compose config
```

Then build and start your services:

```bash
docker-compose up -d --build
```

## Troubleshooting

If you encounter issues:
1. Check the logs for each service
2. Verify that all required environment variables are set
3. Ensure that referenced variables (using ${VAR_NAME} syntax) exist in the appropriate files 