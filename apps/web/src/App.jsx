
import React from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext.jsx';
import { Toaster } from '@/components/ui/sonner';
import ScrollToTop from '@/components/ScrollToTop.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import AppErrorBoundary from '@/components/AppErrorBoundary.jsx';
import LoginPage from '@/pages/LoginPage.jsx';
import SignupPage from '@/pages/SignupPage.jsx';
import DashboardPage from '@/pages/DashboardPage.jsx';
import RawMaterialsPage from '@/pages/RawMaterialsPage.jsx';
import RawMaterialDetailPage from '@/pages/RawMaterialDetailPage.jsx';
import CategoriesPage from '@/pages/CategoriesPage.jsx';
import AccordsPage from '@/pages/AccordsPage.jsx';
import AccordDetailPage from '@/pages/AccordDetailPage.jsx';
import FormulasPage from '@/pages/FormulasPage.jsx';
import FormulaDetailPage from '@/pages/FormulaDetailPage.jsx';
import BatchesPage from '@/pages/BatchesPage.jsx';
import BatchDetailPage from '@/pages/BatchDetailPage.jsx';

const RootRedirect = () => {
  const { isAuthenticated, initialLoading } = useAuth();

  if (initialLoading) {
    return null;
  }

  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
};

function AppRoutes() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        
        <Route path="/raw-materials" element={
          <ProtectedRoute>
            <RawMaterialsPage />
          </ProtectedRoute>
        } />
        
        <Route path="/raw-material/:id" element={
          <ProtectedRoute>
            <RawMaterialDetailPage />
          </ProtectedRoute>
        } />
        
        <Route path="/categories" element={
          <ProtectedRoute>
            <CategoriesPage />
          </ProtectedRoute>
        } />
        
        <Route path="/accords" element={
          <ProtectedRoute>
            <AccordsPage />
          </ProtectedRoute>
        } />
        
        <Route path="/accord/:id" element={
          <ProtectedRoute>
            <AccordDetailPage />
          </ProtectedRoute>
        } />

        <Route path="/accords/:id" element={
          <ProtectedRoute>
            <AccordDetailPage />
          </ProtectedRoute>
        } />
        
        <Route path="/formulas" element={
          <ProtectedRoute>
            <FormulasPage />
          </ProtectedRoute>
        } />
        
        <Route path="/formulas/:id" element={
          <ProtectedRoute>
            <FormulaDetailPage />
          </ProtectedRoute>
        } />
        
        <Route path="/batches" element={
          <ProtectedRoute>
            <BatchesPage />
          </ProtectedRoute>
        } />
        
        <Route path="/batches/:id" element={
          <ProtectedRoute>
            <BatchDetailPage />
          </ProtectedRoute>
        } />
      </Routes>
      <Toaster />
    </Router>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;
