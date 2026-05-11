import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { Package, Beaker, AlertTriangle, Sparkles, ArrowRight, ClipboardCheck, NotebookPen, ClipboardList, Layers3, PackageCheck, PackagePlus, ShoppingBag, Tags, Truck, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import { useBriefMaterialShortlists } from '@/hooks/useBriefMaterialShortlists.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useOrders } from '@/hooks/useOrders.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import DashboardSummaryCard from '@/components/DashboardSummaryCard.jsx';
import DashboardSection from '@/components/DashboardSection.jsx';
import RecentActivityList from '@/components/RecentActivityList.jsx';
import OperationalInsightCard from '@/components/OperationalInsightCard.jsx';
import { formatStatus } from '@/utils/formatting.js';
import { getProductLowStock } from '@/services/productCatalogService.js';
import { checkDokuHealth, checkShippingHealth, getOpsHealthSnapshot, runOpsHealthRetry } from '@/services/opsHealthService.js';
import { getAllOrderAuditLogs, isOrderReservationExpired } from '@/services/orderService.js';

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const formatDate = (value) => (value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-');

const auditActionLabels = {
  order_status_updated: 'Order status',
  payment_status_updated: 'Payment status',
  shipment_updated: 'Fulfillment / resi',
  order_cancelled: 'Cancel order',
  order_deleted: 'Delete order',
};
const importantAuditKeys = ['paymentStatus', 'status', 'shipmentStatus', 'trackingNumber', 'payment_status', 'shipment_status', 'tracking_number'];

const formatAuditValue = (value) => {
  if (value === '' || value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const formatAuditLabel = (key) => key
  .replace(/([A-Z])/g, ' $1')
  .replace(/_/g, ' ')
  .replace(/^./, (char) => char.toUpperCase());

const getAuditChanges = (previousValues = {}, nextValues = {}) => {
  const keys = Array.from(new Set([...Object.keys(previousValues || {}), ...Object.keys(nextValues || {})]));
  return keys
    .filter((key) => formatAuditValue(previousValues?.[key]) !== formatAuditValue(nextValues?.[key]))
    .map((key) => ({
      key,
      label: formatAuditLabel(key),
      before: formatAuditValue(previousValues?.[key]),
      after: formatAuditValue(nextValues?.[key]),
    }));
};

const isTransientNetworkError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('failed to fetch') || message.includes('network');
};

const runWithRetry = async (loader, retries = 1) => {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isTransientNetworkError(error)) {
        throw error;
      }
      await sleep(350);
    }
  }

  throw lastError;
};

const hasGuidanceCoverage = (material) => (
  Boolean(
    material?.workbook_code
    || material?.reference_abc_primary_family
    || material?.reference_impact !== null && material?.reference_impact !== undefined
    || material?.reference_life_hours !== null && material?.reference_life_hours !== undefined
    || material?.ifra_limit !== null && material?.ifra_limit !== undefined
  )
);

const DashboardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const { fetchMaterialsSummary } = useRawMaterials();
  const { getFormulas } = useFormulas();
  const { getBriefs } = useBriefs();
  const { getValidationLogs } = useValidationLogs();
  const { getBriefMaterialShortlistsByBriefIds } = useBriefMaterialShortlists();
  const catalogProducts = useCatalogProducts();
  const { orders, summary: orderSummary } = useOrders();

  const [materials, setMaterials] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [briefs, setBriefs] = useState([]);
  const [validationLogs, setValidationLogs] = useState([]);
  const [orderAuditLogs, setOrderAuditLogs] = useState([]);
  const [auditFilters, setAuditFilters] = useState({ admin: 'all', event: 'all', query: '' });
  const [pipelineSummary, setPipelineSummary] = useState({ shortlistCount: 0 });
  const [loading, setLoading] = useState(true);
  const [healthChecking, setHealthChecking] = useState('');
  const [serviceHealth, setServiceHealth] = useState({
    doku: null,
    shipping: null,
    lastCheckedAt: '',
  });

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        runWithRetry(() => fetchMaterialsSummary()),
        runWithRetry(() => getFormulas()),
        runWithRetry(() => getBriefs()),
        runWithRetry(() => getValidationLogs()),
        runWithRetry(() => getAllOrderAuditLogs()),
      ]);

      const [materialsResult, formulasResult, briefsResult, validationLogsResult, orderAuditLogsResult] = results;
      const failedRequests = results.filter((result) => result.status === 'rejected');

      setMaterials(materialsResult.status === 'fulfilled' ? materialsResult.value : []);
      setFormulas(formulasResult.status === 'fulfilled' ? formulasResult.value : []);
      setBriefs(briefsResult.status === 'fulfilled' ? briefsResult.value : []);
      setValidationLogs(validationLogsResult.status === 'fulfilled' ? validationLogsResult.value : []);
      setOrderAuditLogs(orderAuditLogsResult.status === 'fulfilled' ? orderAuditLogsResult.value : []);

      const briefRows = briefsResult.status === 'fulfilled' ? briefsResult.value : [];
      const shortlistMap = await getBriefMaterialShortlistsByBriefIds(briefRows.map((brief) => brief.id));
      const shortlistCount = [...shortlistMap.values()].reduce((sum, items) => sum + items.length, 0);
      setPipelineSummary({
        shortlistCount,
      });

      if (failedRequests.length) {
        console.error('Dashboard data loaders failed:', failedRequests.map((result) => result.reason));
        toast.error(
          failedRequests.length === results.length
            ? 'Failed to load dashboard data'
            : 'Some dashboard data could not be loaded'
        );
      }
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const guidanceBackedMaterials = useMemo(
    () => materials.filter((material) => hasGuidanceCoverage(material)),
    [materials]
  );
  const missingGuidanceMaterials = useMemo(
    () => materials.filter((material) => !hasGuidanceCoverage(material)),
    [materials]
  );
  const formulasInProgress = useMemo(
    () => formulas.filter((formula) => formula.status === 'draft' || formula.status === 'active'),
    [formulas]
  );
  const activeBriefs = useMemo(
    () => briefs.filter((brief) => brief.status === 'draft' || brief.status === 'active'),
    [briefs]
  );
  const actionNeededLogs = useMemo(
    () => validationLogs.filter((log) => log.status === 'action_needed'),
    [validationLogs]
  );
  const customProducts = useMemo(
    () => catalogProducts.filter((product) => product.source === 'custom'),
    [catalogProducts]
  );
  const lowStockProducts = useMemo(
    () => catalogProducts.filter(getProductLowStock),
    [catalogProducts]
  );
  const paidReadyOrders = useMemo(
    () => orders.filter((order) => order.paymentStatus === 'paid' && !['shipped', 'delivered'].includes(order.shipmentStatus) && !['completed', 'cancelled'].includes(order.status)),
    [orders]
  );
  const paymentFollowUps = useMemo(
    () => orders.filter((order) => ['unpaid', 'pending'].includes(order.paymentStatus)),
    [orders]
  );
  const shipmentFollowUps = useMemo(
    () => orders.filter((order) => order.shipmentStatus === 'shipped' && !['completed', 'cancelled'].includes(order.status)),
    [orders]
  );
  const opsHealth = useMemo(() => getOpsHealthSnapshot(orders), [orders]);
  const pendingRevenue = useMemo(
    () => orders
      .filter((order) => ['unpaid', 'pending'].includes(order.paymentStatus) && order.status !== 'cancelled')
      .reduce((sum, order) => sum + Number(order.subtotal || 0), 0),
    [orders],
  );
  const expiredPaymentOrders = useMemo(
    () => orders.filter((order) => order.paymentStatus === 'expired' || isOrderReservationExpired(order)),
    [orders],
  );
  const shipmentAgingOrders = useMemo(() => {
    const now = Date.now();
    return paidReadyOrders
      .map((order) => ({
        ...order,
        agingHours: Math.max(0, Math.round((now - new Date(order.updatedAt || order.createdAt || now).getTime()) / 36e5)),
      }))
      .filter((order) => order.agingHours >= 48)
      .sort((a, b) => b.agingHours - a.agingHours);
  }, [paidReadyOrders]);
  const auditAdmins = useMemo(() => (
    Array.from(new Set(orderAuditLogs.map((log) => log.actorEmail || log.actorName || 'system'))).filter(Boolean)
  ), [orderAuditLogs]);
  const auditEvents = useMemo(() => (
    Array.from(new Set(orderAuditLogs.map((log) => log.action))).filter(Boolean)
  ), [orderAuditLogs]);
  const filteredAuditLogs = useMemo(() => {
    const query = auditFilters.query.trim().toLowerCase();
    return orderAuditLogs.filter((log) => {
      const admin = log.actorEmail || log.actorName || 'system';
      const matchesAdmin = auditFilters.admin === 'all' || admin === auditFilters.admin;
      const matchesEvent = auditFilters.event === 'all' || log.action === auditFilters.event;
      const matchesQuery = !query || [
        log.orderNumber,
        log.actorEmail,
        log.actorName,
        log.action,
        JSON.stringify(log.previousValues || {}),
        JSON.stringify(log.nextValues || {}),
      ].some((value) => String(value || '').toLowerCase().includes(query));
      return matchesAdmin && matchesEvent && matchesQuery;
    });
  }, [auditFilters, orderAuditLogs]);

  const runServiceHealthCheck = async () => {
    setHealthChecking('services');
    try {
      const [doku, shipping] = await Promise.allSettled([
        checkDokuHealth(orders),
        checkShippingHealth(),
      ]);
      setServiceHealth({
        doku: doku.status === 'fulfilled' ? doku.value : { ok: false, label: doku.reason?.message || 'DOKU check gagal' },
        shipping: shipping.status === 'fulfilled' ? shipping.value : { ok: false, label: shipping.reason?.message || 'Shipping check gagal' },
        lastCheckedAt: new Date().toISOString(),
      });
      toast.success('Payment dan shipping health dicek');
    } catch (error) {
      toast.error(error.message || 'Health check gagal');
    } finally {
      setHealthChecking('');
    }
  };

  const retryOpsHealth = async () => {
    setHealthChecking('retry');
    try {
      const result = await runOpsHealthRetry(orders);
      await loadDashboardData();
      if (result.errors.length) {
        toast.error(result.errors[0]);
        return;
      }
      const synced = result.syncResults.filter((item) => item.ok).length;
      toast.success(`${synced} sync retry, ${result.expiredOrders.length} expired payment disapu`);
    } catch (error) {
      toast.error(error.message || 'Retry ops gagal');
    } finally {
      setHealthChecking('');
    }
  };
  const todayPriorities = [
    {
      icon: Truck,
      label: 'Paid-ready',
      title: `${paidReadyOrders.length} order siap packing`,
      helper: 'Packing, input resi, lalu ship',
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      action: 'Open shipments',
      onClick: () => navigate('/studio/shipments'),
    },
    {
      icon: PackageCheck,
      label: 'Follow-up',
      title: `${paymentFollowUps.length} payment pending`,
      helper: 'Sync DOKU atau kirim payment link',
      tone: 'bg-amber-50 text-amber-800 border-amber-100',
      action: 'Open orders',
      onClick: () => navigate('/studio/orders'),
    },
    {
      icon: AlertTriangle,
      label: 'Low stock',
      title: `${lowStockProducts.length} product hampir habis`,
      helper: 'Cek varian, restock, atau hide dari storefront',
      tone: 'bg-rose-50 text-rose-700 border-rose-100',
      action: 'Open products',
      onClick: () => navigate('/studio/products'),
    },
  ];
  const recentFormulas = useMemo(
    () => [...formulas].sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, 5),
    [formulas]
  );
  const recentBriefs = useMemo(
    () => [...briefs].sort((a, b) => new Date(b.updated || b.created || 0) - new Date(a.updated || a.created || 0)).slice(0, 5),
    [briefs]
  );
  const recentMaterials = useMemo(
    () => [...materials].sort((a, b) => new Date(b.updated || b.created || 0) - new Date(a.updated || a.created || 0)).slice(0, 5),
    [materials]
  );
  const guidanceGapPreview = missingGuidanceMaterials.slice(0, 5);
  const validationPreview = actionNeededLogs.slice(0, 5);
  const formulasById = useMemo(
    () => new Map(formulas.map((formula) => [formula.id, formula])),
    [formulas]
  );
  const displayName =
    currentUser?.user_metadata?.name?.trim()
    || currentUser?.email?.split('@')[0]
    || 'Solivagant';

  const summaryCards = [
    {
      icon: ClipboardList,
      label: 'Active briefs',
      count: activeBriefs.length,
      color: 'text-violet-600',
      onClick: () => navigate('/briefs'),
    },
    {
      icon: Layers3,
      label: 'Shortlist entries',
      count: pipelineSummary.shortlistCount,
      color: 'text-amber-600',
      onClick: () => navigate('/briefs'),
    },
    {
      icon: Beaker,
      label: 'Formulas needing work',
      count: formulasInProgress.length,
      color: 'text-primary',
      onClick: () => navigate('/formulas'),
    },
    {
      icon: ClipboardCheck,
      label: 'Action-needed logs',
      count: actionNeededLogs.length,
      color: 'text-blue-600',
      onClick: () => navigate('/validation'),
    },
    {
      icon: Package,
      label: 'Guidance gaps',
      count: missingGuidanceMaterials.length,
      color: 'text-rose-600',
      onClick: () => navigate('/raw-materials'),
    },
  ];

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Studio - Solivagant</title>
        <meta
          name="description"
          content="Track formulation progress, guidance coverage, brief activity, and validation follow-up from one perfumery workspace."
        />
      </Helmet>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <div className="dashboard-hero-eyebrow">
              <Sparkles className="w-4 h-4 text-primary" />
              Halo, {displayName}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>
              Solivagant siap dipakai.
            </h1>
            <p className="max-w-3xl text-base text-muted-foreground">
              {formulas.length > 0
                ? `${displayName}, sekarang ada ${formulasInProgress.length} formula yang sedang berjalan, ${activeBriefs.length} brief aktif, ${pipelineSummary.shortlistCount} shortlist entries, ${missingGuidanceMaterials.length} material yang masih butuh guidance, dan ${actionNeededLogs.length} validation note yang minta tindak lanjut.`
                : `${displayName}, belum ada formula aktif. Mulai langsung dari formula mandiri, atau buat brief dulu kalau butuh arah project.`}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => navigate('/formulas/new')} className="h-11 rounded-2xl gap-2 px-5">
                <Beaker className="w-4 h-4" />
                New formula
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={() => navigate('/briefs')} className="h-11 rounded-2xl gap-2 border-white/70 bg-white/80 px-5">
                <ClipboardList className="w-4 h-4" />
                Start from briefs
              </Button>
              <Button variant="outline" onClick={() => navigate('/formulas')} className="h-11 rounded-2xl gap-2 border-white/70 bg-white/80 px-5">
                Open formulas
              </Button>
              <Button variant="outline" onClick={() => navigate('/raw-materials')} className="h-11 rounded-2xl gap-2 border-white/70 bg-white/80 px-5">
                Library maintenance
              </Button>
            </div>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat-label">Formulas in progress</span>
              <strong>{formulasInProgress.length}</strong>
            </div>
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat-label">Active briefs</span>
              <strong>{activeBriefs.length}</strong>
            </div>
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat-label">Action-needed logs</span>
              <strong>{actionNeededLogs.length}</strong>
            </div>
          </div>
        </div>

        <DashboardSection title="Workspace areas" subtitle="Dashboard dibagi dua area besar: Studio untuk proses perfumery, E-commerce untuk toko dan order.">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="rounded-3xl border border-white/70 bg-white/86 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase text-amber-700">
                    <ShoppingBag className="h-4 w-4" />
                    E-commerce
                  </div>
                  <h2 className="mt-4 text-xl font-bold">Storefront, product, order, shipment</h2>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                    Area toko dipisahkan dari studio: product management, product categories, orders, dan shipment.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#fbfaf7] px-4 py-3 text-right">
                  <div className="text-xs font-bold uppercase text-muted-foreground">Active orders</div>
                  <div className="text-2xl font-bold">{orderSummary.active}</div>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Button variant="outline" className="h-12 rounded-2xl justify-start gap-2 bg-white" onClick={() => navigate('/studio/products')}>
                  <PackagePlus className="h-4 w-4" />
                  Product management
                </Button>
                <Button variant="outline" className="h-12 rounded-2xl justify-start gap-2 bg-white" onClick={() => navigate('/studio/product-categories')}>
                  <Tags className="h-4 w-4" />
                  Product categories
                </Button>
                <Button variant="outline" className="h-12 rounded-2xl justify-start gap-2 bg-white" onClick={() => navigate('/studio/orders')}>
                  <PackageCheck className="h-4 w-4" />
                  Orders
                </Button>
                <Button variant="outline" className="h-12 rounded-2xl justify-start gap-2 bg-white" onClick={() => navigate('/studio/shipments')}>
                  <Truck className="h-4 w-4" />
                  Shipments
                </Button>
                <Button variant="outline" className="h-12 rounded-2xl justify-start gap-2 bg-white" onClick={() => navigate('/home')}>
                  <ShoppingBag className="h-4 w-4" />
                  Storefront
                </Button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-2xl bg-[#fbfaf7] p-3"><span className="block text-xs font-bold uppercase text-muted-foreground">Catalog</span><strong>{catalogProducts.length}</strong></div>
                <div className="rounded-2xl bg-[#fbfaf7] p-3"><span className="block text-xs font-bold uppercase text-muted-foreground">Custom</span><strong>{customProducts.length}</strong></div>
                <div className="rounded-2xl bg-[#fbfaf7] p-3"><span className="block text-xs font-bold uppercase text-muted-foreground">Orders</span><strong>{orderSummary.total}</strong></div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/70 bg-white/86 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase text-blue-700">
                    <Beaker className="h-4 w-4" />
                    Studio
                  </div>
                  <h2 className="mt-4 text-xl font-bold">Formula, material, dan validasi</h2>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                    Area kerja inti perfumery untuk brief, library material, composer, costing, dan validation follow-up.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#fbfaf7] px-4 py-3 text-right">
                  <div className="text-xs font-bold uppercase text-muted-foreground">Action logs</div>
                  <div className="text-2xl font-bold">{actionNeededLogs.length}</div>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Button variant="outline" className="h-12 rounded-2xl justify-start gap-2 bg-white" onClick={() => navigate('/formulas')}>
                  <Beaker className="h-4 w-4" />
                  Formulas
                </Button>
                <Button variant="outline" className="h-12 rounded-2xl justify-start gap-2 bg-white" onClick={() => navigate('/raw-materials')}>
                  <Package className="h-4 w-4" />
                  Materials
                </Button>
                <Button variant="outline" className="h-12 rounded-2xl justify-start gap-2 bg-white" onClick={() => navigate('/briefs')}>
                  <ClipboardList className="h-4 w-4" />
                  Briefs
                </Button>
                <Button variant="outline" className="h-12 rounded-2xl justify-start gap-2 bg-white" onClick={() => navigate('/validation')}>
                  <NotebookPen className="h-4 w-4" />
                  Validation
                </Button>
              </div>
            </section>
          </div>
        </DashboardSection>

        <DashboardSection title="Today priority" subtitle="Queue kerja harian yang paling perlu disentuh dulu.">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {todayPriorities.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.tone}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/80">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase">{item.label}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-[#0b130c]">{item.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed opacity-80">{item.helper}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold">
                    {item.action}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <button type="button" onClick={() => navigate('/studio/orders')} className="rounded-2xl border bg-white p-4 text-left shadow-sm">
              <div className="text-xs font-bold uppercase text-muted-foreground">Shipment follow-up</div>
              <div className="mt-1 text-2xl font-bold">{shipmentFollowUps.length}</div>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">Paket shipped yang belum completed.</p>
            </button>
            <button type="button" onClick={() => navigate('/validation')} className="rounded-2xl border bg-white p-4 text-left shadow-sm">
              <div className="text-xs font-bold uppercase text-muted-foreground">Validation follow-up</div>
              <div className="mt-1 text-2xl font-bold">{actionNeededLogs.length}</div>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">Notes yang butuh action.</p>
            </button>
            <button type="button" onClick={() => navigate('/raw-materials')} className="rounded-2xl border bg-white p-4 text-left shadow-sm">
              <div className="text-xs font-bold uppercase text-muted-foreground">Guidance gaps</div>
              <div className="mt-1 text-2xl font-bold">{missingGuidanceMaterials.length}</div>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">Material yang perlu dilengkapi.</p>
            </button>
          </div>
        </DashboardSection>

        <DashboardSection title="Admin ops metrics" subtitle="Angka praktis untuk follow-up order, packing, payment expiry, stock, dan aging shipment.">
          <div className="grid gap-4 lg:grid-cols-5">
            {[
              ['Pending revenue', formatTotal(pendingRevenue), 'Payment unpaid/pending', 'text-amber-700 bg-amber-50'],
              ['Paid ready ship', paidReadyOrders.length, 'Paid dan belum shipped', 'text-emerald-700 bg-emerald-50'],
              ['Expired payment', expiredPaymentOrders.length, 'Expired atau melewati TTL', 'text-rose-700 bg-rose-50'],
              ['Low stock', lowStockProducts.length, 'Produk di bawah threshold', 'text-rose-700 bg-rose-50'],
              ['Shipment aging', shipmentAgingOrders.length, 'Paid-ready lebih dari 48 jam', 'text-sky-700 bg-sky-50'],
            ].map(([label, value, helper, tone]) => (
              <div key={label} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="text-xs font-bold uppercase text-muted-foreground">{label}</div>
                <div className={`mt-2 w-fit rounded-2xl px-3 py-1 text-2xl font-bold ${tone}`}>{value}</div>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-muted-foreground">{helper}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border bg-white/90 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-bold">Shipment aging</h3>
                <Button type="button" variant="outline" className="h-9 rounded-2xl bg-white text-xs" onClick={() => navigate('/studio/shipments')}>Open shipments</Button>
              </div>
              <div className="grid gap-2">
                {shipmentAgingOrders.slice(0, 4).map((order) => (
                  <button key={order.id || order.orderNumber} type="button" onClick={() => navigate(`/studio/orders/${order.id || order.orderNumber}`)} className="rounded-2xl bg-[#fbfaf7] px-4 py-3 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold">{order.orderNumber}</span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-800">{order.agingHours} jam</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{order.customerName} / {order.courierName || 'Kurir belum diisi'}</p>
                  </button>
                ))}
                {!shipmentAgingOrders.length ? <p className="rounded-2xl bg-[#fbfaf7] px-4 py-3 text-sm font-semibold text-muted-foreground">Tidak ada paid-ready shipment yang aging di atas 48 jam.</p> : null}
              </div>
            </section>
            <section className="rounded-2xl border bg-white/90 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-bold">Low-stock notification</h3>
                <Button type="button" variant="outline" className="h-9 rounded-2xl bg-white text-xs" onClick={() => navigate('/studio/products')}>Open products</Button>
              </div>
              <div className="grid gap-2">
                {lowStockProducts.slice(0, 4).map((product) => (
                  <button key={product.id || product.slug} type="button" onClick={() => navigate('/studio/products')} className="rounded-2xl bg-rose-50 px-4 py-3 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-[#1f2937]">{product.name}</span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-rose-700">{product.stock} left</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-rose-800">{product.category} / restock disarankan.</p>
                  </button>
                ))}
                {!lowStockProducts.length ? <p className="rounded-2xl bg-[#fbfaf7] px-4 py-3 text-sm font-semibold text-muted-foreground">Tidak ada produk low stock.</p> : null}
              </div>
            </section>
          </div>
        </DashboardSection>

        <DashboardSection title="Admin audit log" subtitle="Filter perubahan by admin, event, atau order lalu cek diff before-after.">
          <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
              <input
                value={auditFilters.query}
                onChange={(event) => setAuditFilters((current) => ({ ...current, query: event.target.value }))}
                placeholder="Cari order, admin, event, atau isi diff"
                className="h-11 rounded-2xl border bg-white px-4 text-sm font-semibold outline-none focus:border-amber-300"
              />
              <select
                value={auditFilters.admin}
                onChange={(event) => setAuditFilters((current) => ({ ...current, admin: event.target.value }))}
                className="h-11 rounded-2xl border bg-white px-3 text-sm font-bold outline-none focus:border-amber-300"
              >
                <option value="all">Semua admin</option>
                {auditAdmins.map((admin) => <option key={admin} value={admin}>{admin}</option>)}
              </select>
              <select
                value={auditFilters.event}
                onChange={(event) => setAuditFilters((current) => ({ ...current, event: event.target.value }))}
                className="h-11 rounded-2xl border bg-white px-3 text-sm font-bold outline-none focus:border-amber-300"
              >
                <option value="all">Semua event</option>
                {auditEvents.map((event) => <option key={event} value={event}>{auditActionLabels[event] || event}</option>)}
              </select>
            </div>
            <div className="mt-4 grid gap-3">
              {filteredAuditLogs.slice(0, 8).map((log) => {
                const changes = getAuditChanges(log.previousValues, log.nextValues);
                const important = changes.some((change) => importantAuditKeys.includes(change.key));
                return (
                  <button key={log.id} type="button" onClick={() => navigate(`/studio/orders/${log.orderId || log.orderNumber}`)} className={`rounded-2xl border p-4 text-left ${important ? 'border-amber-200 bg-amber-50' : 'bg-[#fbfaf7]'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold">{log.orderNumber || '-'}</div>
                        <div className="mt-1 text-xs font-semibold text-muted-foreground">{formatDate(log.createdAt)} / {log.actorName || log.actorEmail || 'System'}</div>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-[#263d27]">{auditActionLabels[log.action] || log.action}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {changes.slice(0, 2).map((change) => (
                        <div key={change.key} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold">
                          <div className="font-bold uppercase text-[#263d27]">{change.label}</div>
                          <div className="mt-1 text-muted-foreground">Before: <span className="text-[#1f2937]">{change.before}</span></div>
                          <div className="text-muted-foreground">After: <span className="text-[#1f2937]">{change.after}</span></div>
                        </div>
                      ))}
                      {!changes.length ? <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-muted-foreground">Tidak ada diff field terdeteksi.</div> : null}
                    </div>
                  </button>
                );
              })}
              {!filteredAuditLogs.length ? <p className="rounded-2xl border border-dashed bg-[#fbfaf7] px-4 py-5 text-center text-sm font-semibold text-muted-foreground">Belum ada audit log yang cocok dengan filter.</p> : null}
            </div>
          </section>
        </DashboardSection>

        <DashboardSection title="Production health" subtitle="Payment, shipping, dan local fallback dibuat terlihat supaya order kritis tidak diam-diam tersimpan lokal.">
          <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <section className={`rounded-3xl border p-5 shadow-sm ${opsHealth.hasCriticalIssues ? 'border-rose-200 bg-rose-50' : 'border-emerald-100 bg-emerald-50'}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${opsHealth.hasCriticalIssues ? 'bg-white text-rose-700' : 'bg-white text-emerald-700'}`}>
                    {opsHealth.hasCriticalIssues ? <WifiOff className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                  </span>
                  <div>
                    <div className="text-xs font-bold uppercase text-muted-foreground">Order reliability</div>
                    <h2 className="mt-1 text-xl font-bold text-[#0b130c]">
                      {opsHealth.hasCriticalIssues ? 'Ada item yang perlu dicek sebelum follow-up' : 'Order flow terlihat sehat'}
                    </h2>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">
                      DOKU checkout diblokir saat order hanya local draft. Gunakan retry sync sebelum kirim payment link atau proses fulfillment.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={runServiceHealthCheck} disabled={Boolean(healthChecking)}>
                    <RefreshCw className={`h-4 w-4 ${healthChecking === 'services' ? 'animate-spin' : ''}`} />
                    Check API
                  </Button>
                  <Button type="button" className="h-11 rounded-2xl gap-2" onClick={retryOpsHealth} disabled={Boolean(healthChecking)}>
                    <RefreshCw className={`h-4 w-4 ${healthChecking === 'retry' ? 'animate-spin' : ''}`} />
                    Retry sync
                  </Button>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-white px-4 py-3">
                  <div className="text-xs font-bold uppercase text-muted-foreground">Local sync</div>
                  <div className="mt-1 text-2xl font-bold text-[#0b130c]">{opsHealth.syncQueue.length}</div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <div className="text-xs font-bold uppercase text-muted-foreground">Pending DOKU</div>
                  <div className="mt-1 text-2xl font-bold text-amber-700">{opsHealth.pendingPaymentOrders.length}</div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <div className="text-xs font-bold uppercase text-muted-foreground">Expired</div>
                  <div className="mt-1 text-2xl font-bold text-rose-700">{opsHealth.expiredPaymentOrders.length}</div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <div className="text-xs font-bold uppercase text-muted-foreground">Butuh resi</div>
                  <div className="mt-1 text-2xl font-bold text-[#263d27]">{opsHealth.shipmentNeedsResi.length}</div>
                </div>
              </div>
              {opsHealth.syncQueue.length ? (
                <div className="mt-4 grid gap-2">
                  {opsHealth.syncQueue.slice(0, 3).map((item) => (
                    <div key={item.id || item.orderNumber} className="rounded-2xl border border-white bg-white/90 px-4 py-3 text-sm font-semibold">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-[#0b130c]">{item.orderNumber}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${item.severity === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{item.action}</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.reason}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border bg-white/90 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase text-muted-foreground">External services</div>
                  <h2 className="mt-1 text-xl font-bold">DOKU & shipping health</h2>
                </div>
                <span className="rounded-full bg-[#eef2e8] px-3 py-1 text-xs font-bold uppercase text-[#263d27]">
                  {serviceHealth.lastCheckedAt ? 'Checked' : 'Manual'}
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {[
                  ['DOKU status sync', serviceHealth.doku],
                  ['RajaOngkir search', serviceHealth.shipping],
                ].map(([label, result]) => (
                  <div key={label} className="rounded-2xl border bg-[#fbfaf7] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold">{label}</div>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">{result?.label || 'Belum dicek dari dashboard ini.'}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${result ? (result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700') : 'bg-stone-100 text-stone-600'}`}>
                        {result ? (result.ok ? 'OK' : 'Issue') : 'Idle'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs font-semibold leading-relaxed text-muted-foreground">
                Tombol Check API melakukan cek ringan: sync status untuk beberapa DOKU pending dan pencarian area shipping. Retry sync juga menyapu payment reservation yang sudah expired.
              </p>
            </section>
          </div>
        </DashboardSection>

        <DashboardSection title="Ringkasan pipeline">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {summaryCards.map((card, index) => (
              <DashboardSummaryCard
                key={index}
                icon={card.icon}
                label={card.label}
                count={card.count}
                color={card.color}
                onClick={card.onClick}
                isLoading={loading}
              />
            ))}
          </div>
        </DashboardSection>

        <DashboardSection title="In progress">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <RecentActivityList
              title="Brief terbaru"
              items={recentBriefs}
              columns={[
                {
                  key: 'title',
                  render: (item) => (
                    <span className="text-sm font-medium truncate">{item.title}</span>
                  ),
                  className: 'flex-1',
                },
                {
                  key: 'status',
                  render: (item) => (
                    <span className="text-xs text-muted-foreground capitalize">{item.status || 'draft'}</span>
                  ),
                  className: 'text-right',
                },
              ]}
              emptyMessage="No briefs yet"
              onRowClick={(item) => navigate(`/briefs/${item.id}`, {
                state: { from: `${location.pathname}${location.search}` },
              })}
              isLoading={loading}
            />

            <RecentActivityList
              title="Formula terbaru"
              items={recentFormulas}
              columns={[
                {
                  key: 'name',
                  render: (item) => (
                    <span className="text-sm font-medium truncate">{item.name}</span>
                  ),
                  className: 'flex-1',
                },
                {
                  key: 'status',
                  render: (item) => (
                    <span className="text-xs text-muted-foreground capitalize">{item.status || 'draft'}</span>
                  ),
                  className: 'text-right',
                },
              ]}
              emptyMessage="No formulas yet"
              onRowClick={(item) => navigate(`/formulas/${item.id}`, {
                state: { from: `${location.pathname}${location.search}` },
              })}
              isLoading={loading}
            />
          </div>
        </DashboardSection>

        <DashboardSection title="Perlu dilihat">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OperationalInsightCard
              title="Missing guidance"
              icon={AlertTriangle}
              items={guidanceGapPreview.map((material) => ({
                id: material.id,
                name: material.name,
                badge: material.category || 'Material',
              }))}
              emptyMessage="All materials already have at least one guidance signal"
              color="text-destructive"
              badgeVariant="secondary"
              onItemClick={(item) => navigate(`/raw-material/${item.id}`, {
                state: { from: `${location.pathname}${location.search}` },
              })}
              isLoading={loading}
            />

            <OperationalInsightCard
              title="Validation follow-up"
              icon={NotebookPen}
              items={validationPreview.map((log) => ({
                id: log.id,
                name: formulasById.get(log.formula_id)?.name || 'Unknown formula',
                badge: formatStatus(log.test_type || 'revision'),
              }))}
              emptyMessage="No action-needed validation logs"
              color="text-blue-600"
              badgeVariant="outline"
              onItemClick={(item) => navigate('/validation', {
                state: { from: `${location.pathname}${location.search}` },
              })}
              isLoading={loading}
            />
          </div>
        </DashboardSection>
      </div>
    </AuthenticatedLayout>
  );
};

export default DashboardPage;

