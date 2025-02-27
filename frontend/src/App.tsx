import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SnackbarProvider } from 'notistack';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './App.css';
import './govuk.css';
import Login from './pages/Login';
import AdminDashboard from './components/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import RoomView from './components/RoomView';
import PresenterView from './components/PresenterView';
import govukTheme from './lib/govukTheme';
import GovUkLayout from './components/GovUkLayout';

function App() {
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
                  <Login />
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
                    <AdminDashboard />
                  </ProtectedRoute>
                </GovUkLayout>
              }
            />
            
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
