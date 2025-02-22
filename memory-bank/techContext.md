# Tech Context

## Technologies used

1. **Frontend**
   * React 
   * TypeScript
   * OvenPlayer
   * Mirotalk (iframe integration)

2. **Backend**
   * Go
   * SQLite

3. **Infrastructure**
   * Docker
   * Traefik
   * OvenMediaEngine
   * Let's Encrypt

## Development setup

1. **Prerequisites**
   * Docker and Docker Compose
   * Node.js and npm
   * Go development environment
   * Git

2. **Project Structure**
   ```
   colourstream/
   ├── frontend/          # React TypeScript frontend
   ├── backend/           # Go backend API
   ├── ovenmediaengine/  # Streaming server
   ├── mirotalk/         # Video conferencing
   ├── ssl/              # SSL certificates
   └── docker-compose.yml
   ```

3. **Environment Variables**
   * Defined in .env file
   * Contains configuration for:
     - Domain settings
     - API endpoints
     - Database connection
     - Service ports
     - SSL settings

4. **Local Development**
   * Frontend runs on port 3000
   * Mirotalk on port 3001
   * Backend API on port 8080
   * OvenMediaEngine as configured
   * Traefik handles routing

## Technical constraints

1. **Browser Support**
   * Modern browsers with WebRTC support
   * HTML5 video playback capabilities
   * JavaScript enabled

2. **Network Requirements**
   * SSL certificates required
   * WebRTC ports accessible
   * Streaming ports configured

3. **Security Considerations**
   * HTTPS required for WebRTC
   * Admin authentication needed
   * Secure password storage
   * Protected API endpoints

## Dependencies

1. **Frontend Dependencies**
   ```json
   {
     "react": "^18.x",
     "typescript": "^4.x",
     "react-router-dom": "^6.x",
     "@types/react": "^18.x",
     "@types/node": "^16.x"
   }
   ```

2. **Backend Dependencies**
   ```go
   require (
     "github.com/gin-gonic/gin"
     "github.com/mattn/go-sqlite3"
     "github.com/golang-jwt/jwt"
   )
   ```

3. **Infrastructure**
   * Docker Engine 20.x+
   * Docker Compose v2+
   * Traefik v2.x
   * OvenMediaEngine latest
   * Mirotalk latest

4. **Development Tools**
   * VSCode with extensions:
     - Go
     - ESLint
     - Prettier
     - Docker
   * Git
   * Node.js 16+
   * Go 1.16+
