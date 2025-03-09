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

// Debug component to verify rendering
const DebugAdminLoginPage = () => {
  console.log('Rendering AdminLoginPage wrapper');
  return <AdminLoginPage />;
};

function App() {
  console.log('App component rendering');
  
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
                <GovUkLayout serviceName="ColourStream">
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
                <GovUkLayout serviceName="ColourStream">
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
                <GovUkLayout serviceName="ColourStream">
                  <ProtectedRoute>
                    <RequirePasskey>
                      <UploadPortal />
                    </RequirePasskey>
                  </ProtectedRoute>
                </GovUkLayout>
              }
            />
            
            {/* OIDC Callback Route - frontend-specific route */}
            <Route path="/auth/callback" element={<OIDCCallback />} />
            
            {/* Routes without GovUkLayout (no footer) */}
            <Route path="/room/:roomId" element={<RoomView isPasswordProtected={true} />} />
            <Route path="/room/:roomId/presenter" element={<PresenterView isPasswordProtected={true} />} />
            <Route path="/" element={<RoomView />} />
          </Routes>
        </Router>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
