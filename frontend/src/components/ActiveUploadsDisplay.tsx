import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import { ActiveUpload } from '../types'; // Import from shared types file

interface ActiveUploadsDisplayProps {
  uploads: ActiveUpload[];
}

// Helper to format bytes
const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Helper to format speed
const formatSpeed = (bytesPerSecond?: number): string => {
    if (bytesPerSecond === undefined || bytesPerSecond === null || bytesPerSecond <= 0) return '-';
    return formatBytes(bytesPerSecond) + '/s';
};

const ActiveUploadsDisplay: React.FC<ActiveUploadsDisplayProps> = ({ uploads }) => {
  if (uploads.length === 0) {
    return <Typography sx={{ mt: 2, fontStyle: 'italic' }}>No active uploads.</Typography>;
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom component="div">
        Active Uploads
      </Typography>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="active uploads table">
          <TableHead>
            <TableRow>
              <TableCell>Filename</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Speed</TableCell>
              <TableCell>Storage</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {uploads.map((upload) => (
              <TableRow key={upload.id}>
                <TableCell component="th" scope="row">
                  <Tooltip title={`ID: ${upload.id}`} placement="top-start">
                     <Typography variant="body2" sx={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                       {upload.fileName}
                     </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>{upload.clientName}</TableCell>
                <TableCell>{upload.projectName}</TableCell>
                <TableCell sx={{ minWidth: 150 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ width: '100%', mr: 1 }}>
                      <LinearProgress variant="determinate" value={upload.percentage} />
                    </Box>
                    <Box sx={{ minWidth: 35 }}>
                      <Typography variant="body2" color="text.secondary">{`${Math.round(
                        upload.percentage,
                      )}%`}</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{formatBytes(upload.size)}</TableCell>
                <TableCell>{formatSpeed(upload.speed)}</TableCell>
                <TableCell>{upload.storage}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ActiveUploadsDisplay;