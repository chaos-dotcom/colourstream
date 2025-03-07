# Token Authentication Flow

## Overview

This document describes the token authentication flow between different components of the system: Frontend, Backend, and OvenMediaEngine.

## Flow Diagram

```
+--------+     +-----------+     +---------+     +----------------+
| User   |     | Frontend  |     | Backend |     | OvenMediaEngine|
+--------+     +-----------+     +---------+     +----------------+
    |               |                |                    |
    | Login/Password |                |                    |
    |-------------->|                |                    |
    |               |                |                    |
    |               | POST /auth     |                    |
    |               |--------------->|                    |
    |               |                |                    |
    |               |                |--+ Validate        |
    |               |                |  | Password        |
    |               |                |<-+                 |
    |               |                |                    |
    |               |   JWT Token    |                    |
    |               |<---------------|                    |
    |               |                |                    |
    |               |--+ Store JWT   |                    |
    |               |  | in localStorage                  |
    |               |<-+             |                    |
    |               |                |                    |
    |  User accesses OvenMediaEngine features            |
    |               |                |                    |
    |               | Bearer JWT     |                    |
    |               |--------------->|                    |
    |               |                |                    |
    |               |                |--+ Validate        |
    |               |                |  | JWT Token       |
    |               |                |<-+                 |
    |               |                |                    |
    |               |                | Basic Auth Token   |
    |               |                |------------------->|
    |               |                |                    |
    |               |                |                    |--+ Validate
    |               |                |                    |  | Basic Auth
    |               |                |                    |<-+
    |               |                |                    |
    |               |                |      Response      |
    |               |                |<-------------------|
    |               |                |                    |
    |               |    Response    |                    |
    |               |<---------------|                    |
    |               |                |                    |
    |    Display    |                |                    |
    |<--------------|                |                    |
    |               |                |                    |
+--------+     +-----------+     +---------+     +----------------+
```

## Component Details

### Frontend Authentication
- Uses JWT (JSON Web Token) for authentication
- Token stored in localStorage as 'adminToken'
- Token included in all API requests as Bearer token
- Automatic redirect to login on 401 responses

### Backend Authentication
1. **Frontend to Backend:**
   - Accepts JWT token in Authorization header
   - Format: `Bearer <jwt_token>`
   | JWT contains: `{ userId: 'admin' }`
   | Expiration: 24 hours

2. **Backend to OvenMediaEngine:**
   - Backend passes API requests to OvenMediaEngine with Basic Auth
   - Token from environment variable: `OME_API_ACCESS_TOKEN`
   - Encoded as Base64 in the Authorization header

### OvenMediaEngine Authentication
- Configured to accept Basic Auth with a token
- No sensitive tokens exposed to frontend
- All API calls proxied through backend

## Environment Configuration

```env
# Backend Environment Variables
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
OME_API_URL=http://origin:8081
OME_API_ACCESS_TOKEN=0fc62ea62790ad7c

# Frontend Environment Variables
VITE_API_URL=https://live.colourstream.johnrogerscolour.co.uk/api
```

## Security Notes

1. All frontend-backend communication is over HTTPS
2. JWT tokens expire after 24 hours
3. Backend-OvenMediaEngine communication is internal (docker network)
4. Sensitive tokens stored in environment variables
5. Frontend never directly accesses OvenMediaEngine API

## Error Handling

1. **Invalid JWT Token:**
   - Backend returns 401
   - Frontend redirects to login page
   - Clears stored tokens

2. **Invalid OvenMediaEngine Token:**
   - OvenMediaEngine returns 401
   - Backend forwards error
   - Frontend displays error message

3. **Missing Token:**
   - Both APIs return 401
   - Appropriate error messages shown to user 