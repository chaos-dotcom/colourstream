# ColourStream Application Template

This template provides a standardized configuration for deploying the ColourStream application. It includes Docker Compose configuration and environment variables templates that can be customized for your specific deployment.

## Template Files

- `docker-compose.template.yml`: Template Docker Compose configuration
- `global.env.template`: Template for global environment variables
- `backend/.env.template`: Template for backend-specific environment variables
- `mirotalk/.env.template`: Template for MiroTalk-specific environment variables
- `setup-template.sh`: Script to help initialize configuration from templates

## Getting Started

### Automatic Setup (Recommended)

Run the setup script to automatically create configuration files with your domain and generate secure passwords:

```bash
./setup-template.sh
```

The script will:
1. Prompt for your domain name and admin email
2. Generate secure random passwords for all services
3. Create configuration files from templates with your settings
4. Display a summary of the configuration for your reference

### Manual Setup

If you prefer to set up manually, copy the template files to create your working configuration:

```bash
cp docker-compose.template.yml docker-compose.yml
cp global.env.template global.env
cp backend/.env.template backend/.env
cp mirotalk/.env.template mirotalk/.env
```

Then modify the configuration files with your specific domain and credentials:

- Replace `example.com` with your actual domain
- Replace placeholder passwords with secure passwords
- Update email addresses and other configuration as needed

## Next Steps

1. Set up SSL certificates for your domains:
   - You'll need certificates for:
     - `live.colourstream.yourdomain.com`
     - `video.colourstream.yourdomain.com`
   - Place certificates in the appropriate directories:
     - `./certs/certs/live.colourstream.yourdomain.com.crt`
     - `./certs/private/live.colourstream.yourdomain.com.key`
     - `./certs/certs/video.colourstream.yourdomain.com.crt`
     - `./certs/private/video.colourstream.yourdomain.com.key`

2. Configure your DNS to point the subdomains to your server:
   - `live.colourstream.yourdomain.com`
   - `video.colourstream.yourdomain.com`

3. Start the application:

```bash
docker-compose up -d
```

## Services

The ColourStream application consists of the following services:

- **Frontend**: React-based web interface
- **Backend**: Node.js API server
- **Postgres**: Database for storing application data
- **Traefik**: Reverse proxy and SSL termination
- **OvenMediaEngine**: Media streaming server (origin and edge)
- **MiroTalk**: WebRTC-based video conferencing
- **Coturn**: TURN server for WebRTC connectivity

## Domain Structure

The application uses two main subdomains:

- `live.colourstream.yourdomain.com`: Main application interface and API
- `video.colourstream.yourdomain.com`: Video conferencing interface

## Configuration Files

### docker-compose.yml

The Docker Compose file defines all services, networks, and volumes required for the application. Key configuration areas include:

- Service definitions and dependencies
- Network configuration
- Volume mappings
- Traefik routing rules
- Environment variables

### global.env

Contains environment variables shared across multiple services, including:

- Database credentials
- Domain configuration
- WebAuthn settings
- JWT configuration

### backend/.env

Contains backend-specific configuration, including:

- API server settings
- OvenMedia API integration
- WebAuthn configuration
- OpenID Connect settings (optional)

### mirotalk/.env

Contains MiroTalk-specific configuration, including:

- STUN/TURN server settings
- Authentication configuration
- Server settings

## Security Considerations

- Replace all placeholder passwords with strong, unique passwords
- Secure your SSL certificates and private keys
- Consider implementing additional security measures based on your deployment environment
- Regularly update all services to their latest versions

## Customization

You can customize the application by modifying the following:

- Environment variables in the various .env files
- Service configurations in `docker-compose.yml`
- Frontend and backend code in their respective directories

## Troubleshooting

If you encounter issues:

1. Check the logs for each service: `docker-compose logs [service-name]`
2. Verify your DNS configuration
3. Ensure SSL certificates are correctly installed
4. Check network connectivity between services 