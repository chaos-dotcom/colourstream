import React, { useState } from 'react';
import { Box } from '@mui/material';
import { OvenMediaEngineApi } from '../../lib/oven-api';
import { VirtualHostList } from './VirtualHostList';
import { SectionHeading } from '../GovUkComponents';

export const OvenMediaConfig: React.FC = () => {
    const [api] = useState(() => new OvenMediaEngineApi());

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ mb: 4 }}>
                <SectionHeading>OvenMediaEngine Configuration</SectionHeading>
                <VirtualHostList api={api} />
            </Box>
        </Box>
    );
}; 