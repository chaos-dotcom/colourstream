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

## Application Data Handling

Applications can be returned in two formats from OvenMediaEngine. The frontend is designed to handle both formats automatically, ensuring consistent display and interaction in the UI.

1. String format (simple name):
```javascript
// OvenMediaEngine Response
{
    "statusCode": 200,
    "message": "OK",
    "response": ["app", "live", "vod"]
}

// Backend Response to Frontend
{
    "status": "success",
    "data": {
        "applications": ["app", "live", "vod"]
    }
}

// Frontend Transformation
// Each string is automatically converted to an object with a default type
[
    { name: "app", type: "default" },
    { name: "live", type: "default" },
    { name: "vod", type: "default" }
]

// UI Display
// app (default)
// live (default)
// vod (default)
```

2. Object format (with type):
```javascript
// OvenMediaEngine Response
{
    "statusCode": 200,
    "message": "OK",
    "response": [
        { "name": "app", "type": "live" },
        { "name": "vod", "type": "playback" }
    ]
}

// Backend Response to Frontend
{
    "status": "success",
    "data": {
        "applications": [
            { "name": "app", "type": "live" },
            { "name": "vod", "type": "playback" }
        ]
    }
}

// UI Display
// app (live)
// vod (playback)
```

### Frontend Handling Details

The frontend handles these formats through several layers:

1. **API Layer** (`oven-api.ts`):
   ```typescript
   // Validates and transforms application data
   async getApplications(vhost: string): Promise<Application[]> {
       const response = await api.get(`/omen/vhosts/${encodedVhost}/apps`);
       const applications = response.data.data.applications;
       return applications.map((app: string | Application) => {
           if (typeof app === 'string') {
               return { name: app, type: 'default' };
           }
           return app;
       });
   }
   ```

2. **Component Layer** (`ApplicationList.tsx`):
   ```typescript
   // Further processes the data for display
   const formattedApps = applications.map(app => ({
       name: typeof app === 'string' ? app : app.name,
       type: typeof app === 'string' ? 'default' : (app.type || 'default'),
       loading: false
   }));
   ```

### Implementation Notes

1. **Type Safety**:
   - The frontend uses TypeScript interfaces to ensure type safety
   - `Application` interface defines the expected structure
   - Runtime checks verify data format

2. **Default Values**:
   - String inputs automatically get `type: "default"`
   - Missing type in object format falls back to `"default"`
   - This ensures consistent UI display

3. **Error Handling**:
   - Invalid formats are caught and logged
   - UI shows appropriate error messages
   - Data validation at multiple levels

4. **Display Consistency**:
   - Applications always show name and type in UI
   - Consistent formatting regardless of input format
   - Loading states and error states handled uniformly

This dual-format support allows flexibility in the API response while maintaining a consistent user experience. 