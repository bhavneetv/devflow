import React, { useState } from 'react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { DeveloperVisualization } from '../components/auth/DeveloperVisualization';
import { useNavigate } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const navigate = useNavigate();

  const handleAuthSuccess = () => {
    navigate('/');
  };

  return (
    <AuthLayout rightVisual={<DeveloperVisualization />}>
        {isRegisterMode ? (
          <RegisterForm
            onSuccess={handleAuthSuccess}
            onNavigateToLogin={() => setIsRegisterMode(false)}
          />
        ) : (
          <LoginForm
            onSuccess={handleAuthSuccess}
            onNavigateToRegister={() => setIsRegisterMode(true)}
          />
        )}
      </AuthLayout>
  );
};
