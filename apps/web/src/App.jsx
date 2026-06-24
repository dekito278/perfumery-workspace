
import React, { Suspense, cloneElement, lazy, useEffect, useRef, useState } from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate, useLocation, useNavigationType, useParams } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext.jsx';
import { Toaster } from '@/components/ui/sonner';
import ScrollToTop from '@/components/ScrollToTop.jsx';
import ScrollRevealEffects from '@/components/ScrollRevealEffects.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import AppErrorBoundary from '@/components/AppErrorBoundary.jsx';
import StudioLoadingState from '@/components/StudioLoadingState.jsx';
import StorefrontLoadingState from '@/components/storefront/StorefrontLoadingState.jsx';
import StorefrontHeader from '@/components/storefront/StorefrontHeader.jsx';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import HomePage from '@/pages/HomePage.jsx';
import CatalogPage from '@/pages/CatalogPage.jsx';
import PublicProductDetailPage from '@/pages/PublicProductDetailPage.jsx';
import BespokePage from '@/pages/BespokePage.jsx';
import CartPage from '@/pages/CartPage.jsx';
import CheckoutPage from '@/pages/CheckoutPage.jsx';
import PublicTrackingPage from '@/pages/PublicTrackingPage.jsx';
import PublicMaterialsPage from '@/pages/PublicMaterialsPage.jsx';
import PublicJournalPage from '@/pages/PublicJournalPage.jsx';
import NotFoundPage from '@/pages/NotFoundPage.jsx';
import { isMobileBrowser, toMobilePath } from '@/utils/deviceRouting.js';
import PwaInstallPrompt from '@/components/mobile/PwaInstallPrompt.jsx';
import PwaUpdatePrompt from '@/components/mobile/PwaUpdatePrompt.jsx';
import PwaOfflineBanner from '@/components/mobile/PwaOfflineBanner.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';

const LAZY_ROUTE_RECOVERY_KEY = 'solivagant.lazy-route-recovered';
const LAZY_IMPORT_RETRY_DELAY_MS = 350;
const LAZY_IMPORT_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk [\w-]+ failed/i,
  /Unable to preload CSS/i,
];

const isLazyImportError = (error) => {
  const message = String(error?.message || error || '');
  return LAZY_IMPORT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

const recoverLazyRoute = (error) => {
  if (typeof window === 'undefined' || !isLazyImportError(error) || !window.navigator.onLine) {
    return false;
  }

  try {
    if (window.sessionStorage.getItem(LAZY_ROUTE_RECOVERY_KEY) === window.location.href) {
      return false;
    }
    window.sessionStorage.setItem(LAZY_ROUTE_RECOVERY_KEY, window.location.href);
  } catch {
    return false;
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('route-recover', Date.now().toString(36));
  window.location.replace(nextUrl.toString());
  return true;
};

const lazyRoute = (loader) => lazy(async () => {
  try {
    return await loader();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, LAZY_IMPORT_RETRY_DELAY_MS));
    try {
      return await loader();
    } catch (secondError) {
      if (recoverLazyRoute(secondError)) {
        return new Promise(() => {});
      }
      throw secondError;
    }
  }
});

const PaymentPage = lazyRoute(() => import('@/pages/PaymentPage.jsx'));
const CustomerPortalPage = lazyRoute(() => import('@/pages/CustomerPortalPage.jsx'));
const CustomerInvoicePage = lazyRoute(() => import('@/pages/CustomerInvoicePage.jsx'));
const LoginPage = lazyRoute(() => import('@/pages/LoginPage.jsx'));
const ResetPasswordPage = lazyRoute(() => import('@/pages/ResetPasswordPage.jsx'));
const AuthenticatorSetupPage = lazyRoute(() => import('@/pages/AuthenticatorSetupPage.jsx'));
const DashboardPage = lazyRoute(() => import('@/pages/DashboardPage.jsx'));
const ProductManagementPage = lazyRoute(() => import('@/pages/ProductManagementPage.jsx'));
const ProductCategoriesPage = lazyRoute(() => import('@/pages/ProductCategoriesPage.jsx'));
const VoucherManagementPage = lazyRoute(() => import('@/pages/VoucherManagementPage.jsx'));
const ShippingPromotionPage = lazyRoute(() => import('@/pages/ShippingPromotionPage.jsx'));
const OrdersPage = lazyRoute(() => import('@/pages/OrdersPage.jsx'));
const OrderDetailPage = lazyRoute(() => import('@/pages/OrderDetailPage.jsx'));
const CustomersPage = lazyRoute(() => import('@/pages/CustomersPage.jsx'));
const ShipmentsPage = lazyRoute(() => import('@/pages/ShipmentsPage.jsx'));

const JournalPage = lazyRoute(() => import('@/pages/JournalPage.jsx'));
const JournalEditorPage = lazyRoute(() => import('@/pages/JournalEditorPage.jsx'));
const JournalDetailPage = lazyRoute(() => import('@/pages/JournalDetailPage.jsx'));
const PublicJournalArticlePage = lazyRoute(() => import('@/pages/PublicJournalArticlePage.jsx'));

const RawMaterialsPage = lazyRoute(() => import('@/pages/RawMaterialsPage.jsx'));
const RawMaterialAuditPage = lazyRoute(() => import('@/pages/RawMaterialAuditPage.jsx'));
const RawMaterialDetailPage = lazyRoute(() => import('@/pages/RawMaterialDetailPage.jsx'));
const CategoriesPage = lazyRoute(() => import('@/pages/CategoriesPage.jsx'));
const FormulasPage = lazyRoute(() => import('@/pages/FormulasPage.jsx'));
const CreateFormulaPage = lazyRoute(() => import('@/pages/CreateFormulaPage.jsx'));
const EditFormulaPage = lazyRoute(() => import('@/pages/EditFormulaPage.jsx'));
const FormulaDetailPage = lazyRoute(() => import('@/pages/FormulaDetailPage.jsx'));
const BatchProductionPage = lazyRoute(() => import('@/pages/BatchProductionPage.jsx'));
const ProductionCostPage = lazyRoute(() => import('@/pages/ProductionCostPage.jsx'));
const ValidationLogPage = lazyRoute(() => import('@/pages/ValidationLogPage.jsx'));
const SiteImageManagerPage = lazyRoute(() => import('@/pages/SiteImageManagerPage.jsx'));
const MobileLoginPage = lazyRoute(() => import('@/pages/mobile/MobileLoginPage.jsx'));
const MobileCommerceTabsPage = lazyRoute(() => import('@/pages/mobile/MobileCommerceTabsPage.jsx'));
const MobileProductDetailPage = lazyRoute(() => import('@/pages/mobile/MobileProductDetailPage.jsx'));
const MobileBespokePage = lazyRoute(() => import('@/pages/mobile/MobileBespokePage.jsx'));
const MobileCartPage = lazyRoute(() => import('@/pages/mobile/MobileCartPage.jsx'));
const MobileCheckoutPage = lazyRoute(() => import('@/pages/mobile/MobileCheckoutPage.jsx'));
const MobileProductManagementPage = lazyRoute(() => import('@/pages/mobile/MobileProductManagementPage.jsx'));
const MobileBespokeSettingsPage = lazyRoute(() => import('@/pages/mobile/MobileBespokeSettingsPage.jsx'));
const MobileVoucherManagementPage = lazyRoute(() => import('@/pages/mobile/MobileVoucherManagementPage.jsx'));
const MobileShippingPromotionPage = lazyRoute(() => import('@/pages/mobile/MobileShippingPromotionPage.jsx'));
const MobileOrdersPage = lazyRoute(() => import('@/pages/mobile/MobileOrdersPage.jsx'));
const MobileOrderDetailPage = lazyRoute(() => import('@/pages/mobile/MobileOrderDetailPage.jsx'));
const MobileFulfillmentPage = lazyRoute(() => import('@/pages/mobile/MobileFulfillmentPage.jsx'));
const MobileCustomersPage = lazyRoute(() => import('@/pages/mobile/MobileCustomersPage.jsx'));
const MobileDashboardPage = lazyRoute(() => import('@/pages/mobile/MobileDashboardPage.jsx'));

const MobileJournalPage = lazyRoute(() => import('@/pages/mobile/MobileJournalPage.jsx'));
const MobileJournalEditorPage = lazyRoute(() => import('@/pages/mobile/MobileJournalEditorPage.jsx'));
const MobileJournalDetailPage = lazyRoute(() => import('@/pages/mobile/MobileJournalDetailPage.jsx'));
const MobileRawMaterialsPage = lazyRoute(() => import('@/pages/mobile/MobileRawMaterialsPage.jsx'));
const MobileRawMaterialEditorPage = lazyRoute(() => import('@/pages/mobile/MobileRawMaterialEditorPage.jsx'));
const MobileRawMaterialDetailPage = lazyRoute(() => import('@/pages/mobile/MobileRawMaterialDetailPage.jsx'));
const MobileRawMaterialAuditPage = lazyRoute(() => import('@/pages/mobile/MobileRawMaterialAuditPage.jsx'));
const MobileCategoriesPage = lazyRoute(() => import('@/pages/mobile/MobileCategoriesPage.jsx'));
const MobileSiteImagesPage = lazyRoute(() => import('@/pages/mobile/MobileSiteImagesPage.jsx'));
const MobileFormulasPage = lazyRoute(() => import('@/pages/mobile/MobileFormulasPage.jsx'));
const MobileCreateFormulaPage = lazyRoute(() => import('@/pages/mobile/MobileCreateFormulaPage.jsx'));
const MobileEditFormulaPage = lazyRoute(() => import('@/pages/mobile/MobileEditFormulaPage.jsx'));
const MobileFormulaDetailPage = lazyRoute(() => import('@/pages/mobile/MobileFormulaDetailPage.jsx'));
const MobileBatchesPage = lazyRoute(() => import('@/pages/mobile/MobileBatchesPage.jsx'));
const MobileProductionCostingPage = lazyRoute(() => import('@/pages/mobile/MobileProductionCostingPage.jsx'));
const MobileValidationPage = lazyRoute(() => import('@/pages/mobile/MobileValidationPage.jsx'));
const MobileValidationEditorPage = lazyRoute(() => import('@/pages/mobile/MobileValidationEditorPage.jsx'));

const desktopProtectedRoutePrefixes = [
  '/studio',
  '/dashboard',
  '/authenticator',

  '/raw-materials',
  '/raw-material',
  '/raw-material-audit',
  '/categories',
  '/formulas',
  '/batches',
  '/production-costing',
  '/validation',
];

const isDesktopProtectedRoute = (pathname) => (
  !pathname.startsWith('/mobile')
  && desktopProtectedRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
);

const storefrontRoutePrefixes = [
  '/home',
  '/catalog',
  '/products',
  '/articles',
  '/bespoke',
  '/materials',
  '/journal',
  '/cart',
  '/checkout',
  '/payment',
  '/customer',
  '/track',
  '/track-order',
  '/hug',
  '/chant-nocturne',
  '/jaipong',
  '/porte-vers-le-paradis',
  '/trace-daventure',
  '/not-found',
];

const isStorefrontRoute = (pathname) => (
  !pathname.startsWith('/mobile')
  && storefrontRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
);

const HomeRouteFallback = () => (
  <main className="min-h-screen bg-[#f7f1e5] text-[#1b1a16]">
    <StorefrontHeader
      className="border-[#1b1a16]/10 bg-[#f7f1e5] text-[#1b1a16]"
      actions={[
        { to: '/catalog', label: 'Collection' },
        { to: '/bespoke', label: 'Bespoke' },
        { to: '/articles', label: 'Journal' },
        { to: '/cart', label: 'Cart', icon: 'cart' },
      ]}
    />
    <section className="mx-auto grid min-h-[68vh] max-w-6xl content-center px-6 py-16">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#b08b4f]">ARTISAN PERFUMERY ATELIER</p>
      <h1 className="mt-4 max-w-3xl font-serif text-6xl font-medium leading-none text-[#1b1a16]">
        Fragrance as a memory object.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-[#6f695f]">
        SOLIVAGANT is an artisan perfume atelier by Dekito, crafting quiet olfactive works from raw materials, memory, and personal ritual.
      </p>
    </section>
  </main>
);

const RouteFallback = () => {
  const { pathname } = useLocation();

  if (pathname === '/home' || pathname === '/') {
    return <HomeRouteFallback />;
  }

  if (isDesktopProtectedRoute(pathname)) {
    return (
      <AuthenticatedLayout>
        <div className="page-container">
          <StudioLoadingState
            title="Preparing desktop workspace"
            description="Menyiapkan shell, data, dan halaman studio supaya transisi tidak kosong."
          />
        </div>
      </AuthenticatedLayout>
    );
  }

  if (isStorefrontRoute(pathname)) {
    return (
      <StorefrontLoadingState
        title="Preparing storefront"
        description="Menjaga header dan konten tetap terlihat saat halaman web berpindah."
        mode={pathname.startsWith('/products/') ? 'product' : 'page'}
      />
    );
  }

  if (pathname === '/mobile' || pathname.startsWith('/mobile/')) {
    return (
      <MobileLoadingState
        eyebrow="App initialization"
        title="Loading workspace..."
        subtitle="Menyiapkan halaman dan data mobile."
        className="min-h-screen"
      />
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f8f2] px-4 text-center">
      <div className="w-full max-w-xl rounded-[24px] border border-[#263d27]/10 bg-white/85 p-5 text-left shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#263d27]/15 border-t-[#263d27]" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">App initialization</p>
            <h1 className="mt-1 text-xl font-bold text-[#0b130c]">Loading workspace...</h1>
          </div>
        </div>
        <div className="mt-5 space-y-3" aria-hidden="true">
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-[#dce4d5]" />
          <div className="h-3 w-full animate-pulse rounded-full bg-[#eef2e8]" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-20 animate-pulse rounded-2xl bg-[#eef2e8]" />
            <div className="h-20 animate-pulse rounded-2xl bg-[#eef2e8]" />
            <div className="h-20 animate-pulse rounded-2xl bg-[#eef2e8]" />
          </div>
        </div>
      </div>
    </div>
  );
};

const RootRedirect = () => {
  if (isMobileBrowser()) {
    return <Navigate to="/mobile/dashboard" replace />;
  }

  return <HomePage />;
};

const LegacyJournalRedirect = ({ mode = 'detail' }) => {
  const { id } = useParams();

  if (mode === 'new') {
    return <Navigate to="/studio/journal/new" replace />;
  }

  if (!id) {
    return <Navigate to="/studio/journal" replace />;
  }

  return <Navigate to={mode === 'edit' ? `/studio/journal/${id}/edit` : `/studio/journal/${id}`} replace />;
};

const MobileBrowserRedirect = () => {
  const { pathname, search, hash } = useLocation();
  const [mobileRouteTick, setMobileRouteTick] = useState(0);
  const mobilePath = isMobileBrowser() ? toMobilePath(pathname) : null;

  useEffect(() => {
    const refreshMobileRoute = () => setMobileRouteTick((current) => current + 1);
    const standaloneMediaQuery = window.matchMedia?.('(display-mode: standalone)');

    if (standaloneMediaQuery?.addEventListener) {
      standaloneMediaQuery.addEventListener('change', refreshMobileRoute);
    } else if (standaloneMediaQuery?.addListener) {
      standaloneMediaQuery.addListener(refreshMobileRoute);
    }

    return () => {
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

  const separator = mobilePath.includes('?') && search ? '&' : '';
  const normalizedSearch = separator ? search.slice(1) : search;

  return <Navigate to={`${mobilePath}${separator}${normalizedSearch}${hash}`} replace />;
};

const mobileTabOrder = ['/mobile/dashboard', '/mobile/catalog', '/mobile/articles'];
const mobileDetailPatterns = [
  /^\/mobile\/products\/[^/]+$/,
  /^\/mobile\/articles\/[^/]+$/,
  /^\/mobile\/studio\/orders\/[^/]+$/,

  /^\/mobile\/journal\/[^/]+$/,
  /^\/mobile\/raw-material\/[^/]+$/,
  /^\/mobile\/formulas\/[^/]+$/,
];
const mobileCommercePatterns = [
  /^\/mobile\/dashboard$/,
  /^\/mobile\/catalog$/,
  /^\/mobile\/articles$/,
  /^\/mobile\/products\/[^/]+$/,
  /^\/mobile\/articles\/[^/]+$/,
  /^\/mobile\/bespoke$/,
  /^\/mobile\/cart$/,
  /^\/mobile\/checkout$/,
  /^\/mobile\/payment$/,
  /^\/mobile\/customer$/,
  /^\/mobile\/customer\/invoice\/[^/]+$/,
];

const getMobileRouteMeta = (pathname) => {
  const isMobile = pathname.startsWith('/mobile/');
  const isTab = mobileTabOrder.includes(pathname);
  const isDetail = mobileDetailPatterns.some((pattern) => pattern.test(pathname));
  const isCommerce = mobileCommercePatterns.some((pattern) => pattern.test(pathname));

  return {
    isMobile,
    isCommerce,
    isTab,
    isDetail,
    depth: pathname.split('/').filter(Boolean).length,
    tabIndex: mobileTabOrder.indexOf(pathname),
  };
};

const pageTransitionClassNames = {
  push: 'mobile-route-transition-push',
  pop: 'mobile-route-transition-pop',
  tabForward: 'mobile-route-transition-tab-forward',
  tabBackward: 'mobile-route-transition-tab-backward',
  fade: 'mobile-route-transition-fade',
};

const MobileRouteTransition = ({ children }) => {
  const location = useLocation();
  const navigationType = useNavigationType();
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
  }, [currentMeta]);

  if (!currentMeta.isMobile || (currentMeta.isCommerce && previousMeta.isCommerce)) {
    return children;
  }

  return (
    <div
      key={location.pathname}
      className={`mobile-route-transition ${pageTransitionClassNames[transitionKind] || pageTransitionClassNames.fade}`}
    >
      {cloneElement(children, { location })}
    </div>
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
        <Route path="/catalog/:slug" element={<PublicProductDetailPage />} />
        <Route path="/products/:slug" element={<PublicProductDetailPage />} />
        <Route path="/hug" element={<PublicProductDetailPage />} />
        <Route path="/chant-nocturne" element={<PublicProductDetailPage />} />
        <Route path="/jaipong" element={<PublicProductDetailPage />} />
        <Route path="/porte-vers-le-paradis" element={<PublicProductDetailPage />} />
        <Route path="/trace-daventure" element={<PublicProductDetailPage />} />
        <Route path="/articles/:slug" element={<PublicJournalArticlePage />} />
        <Route path="/bespoke" element={<BespokePage />} />
        <Route path="/materials" element={<PublicMaterialsPage />} />
        <Route path="/journal" element={<PublicJournalPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/customer" element={<CustomerPortalPage />} />
        <Route path="/customer/invoice/:orderNumber" element={<CustomerInvoicePage />} />
        <Route path="/track-order" element={<PublicTrackingPage />} />
        <Route path="/track-order/:code" element={<PublicTrackingPage />} />
        <Route path="/track" element={<PublicTrackingPage />} />
        <Route path="/track/:code" element={<PublicTrackingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/mobile/login" element={<MobileLoginPage />} />
        <Route path="/mobile/reset-password" element={<ResetPasswordPage mobile />} />

        <Route path="/mobile" element={
          <Navigate to="/mobile/dashboard" replace />
        } />

        <Route path="/mobile/home" element={
          <Navigate to="/mobile/dashboard" replace />
        } />

        <Route path="/mobile/dashboard" element={<MobileCommerceTabsPage />} />

        <Route path="/mobile/catalog" element={<MobileCommerceTabsPage />} />

        <Route path="/mobile/articles" element={<MobileCommerceTabsPage />} />

        <Route path="/mobile/products/:slug" element={<MobileProductDetailPage />} />

        <Route path="/mobile/articles/:slug" element={<PublicJournalArticlePage mobile />} />

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

        <Route path="/mobile/studio/vouchers" element={
          <ProtectedRoute>
            <MobileVoucherManagementPage />
          </ProtectedRoute>
        } />

        <Route path="/mobile/studio/shipping" element={
          <ProtectedRoute>
            <MobileShippingPromotionPage />
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


        <Route path="/mobile/journal" element={
          <ProtectedRoute>
            <MobileJournalPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/studio/journal" element={
          <ProtectedRoute>
            <Navigate to="/mobile/journal" replace />
          </ProtectedRoute>
        } />
        <Route path="/mobile/journal/new" element={
          <ProtectedRoute>
            <MobileJournalEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/journal/:id/edit" element={
          <ProtectedRoute>
            <MobileJournalEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/mobile/journal/:id" element={
          <ProtectedRoute>
            <MobileJournalDetailPage />
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
        <Route path="/mobile/raw-material/:id/edit" element={
          <ProtectedRoute>
            <MobileRawMaterialEditorPage />
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
        <Route path="/mobile/studio/site-images" element={
          <ProtectedRoute>
            <MobileSiteImagesPage />
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

        <Route path="/studio/vouchers" element={
          <ProtectedRoute>
            <VoucherManagementPage />
          </ProtectedRoute>
        } />

        <Route path="/studio/shipping" element={
          <ProtectedRoute>
            <ShippingPromotionPage />
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

        <Route path="/studio/site-images" element={
          <ProtectedRoute>
            <SiteImageManagerPage />
          </ProtectedRoute>
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Navigate to="/studio" replace />
          </ProtectedRoute>
        } />

<Route path="/studio/journal" element={
          <ProtectedRoute>
            <JournalPage />
          </ProtectedRoute>
        } />
        <Route path="/studio/journal/new" element={
          <ProtectedRoute>
            <JournalEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/studio/journal/:id/edit" element={
          <ProtectedRoute>
            <JournalEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/studio/journal/:id" element={
          <ProtectedRoute>
            <JournalDetailPage />
          </ProtectedRoute>
        } />
        <Route path="/journal/new" element={
          <ProtectedRoute>
            <LegacyJournalRedirect mode="new" />
          </ProtectedRoute>
        } />
        <Route path="/journal/:id/edit" element={
          <ProtectedRoute>
            <LegacyJournalRedirect mode="edit" />
          </ProtectedRoute>
        } />
        <Route path="/journal/:id" element={
          <ProtectedRoute>
            <LegacyJournalRedirect />
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
        <Route path="/not-found" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
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
