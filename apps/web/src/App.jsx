
import React, { Suspense, cloneElement, lazy, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Route, Routes, BrowserRouter as Router, Navigate, useLocation, useNavigationType } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext.jsx';
import { Toaster } from '@/components/ui/sonner';
import ScrollToTop from '@/components/ScrollToTop.jsx';
import ScrollRevealEffects from '@/components/ScrollRevealEffects.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import AppErrorBoundary from '@/components/AppErrorBoundary.jsx';
import { isMobileBrowser, toMobilePath } from '@/utils/deviceRouting.js';
import PwaInstallPrompt from '@/components/mobile/PwaInstallPrompt.jsx';
import PwaUpdatePrompt from '@/components/mobile/PwaUpdatePrompt.jsx';
import PwaOfflineBanner from '@/components/mobile/PwaOfflineBanner.jsx';

const HomePage = lazy(() => import('@/pages/HomePage.jsx'));
const CatalogPage = lazy(() => import('@/pages/CatalogPage.jsx'));
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage.jsx'));
const BespokePage = lazy(() => import('@/pages/BespokePage.jsx'));
const CartPage = lazy(() => import('@/pages/CartPage.jsx'));
const PaymentPage = lazy(() => import('@/pages/PaymentPage.jsx'));
const CustomerPortalPage = lazy(() => import('@/pages/CustomerPortalPage.jsx'));
const CustomerInvoicePage = lazy(() => import('@/pages/CustomerInvoicePage.jsx'));
const LoginPage = lazy(() => import('@/pages/LoginPage.jsx'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage.jsx'));
const AuthenticatorSetupPage = lazy(() => import('@/pages/AuthenticatorSetupPage.jsx'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage.jsx'));
const ProductManagementPage = lazy(() => import('@/pages/ProductManagementPage.jsx'));
const ProductCategoriesPage = lazy(() => import('@/pages/ProductCategoriesPage.jsx'));
const OrdersPage = lazy(() => import('@/pages/OrdersPage.jsx'));
const OrderDetailPage = lazy(() => import('@/pages/OrderDetailPage.jsx'));
const CustomersPage = lazy(() => import('@/pages/CustomersPage.jsx'));
const ShipmentsPage = lazy(() => import('@/pages/ShipmentsPage.jsx'));
const BriefsPage = lazy(() => import('@/pages/BriefsPage.jsx'));
const BriefEditorPage = lazy(() => import('@/pages/BriefEditorPage.jsx'));
const BriefDetailPage = lazy(() => import('@/pages/BriefDetailPage.jsx'));
const RawMaterialsPage = lazy(() => import('@/pages/RawMaterialsPage.jsx'));
const RawMaterialAuditPage = lazy(() => import('@/pages/RawMaterialAuditPage.jsx'));
const RawMaterialDetailPage = lazy(() => import('@/pages/RawMaterialDetailPage.jsx'));
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage.jsx'));
const FormulasPage = lazy(() => import('@/pages/FormulasPage.jsx'));
const CreateFormulaPage = lazy(() => import('@/pages/CreateFormulaPage.jsx'));
const EditFormulaPage = lazy(() => import('@/pages/EditFormulaPage.jsx'));
const FormulaDetailPage = lazy(() => import('@/pages/FormulaDetailPage.jsx'));
const BatchProductionPage = lazy(() => import('@/pages/BatchProductionPage.jsx'));
const ProductionCostPage = lazy(() => import('@/pages/ProductionCostPage.jsx'));
const ValidationLogPage = lazy(() => import('@/pages/ValidationLogPage.jsx'));
const MobileLoginPage = lazy(() => import('@/pages/mobile/MobileLoginPage.jsx'));
const MobileCommerceTabsPage = lazy(() => import('@/pages/mobile/MobileCommerceTabsPage.jsx'));
const MobileProductDetailPage = lazy(() => import('@/pages/mobile/MobileProductDetailPage.jsx'));
const MobileBespokePage = lazy(() => import('@/pages/mobile/MobileBespokePage.jsx'));
const MobileCartPage = lazy(() => import('@/pages/mobile/MobileCartPage.jsx'));
const MobileCheckoutPage = lazy(() => import('@/pages/mobile/MobileCheckoutPage.jsx'));
const MobileProductManagementPage = lazy(() => import('@/pages/mobile/MobileProductManagementPage.jsx'));
const MobileBespokeSettingsPage = lazy(() => import('@/pages/mobile/MobileBespokeSettingsPage.jsx'));
const MobileOrdersPage = lazy(() => import('@/pages/mobile/MobileOrdersPage.jsx'));
const MobileOrderDetailPage = lazy(() => import('@/pages/mobile/MobileOrderDetailPage.jsx'));
const MobileFulfillmentPage = lazy(() => import('@/pages/mobile/MobileFulfillmentPage.jsx'));
const MobileCustomersPage = lazy(() => import('@/pages/mobile/MobileCustomersPage.jsx'));
const MobileDashboardPage = lazy(() => import('@/pages/mobile/MobileDashboardPage.jsx'));
const MobileBriefsPage = lazy(() => import('@/pages/mobile/MobileBriefsPage.jsx'));
const MobileBriefEditorPage = lazy(() => import('@/pages/mobile/MobileBriefEditorPage.jsx'));
const MobileBriefDetailPage = lazy(() => import('@/pages/mobile/MobileBriefDetailPage.jsx'));
const MobileRawMaterialsPage = lazy(() => import('@/pages/mobile/MobileRawMaterialsPage.jsx'));
const MobileRawMaterialEditorPage = lazy(() => import('@/pages/mobile/MobileRawMaterialEditorPage.jsx'));
const MobileRawMaterialDetailPage = lazy(() => import('@/pages/mobile/MobileRawMaterialDetailPage.jsx'));
const MobileRawMaterialAuditPage = lazy(() => import('@/pages/mobile/MobileRawMaterialAuditPage.jsx'));
const MobileCategoriesPage = lazy(() => import('@/pages/mobile/MobileCategoriesPage.jsx'));
const MobileFormulasPage = lazy(() => import('@/pages/mobile/MobileFormulasPage.jsx'));
const MobileCreateFormulaPage = lazy(() => import('@/pages/mobile/MobileCreateFormulaPage.jsx'));
const MobileEditFormulaPage = lazy(() => import('@/pages/mobile/MobileEditFormulaPage.jsx'));
const MobileFormulaDetailPage = lazy(() => import('@/pages/mobile/MobileFormulaDetailPage.jsx'));
const MobileBatchesPage = lazy(() => import('@/pages/mobile/MobileBatchesPage.jsx'));
const MobileProductionCostingPage = lazy(() => import('@/pages/mobile/MobileProductionCostingPage.jsx'));
const MobileValidationPage = lazy(() => import('@/pages/mobile/MobileValidationPage.jsx'));
const MobileValidationEditorPage = lazy(() => import('@/pages/mobile/MobileValidationEditorPage.jsx'));

const RouteFallback = () => (
  <div className="grid min-h-screen place-items-center bg-[#f7f8f2] px-4 text-center">
    <div>
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#263d27]/20 border-t-[#263d27]" />
      <p className="mt-4 text-sm font-bold text-[#263d27]">Loading...</p>
    </div>
  </div>
);

const RootRedirect = () => {
  const { initialLoading } = useAuth();

  if (initialLoading) {
    return <RouteFallback />;
  }

  if (isMobileBrowser()) {
    return <Navigate to="/mobile/dashboard" replace />;
  }

  return <Navigate to="/home" replace />;
};

const MobileBrowserRedirect = () => {
  const { pathname, search, hash } = useLocation();
  const [mobileRouteTick, setMobileRouteTick] = useState(0);
  const mobilePath = isMobileBrowser() ? toMobilePath(pathname) : null;

  useEffect(() => {
    const refreshMobileRoute = () => setMobileRouteTick((current) => current + 1);
    const standaloneMediaQuery = window.matchMedia?.('(display-mode: standalone)');
    window.addEventListener('resize', refreshMobileRoute);
    window.addEventListener('orientationchange', refreshMobileRoute);
    if (standaloneMediaQuery?.addEventListener) {
      standaloneMediaQuery.addEventListener('change', refreshMobileRoute);
    } else if (standaloneMediaQuery?.addListener) {
      standaloneMediaQuery.addListener(refreshMobileRoute);
    }

    return () => {
      window.removeEventListener('resize', refreshMobileRoute);
      window.removeEventListener('orientationchange', refreshMobileRoute);
      if (standaloneMediaQuery?.removeEventListener) {
        standaloneMediaQuery.removeEventListener('change', refreshMobileRoute);
      } else if (standaloneMediaQuery?.removeListener) {
        standaloneMediaQuery.removeListener(refreshMobileRoute);
      }
    };
  }, []);

  void mobileRouteTick;

  if (!mobilePath) {
    return null;
  }

  return <Navigate to={`${mobilePath}${search}${hash}`} replace />;
};

const mobileTabOrder = ['/mobile/dashboard', '/mobile/catalog'];
const mobileDetailPatterns = [
  /^\/mobile\/products\/[^/]+$/,
  /^\/mobile\/studio\/orders\/[^/]+$/,
  /^\/mobile\/briefs\/[^/]+$/,
  /^\/mobile\/raw-material\/[^/]+$/,
  /^\/mobile\/formulas\/[^/]+$/,
];

const getMobileRouteMeta = (pathname) => {
  const isMobile = pathname.startsWith('/mobile/');
  const isTab = mobileTabOrder.includes(pathname);
  const isDetail = mobileDetailPatterns.some((pattern) => pattern.test(pathname));

  return {
    isMobile,
    isTab,
    isDetail,
    depth: pathname.split('/').filter(Boolean).length,
    tabIndex: mobileTabOrder.indexOf(pathname),
  };
};

const pageVariants = {
  push: {
    initial: { opacity: 0.96, x: 28 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0.94, x: -18 },
  },
  pop: {
    initial: { opacity: 0.98, x: -18 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0.94, x: 28 },
  },
  tabForward: {
    initial: { opacity: 0.98, x: 14 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0.98, x: -10 },
  },
  tabBackward: {
    initial: { opacity: 0.98, x: -14 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0.98, x: 10 },
  },
  fade: {
    initial: { opacity: 0.98, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0.98, y: -4 },
  },
};

const MobileRouteTransition = ({ children }) => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const shouldReduceMotion = useReducedMotion();
  const previousMetaRef = useRef(getMobileRouteMeta(location.pathname));
  const currentMeta = getMobileRouteMeta(location.pathname);
  const previousMeta = previousMetaRef.current;

  let transitionKind = 'fade';

  if (currentMeta.isMobile && previousMeta.isMobile) {
    if (navigationType === 'POP' && previousMeta.isDetail) {
      transitionKind = 'pop';
    } else if (!previousMeta.isDetail && currentMeta.isDetail) {
      transitionKind = 'push';
    } else if (previousMeta.isDetail && !currentMeta.isDetail) {
      transitionKind = 'pop';
    } else if (previousMeta.isTab && currentMeta.isTab) {
      transitionKind = currentMeta.tabIndex >= previousMeta.tabIndex ? 'tabForward' : 'tabBackward';
    }
  }

  useEffect(() => {
    previousMetaRef.current = currentMeta;
  }, [currentMeta.depth, currentMeta.isDetail, currentMeta.isMobile, currentMeta.isTab, currentMeta.tabIndex]);

  if (!currentMeta.isMobile) {
    return children;
  }

  const variant = pageVariants[transitionKind];

  return (
    <motion.div
      key={location.pathname}
      className="mobile-route-transition"
      initial={shouldReduceMotion ? false : variant.initial}
      animate={shouldReduceMotion ? { opacity: 1, x: 0, y: 0 } : variant.animate}
      transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {cloneElement(children, { location })}
    </motion.div>
  );
};

function AppRoutes() {
  return (
    <Router>
      <ScrollToTop />
      <ScrollRevealEffects />
      <MobileBrowserRedirect />
      <Suspense fallback={<RouteFallback />}>
      <MobileRouteTransition>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/products/:slug" element={<ProductDetailPage />} />
        <Route path="/bespoke" element={<BespokePage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/customer" element={<CustomerPortalPage />} />
        <Route path="/customer/invoice/:orderNumber" element={<CustomerInvoicePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/mobile/login" element={<MobileLoginPage />} />
        <Route path="/mobile/reset-password" element={<ResetPasswordPage mobile />} />

        <Route path="/mobile" element={
          <Navigate to="/mobile/dashboard" replace />
        } />

        <Route path="/mobile/dashboard" element={<MobileCommerceTabsPage />} />

        <Route path="/mobile/catalog" element={<MobileCommerceTabsPage />} />

        <Route path="/mobile/products/:slug" element={<MobileProductDetailPage />} />

        <Route path="/mobile/bespoke" element={<MobileBespokePage />} />

        <Route path="/mobile/cart" element={<MobileCartPage />} />
        <Route path="/mobile/checkout" element={<MobileCheckoutPage />} />

        <Route path="/mobile/payment" element={<PaymentPage />} />

        <Route path="/mobile/customer" element={<CustomerPortalPage />} />

        <Route path="/mobile/customer/invoice/:orderNumber" element={<CustomerInvoicePage />} />

        <Route path="/mobile/studio" element={
          <ProtectedRoute>
            <MobileDashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/authenticator" element={
          <ProtectedRoute>
            <AuthenticatorSetupPage mobile />
          </ProtectedRoute>
        } />
        <Route path="/mobile/studio/dashboard" element={
          <ProtectedRoute>
            <MobileDashboardPage />
          </ProtectedRoute>
        } />

        <Route path="/mobile/studio/products" element={
          <ProtectedRoute>
            <MobileProductManagementPage />
          </ProtectedRoute>
        } />

        <Route path="/mobile/studio/bespoke" element={
          <ProtectedRoute>
            <MobileBespokeSettingsPage />
          </ProtectedRoute>
        } />

        <Route path="/mobile/studio/orders" element={
          <ProtectedRoute>
            <MobileOrdersPage />
          </ProtectedRoute>
        } />

        <Route path="/mobile/studio/orders/:orderId" element={
          <ProtectedRoute>
            <MobileOrderDetailPage />
          </ProtectedRoute>
        } />

        <Route path="/mobile/studio/fulfillment" element={
          <ProtectedRoute>
            <MobileFulfillmentPage />
          </ProtectedRoute>
        } />

        <Route path="/mobile/studio/customers" element={
          <ProtectedRoute>
            <MobileCustomersPage />
          </ProtectedRoute>
        } />

        <Route path="/mobile/briefs" element={
          <ProtectedRoute>
            <MobileBriefsPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/brief" element={
          <ProtectedRoute>
            <Navigate to="/mobile/briefs" replace />
          </ProtectedRoute>
        } />
        <Route path="/mobile/drip" element={
          <ProtectedRoute>
            <Navigate to="/mobile/briefs" replace />
          </ProtectedRoute>
        } />
        <Route path="/mobile/studio/briefs" element={
          <ProtectedRoute>
            <Navigate to="/mobile/briefs" replace />
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

        <Route path="/mobile/raw-materials/new" element={
          <ProtectedRoute>
            <MobileRawMaterialEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/raw-materials" element={
          <ProtectedRoute>
            <MobileRawMaterialsPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/materials" element={
          <ProtectedRoute>
            <Navigate to="/mobile/raw-materials" replace />
          </ProtectedRoute>
        } />
        <Route path="/mobile/studio/materials" element={
          <ProtectedRoute>
            <Navigate to="/mobile/raw-materials" replace />
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
        <Route path="/mobile/studio/formulas" element={
          <ProtectedRoute>
            <Navigate to="/mobile/formulas" replace />
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
        <Route path="/mobile/batches" element={
          <ProtectedRoute>
            <MobileBatchesPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/batches/:id" element={
          <ProtectedRoute>
            <MobileBatchesPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/production-costing" element={
          <ProtectedRoute>
            <MobileProductionCostingPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/validation/new" element={
          <ProtectedRoute>
            <MobileValidationEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/validation/:id/edit" element={
          <ProtectedRoute>
            <MobileValidationEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/validation" element={
          <ProtectedRoute>
            <MobileValidationPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/validate" element={
          <ProtectedRoute>
            <Navigate to="/mobile/validation" replace />
          </ProtectedRoute>
        } />
        <Route path="/mobile/studio/validation" element={
          <ProtectedRoute>
            <Navigate to="/mobile/validation" replace />
          </ProtectedRoute>
        } />
        
        <Route path="/studio" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/authenticator" element={
          <ProtectedRoute>
            <AuthenticatorSetupPage />
          </ProtectedRoute>
        } />

        <Route path="/studio/products" element={
          <ProtectedRoute>
            <ProductManagementPage />
          </ProtectedRoute>
        } />

        <Route path="/studio/product-categories" element={
          <ProtectedRoute>
            <ProductCategoriesPage />
          </ProtectedRoute>
        } />

        <Route path="/studio/orders" element={
          <ProtectedRoute>
            <OrdersPage />
          </ProtectedRoute>
        } />

        <Route path="/studio/orders/:orderId" element={
          <ProtectedRoute>
            <OrderDetailPage />
          </ProtectedRoute>
        } />

        <Route path="/studio/customers" element={
          <ProtectedRoute>
            <CustomersPage />
          </ProtectedRoute>
        } />

        <Route path="/studio/shipments" element={
          <ProtectedRoute>
            <ShipmentsPage />
          </ProtectedRoute>
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Navigate to="/studio" replace />
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
        
        <Route path="/batches" element={
          <ProtectedRoute>
            <BatchProductionPage />
          </ProtectedRoute>
        } />
        <Route path="/batches/:id" element={
          <ProtectedRoute>
            <BatchProductionPage />
          </ProtectedRoute>
        } />

        <Route path="/production-costing" element={
          <ProtectedRoute>
            <ProductionCostPage />
          </ProtectedRoute>
        } />
        <Route path="/validation" element={
          <ProtectedRoute>
            <ValidationLogPage />
          </ProtectedRoute>
        } />
      </Routes>
      </MobileRouteTransition>
      </Suspense>
        <PwaInstallPrompt />
        <PwaUpdatePrompt />
        <PwaOfflineBanner />
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
