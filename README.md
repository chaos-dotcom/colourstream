# ColourStream Docker Infrastructure

This repository contains a Docker-based infrastructure for running a streaming media platform with video conferencing capabilities. The system uses Traefik as a reverse proxy for SSL/TLS termination and routing for Mirotalk, while OvenMediaEngine handles streaming directly through its ports.

## Authentication

The platform uses a modern, secure authentication system that prioritizes passkey (WebAuthn) authentication:
- Passwordless authentication using device biometrics
- Automatic transition from password to passkey authentication
- Enhanced security with WebAuthn standard

For detailed information about the authentication system, see [Authentication Documentation](docs/authentication.md).

## System Architecture

The infrastructure consists of four main containers:
- Traefik (Reverse Proxy)
- Mirotalk (Video Conferencing)
- OvenMediaEngine Origin (Streaming Source)
- OvenMediaEngine Edge (Streaming Distribution)

Mirotalk is accessible through `video.colourstream.johnrogerscolour.co.uk`, while OvenMediaEngine services are accessed directly through their respective ports.

## Container Details

### Traefik
- **Role**: Reverse proxy and SSL/TLS termination for Mirotalk
- **Features**:
  - Automatic SSL/TLS certificate management via Let's Encrypt
  - HTTP to HTTPS redirection
  - Dynamic configuration for services
- **Ports**:
  - 80 (HTTP, redirects to HTTPS)
  - 443 (HTTPS)

### Mirotalk
- **Role**: Peer-to-peer video conferencing platform
- **Access Point**: `https://video.colourstream.johnrogerscolour.co.uk`
- **Features**:
  - WebRTC-based video conferencing
  - Customizable through volume mounts for configuration and assets
- **Internal Port**: 3000

### OvenMediaEngine Origin
- **Role**: Primary streaming server (ingest point)
- **Access Point**: Direct access via configured ports
- **Features**:
  - RTMP ingest
  - SRT ingest
  - WebRTC signaling
  - LLHLS streaming
- **Key Ports**:
  - 9000/tcp (OVT Origin)
  - 1935/tcp (RTMP Provider)
  - 9999/udp (SRT)
  - 3333/tcp (WebRTC Signaling / LLHLS)
  - 3334/tcp (TLS)
  - 3478/tcp (WebRTC TURN)
  - 10002-10004/udp (WebRTC Candidate)

### OvenMediaEngine Edge
- **Role**: Stream distribution server
- **Access Point**: Direct access via configured ports
- **Features**:
  - WebRTC distribution
  - LLHLS playback
- **Key Ports**:
  - 4333/tcp (WebRTC Signaling / LLHLS)
  - 3479/tcp (WebRTC TURN)
  - 10005-10009/udp (WebRTC Candidate)

## SSL/TLS Certificates

The system uses Let's Encrypt for SSL/TLS certificates with automatic renewal (used by Traefik for Mirotalk):
- Certificate resolver: letsencrypt
- Challenge type: TLS
- Certificate duration: 2160 hours (90 days)
- Email for notifications: admin@johnrogerscolour.co.uk
- Certificate storage: ./letsencrypt/acme.json

## Networking

All containers are connected through the `colourstream_network` Docker network. External access to Mirotalk is managed by Traefik, while OvenMediaEngine containers are accessed directly through their exposed ports.

## Service Dependencies

- Mirotalk depends on Traefik for SSL/TLS termination and routing
- OME Edge depends on OME Origin
- OvenMediaEngine containers operate independently of Traefik

## Volume Mounts

### Traefik
- `/var/run/docker.sock`: Docker socket for container discovery
- `./letsencrypt`: SSL/TLS certificate storage
- `./traefik/dynamic`: Dynamic configuration files

### Mirotalk
- `.env`: Environment configuration
- `app/src/config.js`: Application configuration
- `app/` and `public/`: Application assets and source code

### OvenMediaEngine (Origin & Edge)
- `origin_conf/` or `edge_conf/`: Server configuration
- `letsencrypt/`: SSL/TLS certificates

## Restart Policy

All containers are configured with `restart: unless-stopped` for automatic recovery from failures, except for OME Edge which uses `restart: always`.
