# Environment Variable Management

This document outlines the approach to managing environment variables in the ColourStream application.

## Structure

The environment variables are organized as follows:

1. **global.env**: Contains shared variables used by multiple services
2. **Service-specific .env files**: Contains variables specific to each service

## Global Environment Variables

The `global.env` file contains variables that are shared across multiple services, such as:

- Domain configurations
- Security keys
- JWT secrets
- WebAuthn configuration
- Node environment settings

## Service-Specific Environment Variables

Each service has its own .env file with variables specific to that service:

- **frontend/.env**: Frontend-specific variables
- **backend/.env**: Backend-specific variables
- **mirotalk/.env**: MiroTalk-specific variables

## Docker Compose Configuration

The `docker-compose.yml` file is configured to load both the global.env file and the service-specific .env file for each service:

```yaml
services:
  service-name:
    # ...
    env_file:
      - global.env
      - service-name/.env
    # ...
```

## Variable Precedence

When the same variable is defined in both the global.env file and a service-specific .env file, the value from the service-specific file takes precedence.

## Maintenance Guidelines

1. **Adding new variables**:
   - If the variable is used by multiple services, add it to `global.env`
   - If the variable is specific to one service, add it to that service's .env file

2. **Modifying existing variables**:
   - Update the variable in the appropriate file based on its scope
   - If a variable needs to be overridden for a specific service, define it in that service's .env file

3. **Removing variables**:
   - Remove unused variables from the appropriate files
   - Ensure that removing a variable doesn't break any service dependencies

## Security Considerations

- Never commit sensitive environment variables to version control
- Use environment-specific .env files for different deployment environments (development, staging, production)
- Consider using a secrets management solution for production deployments 