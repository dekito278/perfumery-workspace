
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import StudioLoadingState from '@/components/StudioLoadingState.jsx';
import { useDbAdminStatus } from '@/hooks/useDbAdminStatus.js';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, initialLoading } = useAuth();
  const location = useLocation();
  const dbAdminStatus = useDbAdminStatus(isAuthenticated && isAdmin);

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

  // Logged in but not an admin (e.g. a customer signed in with Google): keep them
  // out of studio and send them to their portal instead.
  if (!isAdmin) {
    const portalPath = location.pathname.startsWith('/mobile') ? '/mobile/customer' : '/customer';
    return <Navigate to={portalPath} replace />;
  }

  // Passed the app gate but not the database one: studio renders, admin data reads back
  // empty and silent. Name it rather than leaving the owner to guess.
  return (
    <>
      {dbAdminStatus === 'missing' ? (
        <div
          role="alert"
          className="fixed inset-x-0 top-0 z-[100] bg-rose-600 px-3 py-2 text-center text-[11px] font-bold leading-snug text-white"
        >
          Akun ini belum terdaftar di storefront_admins, jadi order, customer, dan data
          studio lain akan tampil kosong. Tambahkan user_id akun ini ke tabel itu.
        </div>
      ) : null}
      {children}
    </>
  );
};

export default ProtectedRoute;
