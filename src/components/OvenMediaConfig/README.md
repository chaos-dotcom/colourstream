# OvenMediaEngine Configuration UI

A React-based UI for viewing and monitoring OvenMediaEngine configuration and statistics. This package provides a complete interface for viewing virtual hosts, applications, output profiles, push targets, and recording configurations.

## Installation

```bash
# Install required dependencies
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material axios
```

## Quick Start

```typescript
import { OvenMediaEngineApi } from './lib/oven-api';
import { OvenMediaConfig } from './components/OvenMediaConfig';

// Initialize the API client
const api = new OvenMediaEngineApi('http://your-ome-server:3000', 'your-access-token');

// Use the component in your app
function App() {
  return (
    <OvenMediaConfig api={api} />
  );
}
```

## Components

### OvenMediaConfig

The main container component that manages the list of virtual hosts.

```typescript
interface OvenMediaConfigProps {
    api: OvenMediaEngineApi;
}

<OvenMediaConfig api={api} />
```

Features:
- Displays a list of all virtual hosts
- Handles loading states and errors
- Provides a clean Material-UI based interface

### VirtualHostList

Displays detailed information about each virtual host.

```typescript
interface VirtualHostListProps {
    api: OvenMediaEngineApi;
    vhosts: string[];
}

<VirtualHostList api={api} vhosts={vhosts} />
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

A TypeScript client for interacting with the OvenMediaEngine REST API.

```typescript
const api = new OvenMediaEngineApi(baseURL, accessToken);
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

#### Configuration Endpoints

```typescript
// Get list of virtual hosts
const vhosts = await api.getVirtualHosts();

// Get virtual host configuration
const vhostConfig = await api.getVirtualHostConfig('default');

// Get output profiles
const profiles = await api.getOutputProfiles('default', 'app');

// Get push targets
const pushTargets = await api.getPushTargets('default', 'app');

// Get recording configurations
const recordingConfigs = await api.getRecordingConfigs('default', 'app');

// Get scheduled channels
const channels = await api.getScheduledChannels('default', 'app');
```

## Data Types

### Statistics

```typescript
interface OvenStatistics {
    connections: {
        file: number;
        hlsv3: number;
        llhls: number;
        ovt: number;
        push: number;
        srt: number;
        thumbnail: number;
        webrtc: number;
    };
    totalConnections: number;
    lastThroughputIn: number;
    lastThroughputOut: number;
    // ... other statistics fields
}
```

### Configuration

```typescript
interface OutputProfile {
    name: string;
    outputStreamName?: string;
    encodes: {
        videos?: Array<{
            codec: string;
            width: number;
            height: number;
            bitrate: number;
            framerate: number;
        }>;
        audios?: Array<{
            codec: string;
            bitrate: number;
            samplerate: number;
            channel: number;
        }>;
    };
}

interface PushTarget {
    id?: string;
    url: string;
    streamKey?: string;
    protocol: 'rtmp' | 'srt';
    streamName?: string;
}

interface RecordingConfig {
    id?: string;
    enabled: boolean;
    filePath: string;
    fileFormat: 'mp4' | 'ts';
    segmentationRule: {
        intervalInSeconds?: number;
        sizeInMb?: number;
    };
}
```

## Error Handling

The API client includes comprehensive error handling:

- Authentication errors (401)
- Resource not found (404)
- Bad requests (400)
- Conflict errors (409)
- Network errors
- Generic API errors

Each component also handles errors gracefully and displays appropriate error messages to the user.

## Styling

The UI is built with Material-UI and is fully responsive. It uses a clean, modern design with:

- Expandable accordions for hierarchical data
- Cards for detailed information
- Chips for status and labels
- Tabs for organizing different types of configuration
- Loading indicators and error messages
- Responsive grid layouts

## Best Practices

1. Initialize the API client once and pass it down to components
2. Handle errors at both the API and component level
3. Use lazy loading to improve performance
4. Implement proper TypeScript types for type safety
5. Follow Material-UI best practices for consistent styling

## Contributing

When contributing to this project:

1. Ensure all components are properly typed
2. Add appropriate error handling
3. Follow the existing code style
4. Add tests for new functionality
5. Update documentation for any changes

## License

MIT License 