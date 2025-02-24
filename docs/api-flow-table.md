# API Request Flow Table

This document shows the flow of API requests from the frontend through our backend to OvenMediaEngine.

## Frontend → Backend → OvenMediaEngine Flow

| Frontend Request (Frontend → Backend) | Backend Request (Backend → OvenMediaEngine) | Description |
|--------------------------------------|-------------------------------------------|-------------|
| `GET /api/omen/vhosts` | `GET http://origin:8081/v1/vhosts` | Get list of virtual hosts |
| `GET /api/omen/vhosts/:vhost/apps` | `GET http://origin:8081/v1/vhosts/:vhost/apps` | Get applications for a virtual host |
| `GET /api/omen/vhosts/:vhost/stats` | `GET http://origin:8081/v1/stats/current/vhosts/:vhost` | Get statistics for a virtual host |
| `GET /api/omen/vhosts/:vhost/apps/:app/stats` | `GET http://origin:8081/v1/stats/current/vhosts/:vhost/apps/:app` | Get statistics for an application |
| `GET /api/omen/vhosts/:vhost/apps/:app/streams/:stream/stats` | `GET http://origin:8081/v1/stats/current/vhosts/:vhost/apps/:app/streams/:stream` | Get statistics for a stream |

## Authentication Flow

| Frontend Request | Backend Authentication | OvenMediaEngine Authentication |
|-----------------|------------------------|-------------------------------|
| Bearer Token:<br>`Authorization: Bearer <jwt_token>` | JWT Validation:<br>Validates token using `JWT_SECRET` | Basic Auth:<br>`Authorization: Basic <base64_token>` |

## Headers and Authentication Details

### Frontend → Backend
```http
GET https://live.colourstream.johnrogerscolour.co.uk/api/omen/vhosts
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
```

### Backend → OvenMediaEngine
```http
GET http://origin:8081/v1/vhosts
Authorization: Basic MGZjNjJlYTYyNzkwYWQ3Yw==
Content-Type: application/json
Accept: application/json
```

## Environment Variables

### Frontend
```env
VITE_API_URL=https://live.colourstream.johnrogerscolour.co.uk/api
```

### Backend
```env
OVENMEDIA_API_URL=http://origin:8081
OVENMEDIA_API_TOKEN=0fc62ea62790ad7c
JWT_SECRET=your-super-secret-jwt-key
```

## Notes

1. Frontend always communicates with the backend over HTTPS
2. Backend communicates with OvenMediaEngine over internal Docker network
3. Frontend JWT token is converted to Basic Auth for OvenMediaEngine requests
4. All requests follow the pattern:
   - Frontend adds JWT token
   - Backend validates JWT token
   - Backend adds Basic Auth for OvenMediaEngine
   - OvenMediaEngine validates Basic Auth

## Error Handling Flow

| HTTP Status | Frontend → Backend | Backend → OvenMediaEngine |
|-------------|-------------------|--------------------------|
| 401 | Invalid/expired JWT token | Invalid Basic Auth token |
| 404 | Resource not found | Virtual host/app/stream not found |
| 500 | Backend service error | OvenMediaEngine API error |

## Response Transformation

The backend transforms OvenMediaEngine responses to match our API format:

```javascript
// OvenMediaEngine Response
{
    "statusCode": 200,
    "message": "OK",
    "response": {...}
}

// Backend Response to Frontend
{
    "status": "success",
    "data": {
        "stats": {...}  // or other data
    }
}
``` 