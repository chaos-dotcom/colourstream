import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Container,
  Alert,
  Toolbar,
  AppBar,
  CircularProgress
} from '@mui/material';
import DropzoneS3Uploader from '../components/upload/DropzoneS3Uploader';
import { getUploadLink } from '../services/uploadService';

const DropzoneTestPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const searchToken = searchParams.get('token');
  const uploadToken = token || searchToken || '';
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadEnabled, setUploadEnabled] = useState(false);
  const [projectInfo, setProjectInfo] = useState<{
    clientName: string;
    projectName: string;
    expiresAt: string;
  } | null>(null);

  useEffect(() => {
    // Validate the upload token and get project information
    const validateToken = async () => {
      if (!uploadToken) {
        setError('Missing upload token');
        setLoading(false);
        return;
      }
      
      try {
        const response = await getUploadLink(uploadToken);
        if (response.status === 'success') {
          // The API returns data in this format directly
          const data = response.data as any;
          
          setProjectInfo({
            clientName: data.clientName,
            projectName: data.projectName,
            expiresAt: data.expiresAt
          });
          
          setUploadEnabled(true);
        } else {
          setError('Invalid upload token');
        }
      } catch (error) {
        console.error('Failed to validate token:', error);
        setError('Failed to validate upload token');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [uploadToken]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid #E0E0E0' }}>
        <Toolbar>
          <Typography variant="h6" color="inherit" noWrap sx={{ flexGrow: 1 }}>
            Alternative File Uploader Test
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="lg" sx={{ py: 6, flexGrow: 1 }}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ 
          fontWeight: 700,
          marginBottom: '30px'
        }}>
          Dropzone S3 Upload Test
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : (
          <>
            {projectInfo && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5">
                  {projectInfo.clientName}: {projectInfo.projectName}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Upload link expires: {new Date(projectInfo.expiresAt).toLocaleString()}
                </Typography>
              </Box>
            )}
            
            {uploadEnabled && (
              <DropzoneS3Uploader 
                token={uploadToken}
                onUploadComplete={(files) => {
                  console.log('All uploads completed!', files);
                }}
              />
            )}
          </>
        )}
      </Container>
      
      <Box component="footer" sx={{ py: 3, px: 2, mt: 'auto', backgroundColor: (theme) => theme.palette.grey[200] }}>
        <Container maxWidth="sm">
          <Typography variant="body2" color="text.secondary" align="center">
            This is an alternative S3 uploader using react-dropzone
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default DropzoneTestPage; 