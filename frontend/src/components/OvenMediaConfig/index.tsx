import React, { useState } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { OvenMediaEngineApi } from '../../lib/oven-api';
import { VirtualHostList } from './VirtualHostList';

export const OvenMediaConfig: React.FC = () => {
    const [api] = useState(() => new OvenMediaEngineApi());

    return (
        <Box sx={{ mt: 3 }}>
            <Paper sx={{ p: 3 }}>
                <Typography variant="h5" gutterBottom>
                    OvenMediaEngine Configuration
                </Typography>
                <VirtualHostList api={api} />
            </Paper>
        </Box>
    );
}; 