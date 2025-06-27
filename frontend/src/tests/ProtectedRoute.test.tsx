import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, afterEach } from 'vitest';
import ProtectedRoute from '../components/ProtectedRoute';

// Mock component to render on login page
const LoginPage = () => <div>Login Page</div>;
// Mock component to render on protected page
const ProtectedPage = () => <div>Protected Content</div>;

describe('ProtectedRoute', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('should render children when authenticated', () => {
    localStorage.setItem('isAdminAuthenticated', 'true');

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <ProtectedPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect to login page when not authenticated', () => {
    localStorage.setItem('isAdminAuthenticated', 'false');

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <ProtectedPage />
              </ProtectedRoute>
            }
          />
          <Route path="/admin/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should redirect to login page when authentication status is not set', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <ProtectedPage />
              </ProtectedRoute>
            }
          />
          <Route path="/admin/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
