import React from 'react';
import { Box } from '@mui/material';
import { SectionHeading } from '../GovUkComponents';

export const GeneralSettings: React.FC = () => {
  return (
    <Box sx={{ 
      border: '1px solid #b1b4b6', 
      mb: 3 
    }}>
      <Box sx={{ 
        p: 2, 
        backgroundColor: '#f3f2f1', 
        borderBottom: '1px solid #b1b4b6' 
      }}>
        <SectionHeading>General Settings</SectionHeading>
      </Box>
      <Box sx={{ p: 3 }}>
        <Box sx={{ color: '#505a5f' }}>
          General settings will be added here.
        </Box>
      </Box>
    </Box>
  );
}; 