# API Endpoints Documentation

Base URL: `https://live.colourstream.colourbyrogers.co.uk/api`

All endpoints require JWT authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Authentication Endpoints

### Login
- **URL**: `/auth/login`
- **Method**: `POST`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "token": "string"
    }
  }
  ```

### Change Password
- **URL**: `/auth/change-password`
- **Method**: `POST`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "currentPassword": "string",
    "newPassword": "string"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Password changed successfully"
  }
  ```

## Room Management Endpoints

### Get All Rooms
- **URL**: `/rooms`
- **Method**: `GET`
- **Auth Required**: Yes
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "rooms": [
        {
          "id": "string",
          "name": "string",
          "link": "string",
          "expiryDate": "string",
          "mirotalkRoomId": "string",
          "streamKey": "string",
          "displayPassword": "string"
        }
      ]
    }
  }
  ```

### Create Room
- **URL**: `/rooms`
- **Method**: `POST`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "name": "string",
    "expiryDate": "string"
  }
  ```
- **Response**: Same as room object above

### Delete Room
- **URL**: `/rooms/:id`
- **Method**: `DELETE`
- **Auth Required**: Yes
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Room deleted successfully"
  }
  ```

## OvenMediaEngine Endpoints

### Get Virtual Hosts
- **URL**: `/omen/vhosts`
- **Method**: `GET`
- **Auth Required**: Yes
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "vhosts": ["string"]
    }
  }
  ```

### Get Applications for Virtual Host
- **URL**: `/omen/vhosts/:vhost/apps`
- **Method**: `GET`
- **Auth Required**: Yes
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "applications": [
        // Applications can be returned in two formats:
        // 1. As a string (name only):
        "app",
        // 2. As an object with name and type:
        {
          "name": "string",
          "type": "string"
        }
      ]
    }
  }
  ```
- **Notes**:
  - Applications can be returned either as simple strings (representing the app name) or as objects with name and type
  - When returned as a string, the frontend will assign a default type of "default"
  - The application name "app" is the default application configured in OvenMediaEngine for RTMP and SRT streaming
  - Frontend handling:
    ```typescript
    // API layer transforms the data:
    interface Application {
        name: string;
        type: string;
    }
    // String "app" becomes { name: "app", type: "default" }
    // Object remains as-is: { name: "app", type: "live" }
    ```
  - Error handling:
    - Invalid application names return 404
    - Missing or malformed data returns 400
    - Authentication failures return 401
  - Display:
    - Applications are shown in an accordion list
    - Each application shows its name and type
    - Statistics are loaded on demand when expanding an application

### Get Virtual Host Statistics
- **URL**: `/omen/vhosts/:vhost/stats`
- **Method**: `GET`
- **Auth Required**: Yes
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "stats": {
        "connections": {
          "file": 0,
          "hlsv3": 0,
          "llhls": 0,
          "ovt": 0,
          "push": 0,
          "srt": 0,
          "thumbnail": 0,
          "webrtc": 0
        },
        "totalConnections": 0,
        "lastThroughputIn": 0,
        "lastThroughputOut": 0
      }
    }
  }
  ```

### Get Application Statistics
- **URL**: `/omen/vhosts/:vhost/apps/:app/stats`
- **Method**: `GET`
- **Auth Required**: Yes
- **Response**: Same format as virtual host statistics

### Get Stream Statistics
- **URL**: `/omen/vhosts/:vhost/apps/:app/streams/:stream/stats`
- **Method**: `GET`
- **Auth Required**: Yes
- **Response**: Same format as virtual host statistics

## OBS Control Endpoints

### Get OBS Settings
- **URL**: `/obs/settings`
- **Method**: `GET`
- **Auth Required**: Yes
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "settings": {
        "host": "string",
        "port": "number",
        "enabled": "boolean"
      }
    }
  }
  ```

### Update OBS Settings
- **URL**: `/obs/settings`
- **Method**: `PUT`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "host": "string",
    "port": "number",
    "enabled": "boolean"
  }
  ```
- **Response**: Same as GET OBS Settings

## Error Responses

All endpoints may return the following error responses:

### 401 Unauthorized
```json
{
  "status": "error",
  "message": "Invalid or expired token"
}
```

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Validation error"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "Internal server error"
}
```

## Rate Limiting

- Login endpoint is rate limited to 5 requests per minute per IP
- All other endpoints are not rate limited but require valid authentication

## Notes

1. All dates are in ISO 8601 format
2. All IDs are UUIDs
3. Stream keys are automatically generated for new rooms
4. Room links are generated based on the room name
5. The API uses HTTPS only
6. CORS is enabled only for the frontend domain 