
import React from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext.jsx';
import { Toaster } from '@/components/ui/sonner';
import ScrollToTop from '@/components/ScrollToTop.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import AppErrorBoundary from '@/components/AppErrorBoundary.jsx';
import HomePage from '@/pages/HomePage.jsx';
import LoginPage from '@/pages/LoginPage.jsx';
import DashboardPage from '@/pages/DashboardPage.jsx';
import BriefsPage from '@/pages/BriefsPage.jsx';
import BriefEditorPage from '@/pages/BriefEditorPage.jsx';
import BriefDetailPage from '@/pages/BriefDetailPage.jsx';
import RawMaterialsPage from '@/pages/RawMaterialsPage.jsx';
import RawMaterialAuditPage from '@/pages/RawMaterialAuditPage.jsx';
import RawMaterialDetailPage from '@/pages/RawMaterialDetailPage.jsx';
import CategoriesPage from '@/pages/CategoriesPage.jsx';
import FormulasPage from '@/pages/FormulasPage.jsx';
import CreateFormulaPage from '@/pages/CreateFormulaPage.jsx';
import EditFormulaPage from '@/pages/EditFormulaPage.jsx';
import FormulaDetailPage from '@/pages/FormulaDetailPage.jsx';
import ValidationLogPage from '@/pages/ValidationLogPage.jsx';

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
        <Route path="/home" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />

        <Route path="/briefs" element={
          <ProtectedRoute>
            <BriefsPage />
          </ProtectedRoute>
        } />
        <Route path="/briefs/new" element={
          <ProtectedRoute>
            <BriefEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/briefs/:id/edit" element={
          <ProtectedRoute>
            <BriefEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/briefs/:id" element={
          <ProtectedRoute>
            <BriefDetailPage />
          </ProtectedRoute>
        } />
        
        <Route path="/raw-materials" element={
          <ProtectedRoute>
            <RawMaterialsPage />
          </ProtectedRoute>
        } />

        <Route path="/raw-material-audit" element={
          <ProtectedRoute>
            <RawMaterialAuditPage />
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
        
        <Route path="/accords" element={<Navigate to="/formulas" replace />} />
        <Route path="/accords/new" element={<Navigate to="/formulas/new" replace />} />
        <Route path="/accord/:id" element={<Navigate to="/formulas" replace />} />
        <Route path="/accords/:id" element={<Navigate to="/formulas" replace />} />
        
        <Route path="/formulas" element={
          <ProtectedRoute>
            <FormulasPage />
          </ProtectedRoute>
        } />

        <Route path="/formulas/new" element={
          <ProtectedRoute>
            <CreateFormulaPage />
          </ProtectedRoute>
        } />

        <Route path="/formulas/:id/edit" element={
          <ProtectedRoute>
            <EditFormulaPage />
          </ProtectedRoute>
        } />
        
        <Route path="/formulas/:id" element={
          <ProtectedRoute>
            <FormulaDetailPage />
          </ProtectedRoute>
        } />
        
        <Route path="/batches" element={<Navigate to="/formulas" replace />} />
        <Route path="/batches/:id" element={<Navigate to="/formulas" replace />} />

        <Route path="/production-costing" element={<Navigate to="/formulas" replace />} />
        <Route path="/validation" element={
          <ProtectedRoute>
            <ValidationLogPage />
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
