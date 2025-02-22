# System Patterns

## System architecture

The system follows a modern microservices architecture:

1. **Frontend (React + TypeScript)**
   - Main viewer interface
   - OvenPlayer integration
   - Mirotalk iframe integration
   - Responsive layout management

2. **Backend (Go)**
   - Room management API
   - Authentication handling
   - Stream key generation
   - Database interactions

3. **Infrastructure**
   - Traefik for routing and SSL
   - Docker for containerization
   - OvenMediaEngine for streaming
   - Mirotalk for video conferencing

## Key technical decisions

* Go + React (with TypeScript) for optimal performance and type safety
* Microservices architecture for maintainability and scalability
* Docker containerization for consistent deployment
* Traefik for automated SSL and routing
* SQLite for simple, file-based data persistence

## Design patterns in use

1. **Frontend Patterns**
   - Component-based architecture (React)
   - Container/Presenter pattern (Smart/Dumb components)
   - Custom hooks for shared logic
   - CSS-in-JS for component styling

2. **Backend Patterns**
   - RESTful API design
   - Middleware pattern for authentication
   - Repository pattern for data access
   - Service layer pattern for business logic

3. **Infrastructure Patterns**
   - Microservices communication
   - Reverse proxy routing
   - SSL termination at edge
   - Container orchestration

## Component relationships

1. **Live Page Components**
   - OvenPlayer (directly included .js)
     - Handles video streaming playback
     - Full width, top half of screen
   - Mirotalk window (iframe)
     - Handles video conferencing
     - Full width, bottom half of screen
     - Zero margin with player

2. **Admin Portal Components**
   - Authentication system
   - Room management interface
     - Creation with custom names
     - Deletion capabilities
     - Random key generation
   - Stream key/room name synchronization

3. **Routing Structure**
   - Root path (/) -> Live page
   - admin.colourstream.johnrogerscolour.co.uk -> Admin portal
   - video.colourstream.johnrogerscolour.co.uk -> Mirotalk service
   - SSL certificates managed by Traefik
