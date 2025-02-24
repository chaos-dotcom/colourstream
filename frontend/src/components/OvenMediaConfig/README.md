# OvenMediaEngine Configuration UI

A React-based UI for viewing and monitoring OvenMediaEngine configuration and statistics. This package provides a complete interface for viewing virtual hosts, applications, output profiles, push targets, and recording configurations.

## Security Note ⚠️

All communication with OvenMediaEngine MUST go through the backend API. Never connect directly to the OvenMediaEngine API ports (8081/8082) from the frontend.

## Installation

```bash
# Install required dependencies
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material axios
```

## Quick Start

```typescript
import { OvenMediaConfig } from './components/OvenMediaConfig';

function App() {
  return (
    <OvenMediaConfig />
  );
}
```

## Components

### OvenMediaConfig

The main container component that manages the list of virtual hosts.

```typescript
<OvenMediaConfig />
```

Features:
- Displays a list of all virtual hosts
- Handles loading states and errors
- Provides a clean Material-UI based interface
- Securely communicates through backend API

### VirtualHostList

Displays detailed information about each virtual host.

```typescript
interface VirtualHostListProps {
    api: OvenMediaEngineApi;
}

<VirtualHostList api={api} />
```

Features:
- Expandable accordion for each virtual host
- Shows host names and TLS configuration
- Displays real-time statistics:
  - Total connections
  - Throughput (in/out)
- Lazy loads data when expanding a virtual host

### ApplicationList

Shows applications within a virtual host with detailed configuration.

```typescript
interface ApplicationListProps {
    api: OvenMediaEngineApi;
    vhost: string;
}

<ApplicationList api={api} vhost="default" />
```

Features:
- Tabbed interface for different aspects of configuration
- Real-time statistics display
- Three main sections:
  1. Output Profiles
  2. Push Targets
  3. Recording Configuration

## API Client

### OvenMediaEngineApi

A TypeScript client for interacting with the OvenMediaEngine API through our secure backend.

```typescript
// The API client is automatically configured to use the correct backend endpoint
const api = new OvenMediaEngineApi();
```

#### Statistics Endpoints

```typescript
// Get virtual host statistics
const vhostStats = await api.getVirtualHostStats('default');

// Get application statistics
const appStats = await api.getApplicationStats('default', 'app');

// Get stream statistics
const streamStats = await api.getStreamStats('default', 'app', 'stream');
```

## Security Best Practices

1. All requests MUST go through the backend API
2. Never expose OvenMediaEngine API ports (8081/8082) to the frontend
3. Use environment variables for API configuration
4. Maintain proper authentication through the backend
5. Keep sensitive information (tokens, keys) in the backend only

## Environment Configuration

```typescript
// Frontend
VITE_API_URL=https://your-domain.com/api  // Points to your backend API

// Backend (internal only)
OVENMEDIA_API_URL=http://origin:8081       // Never expose to frontend
OVENMEDIA_API_TOKEN=your-secret-token      // Never expose to frontend
``` 