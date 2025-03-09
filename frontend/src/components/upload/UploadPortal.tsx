import React from 'react';
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
} from '@mui/material';
import ClientList from './ClientList';
import CreateClientForm from './CreateClientForm';
import ClientDetails from './ClientDetails';
import ProjectDetails from './ProjectDetails';

const UploadPortal: React.FC = () => {
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
                  <CreateClientForm />
                </Box>
                <ClientList />
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
                    <Link component={RouterLink} to="/upload">
                      Clients
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