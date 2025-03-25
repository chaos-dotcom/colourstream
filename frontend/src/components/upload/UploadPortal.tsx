import React, { useState } from 'react';
import { Routes, Route, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Breadcrumbs,
  Link,
  Paper,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ClientList from './ClientList';
import ProjectList from './ProjectList';
import CreateClientForm from './CreateClientForm';
import ClientDetails from './ClientDetails';
import ProjectDetails from './ProjectDetails';

// Main container for the upload portal admin interface
const UploadPortal: React.FC = () => {
  const [clientRefreshTrigger, setClientRefreshTrigger] = useState(0);
  const [projectRefreshTrigger, setProjectRefreshTrigger] = useState(0);

  const handleClientCreated = () => {
    // Increment the refresh trigger to cause ClientList to re-fetch data
    setClientRefreshTrigger(prev => prev + 1);
    // Also refresh projects as a new client may impact projects view
    setProjectRefreshTrigger(prev => prev + 1);
  };

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            ColourStream Upload Portal
          </Typography>
          <Button color="inherit" component={RouterLink} to="/upload">
            Clients
          </Button>
          <Button color="inherit" component={RouterLink} to="/upload/projects">
            Projects
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Box mb={4}>
                  <Breadcrumbs>
                    <Typography color="text.primary">Clients</Typography>
                  </Breadcrumbs>
                </Box>
                <Box mb={3}>
                  <CreateClientForm onSuccess={handleClientCreated} />
                </Box>
                <ClientList refreshTrigger={clientRefreshTrigger} />
              </>
            }
          />
          <Route
            path="/projects"
            element={
              <>
                <Box mb={4}>
                  <Breadcrumbs>
                    <Typography color="text.primary">Projects</Typography>
                  </Breadcrumbs>
                </Box>
                <ProjectList refreshTrigger={projectRefreshTrigger} />
              </>
            }
          />
          <Route
            path="/clients/:clientId"
            element={
              <>
                <Box mb={4}>
                  <Breadcrumbs>
                    <Link component={RouterLink} to="/upload">
                      Clients
                    </Link>
                    <Typography color="text.primary">Client Details</Typography>
                  </Breadcrumbs>
                </Box>
                <ClientDetails />
              </>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <>
                <Box mb={4}>
                  <Breadcrumbs>
                    <Link component={RouterLink} to="/upload/projects">
                      Projects
                    </Link>
                    <Typography color="text.primary">Project Details</Typography>
                  </Breadcrumbs>
                </Box>
                <ProjectDetails />
              </>
            }
          />
        </Routes>
      </Container>
    </Box>
  );
};

export default UploadPortal; 