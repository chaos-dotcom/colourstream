import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SnackbarProvider } from 'notistack';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './App.css';
import './govuk.css';
import Login from './pages/Login';
import AdminLoginPage from './components/AdminLoginPage';
import AdminDashboard from './components/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import RequirePasskey from './components/RequirePasskey';
import RoomView from './components/RoomView';
import PresenterView from './components/PresenterView';
import govukTheme from './lib/govukTheme';
import GovUkLayout from './components/GovUkLayout';
import OIDCCallback from './components/OIDCCallback';
import PasskeySetupPage from './components/PasskeySetupPage';
import UploadPortal from './components/upload/UploadPortal';
import ClientUploadPortal from './pages/UploadPortal';
import About from './pages/About';
import License from './pages/License';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';

// Debug component to verify rendering
const DebugAdminLoginPage = () => {
  console.log('Rendering AdminLoginPage wrapper');
  return <AdminLoginPage />;
};

function App() {
  console.log('App component rendering');
  
  // Check if we're on the upload subdomain
  const isUploadSubdomain = window.location.hostname.startsWith('upload.');

  // If we're on the upload subdomain, only show the client upload portal
  if (isUploadSubdomain) {
    return (
      <ThemeProvider theme={govukTheme}>
        <CssBaseline />
        <Router>
          <Routes>
            <Route path="/portal/:token" element={<ClientUploadPortal />} />
            <Route path="/" element={<Navigate to="/portal" replace />} />
            <Route path="/portal" element={<Navigate to="/portal/" replace />} />
            <Route path="*" element={<Navigate to="/portal" replace />} />
          </Routes>
        </Router>
      </ThemeProvider>
    );
  }
  
  // Original app structure for the main domain
  return (
    <ThemeProvider theme={govukTheme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3}>
        <Router>
          <Routes>
            {/* Routes with GovUkLayout */}
            <Route
              path="/login"
              element={
                <GovUkLayout serviceName="ColourStream">
                  <Navigate to="/admin/login" replace />
                </GovUkLayout>
              }
            />
            <Route
              path="/admin/login"
              element={
                <GovUkLayout serviceName="ColourStream">
                  <DebugAdminLoginPage />
                </GovUkLayout>
              }
            />
            <Route
              path="/admin"
              element={
                <GovUkLayout serviceName="ColourStream">
                  <Navigate to="/admin/dashboard" replace />
                </GovUkLayout>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <GovUkLayout serviceName="ColourStream" isAdminPage={true}>
                  <ProtectedRoute>
                    <RequirePasskey>
                      <AdminDashboard />
                    </RequirePasskey>
                  </ProtectedRoute>
                </GovUkLayout>
              }
            />
            <Route
              path="/admin/setup-passkey"
              element={
                <GovUkLayout serviceName="ColourStream" isAdminPage={true}>
                  <ProtectedRoute>
                    <PasskeySetupPage />
                  </ProtectedRoute>
                </GovUkLayout>
              }
            />
            {/* Unprotected Passkey Setup */}
            <Route
              path="/setup-passkey"
              element={
                <GovUkLayout serviceName="ColourStream">
                  <PasskeySetupPage />
                </GovUkLayout>
              }
            />
            
            {/* Upload Portal Routes */}
            <Route
              path="/upload/*"
              element={
                <GovUkLayout serviceName="ColourStream" isAdminPage={true}>
                  <ProtectedRoute>
                    <RequirePasskey>
                      <UploadPortal />
                    </RequirePasskey>
                  </ProtectedRoute>
                </GovUkLayout>
              }
            />
            
            {/* Client Upload Portal Route - Always redirect to upload subdomain */}
            <Route 
              path="/files/:token" 
              element={
                <Navigate 
                  to={`https://upload.colourstream.johnrogerscolour.co.uk/portal/${window.location.pathname.split('/files/')[1]}`} 
                  replace 
                />
              } 
            />
            
            {/* OIDC Callback Route - frontend-specific route */}
            <Route path="/auth/callback" element={<OIDCCallback />} />
            
            {/* License Page */}
            <Route path="/license" element={<License />} />
            
            {/* Privacy Policy Page */}
            <Route path="/privacy" element={<Privacy />} />
            
            {/* Terms of Service Page */}
            <Route path="/terms" element={<Terms />} />
            
            {/* Routes without GovUkLayout (no footer) */}
            <Route path="/room/:roomId" element={<RoomView isPasswordProtected={true} />} />
            <Route path="/room" element={<RoomView />} />
            <Route path="/room/:roomId/presenter" element={<PresenterView isPasswordProtected={true} />} />
            
            {/* About page as the landing page */}
            <Route path="/" element={<About />} />
          </Routes>
        </Router>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
