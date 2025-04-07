# Use the official tusd image as the base
FROM tusproject/tusd:latest

# Install jq using apk (Alpine package manager)
# Add ca-certificates for curl HTTPS calls if needed later
RUN apk update && \
    apk add --no-cache jq curl ca-certificates && \
    rm -rf /var/cache/apk/*

# The base image already sets the entrypoint/cmd, so we don't need to redefine it.
# It will use the command specified in docker-compose.
```

**2. Update docker-compose to build tusd:**

```
docker-compose.template.yml
<<<<<<< SEARCH
tusd:
     image: tusproject/tusd:latest
     container_name: colourstream-tusd # Added container name for clarity
     restart: always # Added restart policy
     expose: # Use expose instead of ports if only Traefik needs access
