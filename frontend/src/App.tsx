import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import RoomView from './components/RoomView';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
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
    </Router>
  );
}

export default App;
