# OBS WebSocket Integration

This document outlines the OBS WebSocket integration used in the ColourStream platform. The integration allows for remote control of OBS Studio through both browser-based and server-based connections.

## Overview

The OBS integration supports two primary connection modes:
- **Browser to OBS Connection**: Direct connection from the user's browser to OBS running on their local machine
- **Server to OBS Connection**: Connection from our backend server to OBS running anywhere the server can reach

## Requirements

- OBS Studio 28.0.0 or later
- OBS WebSocket 5.0.0 or later
- obs-websocket-js v5.0.0 or later (we use this library for both frontend and backend connections)

## Connection Modes

### Browser to OBS Connection
- Connects directly from the user's browser to OBS
- OBS must be running on the user's local machine
- Ideal for single-machine setups
- No server intervention needed for OBS control
- Still saves stream settings (RTMP/SRT) on the server

### Server to OBS Connection
- Connects from our backend server to OBS
- OBS can be running anywhere the server can reach
- Ideal for remote OBS instances
- All communication goes through our server
- Full server-side control and monitoring

## Authentication

The integration supports both authenticated and unauthenticated connections:

- **No Authentication**: OBS WebSocket server with authentication disabled
- **Password Authentication**: OBS WebSocket server with a password set
  - Password must be set in both OBS WebSocket settings and our configuration
  - Empty passwords are treated as no authentication

## Configuration

### OBS Studio Setup

1. Open OBS Studio
2. Go to Tools > obs-websocket Settings
3. Configure:
   - Enable WebSocket server: Yes
   - Server Port: 4455 (default)
   - Enable Authentication: Optional
   - Server Password: Set if authentication is enabled

### Integration Settings

The following settings can be configured:

```typescript
interface OBSSettings {
  enabled: boolean;                                  // Enable/disable OBS integration
  streamType: 'rtmp_custom';                        // Always rtmp_custom for OBS
  protocol: 'rtmp' | 'srt';                         // Streaming protocol
  useLocalNetwork: boolean;                         // Always true (legacy setting)
  localNetworkMode: 'frontend' | 'backend';         // Connection mode
  localNetworkHost: string;                         // OBS WebSocket host
  localNetworkPort: number;                         // OBS WebSocket port (default: 4455)
  password?: string;                                // Optional WebSocket password
}
```

## Features

### Connection Management
- Automatic connection status tracking
- Automatic reconnection attempts on disconnection
- Connection health monitoring
- Detailed error reporting

### Streaming Control
- Set streaming destinations (RTMP/SRT)
- Configure stream settings
- Start/stop streaming
- Monitor streaming status

### Error Handling
- Authentication failures
- Connection timeouts
- Network errors
- OBS-specific errors

## API Endpoints

### Get OBS Settings
- **URL**: `/obs/settings`
- **Method**: `GET`
- **Auth Required**: Yes
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "settings": OBSSettings
    }
  }
  ```

### Update OBS Settings
- **URL**: `/obs/settings`
- **Method**: `PUT`
- **Auth Required**: Yes
- **Request Body**: `OBSSettings`
- **Response**: Same as GET

### Set Stream Key
- **URL**: `/obs/set-stream-key`
- **Method**: `POST`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "streamKey": "string",
    "protocol": "rtmp" | "srt"
  }
  ```

## Error Codes

Common OBS WebSocket error codes:
- `4009`: Authentication failed (incorrect password)
- `4008`: Authentication required but no password provided
- Other connection errors will include detailed error messages

## Best Practices

1. **Connection Mode Selection**:
   - Use frontend mode for local OBS instances
   - Use backend mode for remote OBS instances

2. **Authentication**:
   - Always use authentication for remote connections
   - Local connections can skip authentication if in a secure environment

3. **Error Handling**:
   - Implement proper error handling for connection failures
   - Monitor connection status
   - Handle reconnection gracefully

4. **Stream Settings**:
   - Always verify stream settings before starting
   - Monitor stream health
   - Handle protocol-specific requirements (RTMP/SRT)

## Troubleshooting

Common issues and solutions:

1. **Connection Failures**:
   - Verify OBS is running
   - Check WebSocket server is enabled in OBS
   - Verify port is correct and accessible
   - Check password if authentication is enabled

2. **Stream Issues**:
   - Verify correct protocol selection (RTMP/SRT)
   - Check stream key format
   - Verify server URLs
   - Monitor OBS logs for streaming errors

3. **Authentication Issues**:
   - Verify password matches OBS settings
   - Check for special characters in password
   - Ensure password is properly trimmed 