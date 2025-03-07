# OvenMediaEngine API Flow

## Network Architecture

```
                                    Port 80/443
                              +------------------+
                              |                  |
                        +---> |     Traefik      | <---+
                        |     | (Reverse Proxy)  |     |
                        |     |                  |     |
                        |     +------------------+     |
                        |             |               |
                        |             |               |
                        |             v               |
                        |     +------------------+    |
                        |     |    SSL/TLS       |    |
                        |     | (Let's Encrypt)  |    |
                        |     +------------------+    |
                        |             |               |
                        |             v               |
+----------------------+    Port 3000    +----------------------+
|                      |                 |                      |
|    React Frontend    | ------------->  |   Express Backend    |
|                      |    /api/omen    |                      |
+----------------------+                 +----------------------+
                                                   |
                                                   |
                                                   |
                                          Port 8081/8082
                                            REST API
                                       +----------------------+
                                       |                      |
                                       | OvenMediaEngine API  |
                                       |                      |
                                       +----------------------+
                                              |
                                              |
                                              v
                                       +----------------------+
                                       |                      |
                                       |  OvenMediaEngine     |
                                       |  Streaming Server    |
                                       |                      |
                                       +----------------------+

```

## API Flow Description

1. **Client to Traefik**
   - Ports: 80 (HTTP, redirected to HTTPS), 443 (HTTPS)
   - SSL/TLS termination via Let's Encrypt
   - Automatic certificate management
   - Route rules based on domain and path

2. **Traefik to Services**
   - Frontend container: Port 3000
   - Backend container: Port 5001
   - Labels for routing configuration
   - Health checks and load balancing

3. **Frontend to Backend**
   - Base URL: `https://live.colourstream.johnrogerscolour.co.uk/api`
   - All OvenMediaEngine requests go through `/api/omen/*` endpoints
   - Authentication: JWT Token
   - Protocol: HTTPS/TLS
   - ⚠️ Frontend never connects directly to OvenMediaEngine API

4. **Backend to OvenMediaEngine**
   - Base URL: `http://origin:8081` (API) and `http://origin:8082` (WebSocket)
   - Authentication: Access Token
   - Protocol: HTTP
   - Internal Network Communication
   - Secured behind internal network

5. **OvenMediaEngine Components**
   - API Server: Handles configuration and statistics (Port 8081)
   - WebSocket Server: Real-time updates (Port 8082)
   - Streaming Server: Manages media streams
   - Internal communication between components

## Security Notes

- Traefik handles SSL/TLS termination with automatic certificate management
- Frontend to Backend communication is secured via HTTPS
- Backend to OvenMediaEngine communication is internal and secured by access token
- All sensitive data (stream keys, passwords) are encrypted in transit
- API endpoints require authentication

## Environment Configuration

```
# Traefik Configuration
TRAEFIK_DOMAIN=live.colourstream.johnrogerscolour.co.uk
TRAEFIK_ACME_EMAIL=your-email@example.com

# Frontend Configuration
VITE_API_URL=https://live.colourstream.johnrogerscolour.co.uk/api

# Backend Configuration
OME_API_URL=http://origin:8081
OME_API_ACCESS_TOKEN=0fc62ea62790ad7c
```

## Data Flow Example

For fetching virtual host statistics:

```
Client
   |
   | HTTPS Request
   v
Traefik
   |
   | Route & SSL Termination
   v
Frontend
   |
   | GET /api/omen/vhosts/:vhost/stats
   v
Backend
   |
   | GET /v1/stats/current/vhosts/:vhost
   v
OvenMediaEngine API
   |
   | Internal Stats Collection
   v
OvenMediaEngine Server
```

## Response Format

All API responses follow this structure:
```typescript
interface ApiResponse<T> {
    statusCode: number;
    message: string;
    response: T;
}
```

Where `T` can be:
- `string[]` for virtual host lists
- `OvenStatistics` for statistics endpoints 