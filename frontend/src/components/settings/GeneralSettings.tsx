import React from 'react';
import {
  Typography,
  Card,
  CardContent,
} from '@mui/material';

export const GeneralSettings: React.FC = () => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          General Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          General settings will be added here.
        </Typography>
      </CardContent>
    </Card>
  );
}; 