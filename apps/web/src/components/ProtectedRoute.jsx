
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import StudioLoadingState from '@/components/StudioLoadingState.jsx';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, initialLoading } = useAuth();
  const location = useLocation();

  if (initialLoading) {
    if (!location.pathname.startsWith('/mobile')) {
      return (
        <AuthenticatedLayout>
          <div className="page-container">
            <StudioLoadingState
              eyebrow="Restoring session"
              title="Checking desktop access"
              description="Memulihkan sesi dan menyiapkan workspace tanpa mengosongkan layar."
            />
          </div>
        </AuthenticatedLayout>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const loginPath = location.pathname.startsWith('/mobile') ? '/mobile/login' : '/login';
    return <Navigate to={loginPath} replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;
