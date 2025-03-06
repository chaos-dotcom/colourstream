# 🎨 ColourStream: Professional Livestreaming for Colourists 🎬


## 🚀 Overview

ColourStream is a self-hosted livestreaming review platform designed for colourists by a colourist. Powered by OvenMediaEngine and Mirotalk (AGPL), it provides potential end-to-end latency of less than 5 frames, making it perfect for real-time collaboration and client reviews.

💡 **Built by A Colourist, for colourists** - with features specifically designed for the unique needs of color grading professionals.

## ✨ Key Features

- **⚡️ Ultra-Low Latency**: Experience less than 5 frames of latency for real-time collaboration
- **🔐 Modern Authentication**: Secure passwordless authentication using WebAuthn/passkeys
- **🎭 Multi-Room Support**: Host multiple review sessions simultaneously with separate rooms
- **🔄 OBS Integration**: Stream directly from OBS or other RTMP/SRT sources
- **💬 Built-in Video Conferencing**: Real-time communication via Mirotalk's WebRTC capabilities
- **🛡️ Secure by Design**: End-to-end security for your sensitive content
- **🎛️ Admin Dashboard**: Manage users, rooms, and streaming settings
- **📱 Device Compatibility**: Works across desktop and mobile devices

## 🏗️ System Architecture

The ColourStream platform consists of several integrated components:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Clients   │────▶│   Traefik   │────▶│  Frontend   │
└─────────────┘     │ (SSL/Proxy) │     └─────────────┘
                    └─────────────┘            │
                          │                    ▼
┌─────────────┐          │             ┌─────────────┐
│ OBS/Encoder │────┐     │             │   Backend   │
└─────────────┘    │     │             └─────────────┘
                   ▼     ▼                   │
┌─────────────┐   ┌─────────────┐      ┌─────────────┐
│   Mirotalk  │◀──│ OvenMedia   │      │  PostgreSQL │
│  (WebRTC)   │   │   Engine    │◀─────│  Database   │
└─────────────┘   └─────────────┘      └─────────────┘
```

### 🧩 Components

- **Frontend**: React-based SPA for user interaction and stream viewing
- **Backend**: Node.js API with Prisma ORM for business logic
- **OvenMediaEngine**: Handles video streaming (SRT, RTMP, WebRTC)
- **Mirotalk**: Provides WebRTC-based video conferencing
- **Traefik**: Manages routing, SSL termination, and load balancing
- **PostgreSQL**: Stores user data, room configurations, and system settings

## 🔒 Authentication

ColourStream uses a modern, secure authentication system that prioritizes passkey (WebAuthn) authentication:
- 🔑 Passwordless authentication using device biometrics
- 🔄 Automatic transition from password to passkey authentication
- 🛡️ Enhanced security with WebAuthn standard
- 🎟️ JWT-based authentication for secure service-to-service communication

For detailed information about the authentication system, see [Authentication Documentation](docs/authentication.md).
For information about JWT key naming conventions, see [JWT Keys Documentation](docs/jwt_keys.md).

## 🖥️ Streaming Architecture

### OvenMediaEngine Configuration

ColourStream leverages OvenMediaEngine's powerful streaming capabilities:

#### Origin Server
- Primary streaming ingest point
- Supports RTMP, SRT, and WebRTC inputs
- Handles transcoding and adaptive bitrate streaming
- Distributes to edge servers for scalability

#### Edge Server
- Distributes streams to viewers
- Supports WebRTC and LLHLS playback
- Optimized for low-latency delivery

For OvenMediaEngine API flow information, see [OME API Flow](docs/omen-api-flow.md).

### Video Conferencing

Mirotalk provides real-time video communication:
- WebRTC-based peer-to-peer conferencing
- Integrated with the streaming platform for seamless reviews
- Accessible via `video.colourstream.[domain]`

## 🌐 Networking

All containers communicate through the `colourstream_network` Docker network:
- Traefik handles external access to web applications
- OvenMediaEngine exposes specific ports for streaming protocols
- Internal services communicate securely within the Docker network

## 🔐 Security

### SSL/TLS Certificates

The system uses Traefik's Built in ACME for SSL/TLS certificates with automatic renewal:
- Certificate resolver: letsencrypt
- Challenge type: HTTP
- Certificate storage: ./traefik/acme.json

### Secret Detection

This repository uses [Gitleaks](https://github.com/gitleaks/gitleaks) to detect and prevent hardcoded secrets in the codebase.

For more security information, see [SECURITY.md](SECURITY.md).

## 🚀 Getting Started


Please run the setup-template.sh script 

## 📚 Documentation

- [API Endpoints](docs/api-endpoints.md)
- [Authentication Flow](docs/authentication.md)
- [Token Flow](docs/token-flow.md)
- [OBS Integration](docs/obs-integration.md)
- [WebAuthn Implementation](docs/WEBAUTHN.md)

## 🔧 Advanced Configuration

For advanced configuration options, refer to Docker Compose files and environment templates:
- `docker-compose.yml`: Main service configuration
- `global.env.template`: Global environment variables
- `backend/.env.template`: Backend-specific configuration
- `frontend/.env`: Frontend configuration

## 📜 License

ColourStream is built on AGPL-licensed components including OvenMediaEngine and Mirotalk. Contact the repository maintainer for licensing information.

The UI uses elements of the UK Goverment Design System which is avaible under the MIT license 
https://github.com/alphagov/govuk-design-system
