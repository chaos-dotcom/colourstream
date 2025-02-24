import React, { useEffect, useState } from 'react';
import { OvenMediaEngineApi } from '../../lib/oven-api';
import { VirtualHostList } from './VirtualHostList';
import { Box, CircularProgress, Alert, Container, Typography } from '@mui/material';

/**
 * Props for the OvenMediaConfig component
 */
interface OvenMediaConfigProps {
    /** OvenMediaEngine API client instance */
    api: OvenMediaEngineApi;
}

/**
 * Main component for displaying OvenMediaEngine configuration and statistics
 * 
 * This component serves as the container for all OvenMediaEngine configuration views.
 * It manages the list of virtual hosts and handles loading states and errors.
 * 
 * @example
 * ```tsx
 * const api = new OvenMediaEngineApi('http://ome-server:3000', 'access-token');
 * 
 * function App() {
 *   return <OvenMediaConfig api={api} />;
 * }
 * ```
 */
export const OvenMediaConfig: React.FC<OvenMediaConfigProps> = ({ api }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [vhosts, setVhosts] = useState<string[]>([]);

    useEffect(() => {
        const loadVhosts = async () => {
            try {
                setLoading(true);
                const response = await api.getVirtualHosts();
                setVhosts(response.response);
                setError(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load virtual hosts');
            } finally {
                setLoading(false);
            }
        };

        loadVhosts();
    }, [api]);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box m={2}>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    return (
        <Container maxWidth="lg">
            <Box my={4}>
                <Typography variant="h4" component="h1" gutterBottom>
                    OvenMediaEngine Configuration
                </Typography>
                <VirtualHostList api={api} vhosts={vhosts} />
            </Box>
        </Container>
    );
}; 