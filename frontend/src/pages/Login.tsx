import React, { useState, useEffect } from 'react';
import { Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PasskeyLogin from '../components/PasskeyLogin';
import FirstTimeSetup from '../components/FirstTimeSetup';
import { checkSetupRequired } from '../utils/api';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user is already authenticated
        const isAuthenticated = localStorage.getItem('isAdminAuthenticated') === 'true';
        if (isAuthenticated) {
          navigate('/admin');
          return;
        }

        // Check if first-time setup is needed
        const response = await checkSetupRequired();
        setSetupRequired(response.data.setupRequired);
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  if (isLoading) {
    return null; // Or show a loading spinner
  }

  return (
    <Container>
      {setupRequired ? <FirstTimeSetup /> : <PasskeyLogin />}
    </Container>
  );
};

export default Login; 