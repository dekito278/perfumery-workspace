
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
import MobileLoginPage from '@/pages/mobile/MobileLoginPage.jsx';
import MobileDashboardPage from '@/pages/mobile/MobileDashboardPage.jsx';
import MobileBriefsPage from '@/pages/mobile/MobileBriefsPage.jsx';
import MobileBriefEditorPage from '@/pages/mobile/MobileBriefEditorPage.jsx';
import MobileBriefDetailPage from '@/pages/mobile/MobileBriefDetailPage.jsx';
import MobileRawMaterialsPage from '@/pages/mobile/MobileRawMaterialsPage.jsx';
import MobileRawMaterialDetailPage from '@/pages/mobile/MobileRawMaterialDetailPage.jsx';
import MobileRawMaterialAuditPage from '@/pages/mobile/MobileRawMaterialAuditPage.jsx';
import MobileCategoriesPage from '@/pages/mobile/MobileCategoriesPage.jsx';
import MobileFormulasPage from '@/pages/mobile/MobileFormulasPage.jsx';
import MobileCreateFormulaPage from '@/pages/mobile/MobileCreateFormulaPage.jsx';
import MobileEditFormulaPage from '@/pages/mobile/MobileEditFormulaPage.jsx';
import MobileFormulaDetailPage from '@/pages/mobile/MobileFormulaDetailPage.jsx';
import MobileValidationPage from '@/pages/mobile/MobileValidationPage.jsx';

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
        <Route path="/mobile/login" element={<MobileLoginPage />} />

        <Route path="/mobile" element={
          <ProtectedRoute>
            <Navigate to="/mobile/dashboard" replace />
          </ProtectedRoute>
        } />

        <Route path="/mobile/dashboard" element={
          <ProtectedRoute>
            <MobileDashboardPage />
          </ProtectedRoute>
        } />

        <Route path="/mobile/briefs" element={
          <ProtectedRoute>
            <MobileBriefsPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/briefs/new" element={
          <ProtectedRoute>
            <MobileBriefEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/briefs/:id/edit" element={
          <ProtectedRoute>
            <MobileBriefEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/briefs/:id" element={
          <ProtectedRoute>
            <MobileBriefDetailPage />
          </ProtectedRoute>
        } />

        <Route path="/mobile/raw-materials" element={
          <ProtectedRoute>
            <MobileRawMaterialsPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/raw-material-audit" element={
          <ProtectedRoute>
            <MobileRawMaterialAuditPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/raw-material/:id" element={
          <ProtectedRoute>
            <MobileRawMaterialDetailPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/categories" element={
          <ProtectedRoute>
            <MobileCategoriesPage />
          </ProtectedRoute>
        } />

        <Route path="/mobile/formulas" element={
          <ProtectedRoute>
            <MobileFormulasPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/formulas/new" element={
          <ProtectedRoute>
            <MobileCreateFormulaPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/formulas/:id/edit" element={
          <ProtectedRoute>
            <MobileEditFormulaPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/formulas/:id" element={
          <ProtectedRoute>
            <MobileFormulaDetailPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/validation" element={
          <ProtectedRoute>
            <MobileValidationPage />
          </ProtectedRoute>
        } />
        
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
