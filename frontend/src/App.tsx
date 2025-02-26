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
import govukTheme from './lib/govukTheme';
import GovUkLayout from './components/GovUkLayout';

function App() {
  return (
    <ThemeProvider theme={govukTheme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3}>
        <Router>
          <GovUkLayout serviceName="ColourStream">
            <Routes>
              <Route path="/login" element={<Navigate to="/admin/login" replace />} />
              <Route path="/admin/login" element={<Login />} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/room/:roomId" element={<RoomView isPasswordProtected={true} />} />
              <Route path="/" element={<RoomView />} />
            </Routes>
          </GovUkLayout>
        </Router>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
