import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { Package, Beaker, AlertTriangle, Sparkles, ArrowRight, ClipboardCheck, NotebookPen, FileCheck2, PackageCheck, PackagePlus, ShoppingBag, Tags, Truck, RefreshCw, ShieldCheck, WifiOff, BadgePercent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useOrders } from '@/hooks/useOrders.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import DashboardSummaryCard from '@/components/DashboardSummaryCard.jsx';
import DashboardSection from '@/components/DashboardSection.jsx';
import RecentActivityList from '@/components/RecentActivityList.jsx';
import OperationalInsightCard from '@/components/OperationalInsightCard.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import { formatStatus } from '@/utils/formatting.js';
import { getProductLowStock } from '@/services/productCatalogService.js';
import { checkDokuHealth, checkShippingHealth, getOpsHealthSnapshot, runOpsHealthRetry } from '@/services/opsHealthService.js';
import { getAllOrderAuditLogs, isOrderReservationExpired } from '@/services/orderService.js';
import { getVouchers } from '@/services/voucherService.js';

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const formatDate = (value) => (value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-');

const auditActionLabels = {
  order_status_updated: 'Order status',
  payment_status_updated: 'Payment status',
  payment_proof_uploaded: 'Proof uploaded',
  payment_proof_approved: 'Proof approved',
  payment_proof_rejected: 'Proof rejected',
  payment_proof_reviewed: 'Proof reviewed',
  shipment_updated: 'Fulfillment / resi',
  order_cancelled: 'Cancel order',
  order_deleted: 'Delete order',
};
const importantAuditKeys = ['paymentStatus', 'status', 'paymentProofStatus', 'shipmentStatus', 'trackingNumber', 'payment_status', 'payment_proof_status', 'shipment_status', 'tracking_number'];

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
  const { getValidationLogs } = useValidationLogs();
  const catalogProducts = useCatalogProducts();
  const { orders, summary: orderSummary } = useOrders();

  const [materials, setMaterials] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [validationLogs, setValidationLogs] = useState([]);
  const [orderAuditLogs, setOrderAuditLogs] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [auditFilters, setAuditFilters] = useState({ admin: 'all', event: 'all', query: '' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [healthChecking, setHealthChecking] = useState('');
  const [serviceHealth, setServiceHealth] = useState({
    doku: null,
    shipping: null,
    lastCheckedAt: '',
  });

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const results = await Promise.allSettled([
        runWithRetry(() => fetchMaterialsSummary()),
        runWithRetry(() => getFormulas()),
        runWithRetry(() => getValidationLogs()),
        runWithRetry(() => getAllOrderAuditLogs()),
        runWithRetry(() => getVouchers()),
      ]);

      const [materialsResult, formulasResult, validationLogsResult, orderAuditLogsResult, vouchersResult] = results;
      const loaderLabels = ['materials', 'formulas', 'validation logs', 'order audit logs', 'vouchers'];
      const failedRequests = results
        .map((result, index) => ({ result, label: loaderLabels[index] }))
        .filter(({ result }) => result.status === 'rejected');

      setMaterials(materialsResult.status === 'fulfilled' ? materialsResult.value : []);
      setFormulas(formulasResult.status === 'fulfilled' ? formulasResult.value : []);
      setValidationLogs(validationLogsResult.status === 'fulfilled' ? validationLogsResult.value : []);
      setOrderAuditLogs(orderAuditLogsResult.status === 'fulfilled' ? orderAuditLogsResult.value : []);
      setVouchers(vouchersResult.status === 'fulfilled' ? vouchersResult.value : []);

      if (failedRequests.length) {
        console.error('Dashboard data loaders failed:', failedRequests.map(({ result }) => result.reason));
        setLoadError(
          failedRequests.length === results.length
            ? 'Dashboard data could not be loaded. Check the connection and retry.'
            : `Some dashboard sections could not be loaded: ${failedRequests.map(({ label }) => label).join(', ')}.`
        );
        toast.error(
          failedRequests.length === results.length
            ? 'Failed to load dashboard data'
            : 'Some dashboard data could not be loaded'
        );
      }
    } catch (error) {
      setLoadError(error.message || 'Dashboard data could not be loaded. Check the connection and retry.');
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [fetchMaterialsSummary, getFormulas, getValidationLogs]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const missingGuidanceMaterials = useMemo(
    () => materials.filter((material) => !hasGuidanceCoverage(material)),
    [materials]
  );
  const formulasInProgress = useMemo(
    () => formulas.filter((formula) => formula.status === 'draft' || formula.status === 'active'),
    [formulas]
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
  const proofReviewOrders = useMemo(
    () => orders.filter((order) => order.paymentProofStatus === 'submitted' && !['completed', 'cancelled'].includes(order.status)),
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
  const voucherIssues = useMemo(() => {
    const now = Date.now();
    return vouchers
      .map((voucher) => {
        const expired = voucher.expiresAt && new Date(voucher.expiresAt).getTime() < now;
        const limitReached = Number(voucher.usageLimitTotal || 0) > 0 && Number(voucher.usageCount || 0) >= Number(voucher.usageLimitTotal || 0);
        const inactive = voucher.active === false;
        const reasons = [
          inactive ? 'Nonaktif' : '',
          expired ? 'Expired' : '',
          limitReached ? 'Limit habis' : '',
        ].filter(Boolean);
        return { ...voucher, issueReasons: reasons };
      })
      .filter((voucher) => voucher.issueReasons.length)
      .sort((a, b) => b.issueReasons.length - a.issueReasons.length || String(a.code).localeCompare(String(b.code)));
  }, [vouchers]);
  const syncIssueItems = useMemo(() => {
    const queued = (opsHealth.syncQueue || []).map((item) => ({
      id: item.id || item.orderNumber,
      title: item.orderNumber || item.id || 'Sync item',
      helper: item.reason || item.action || 'Perlu retry sync',
      tone: item.severity === 'critical' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800',
      onClick: () => navigate('/studio/orders'),
    }));
    const stalePending = (opsHealth.pendingPaymentOrders || [])
      .filter((order) => order.paymentProvider === 'doku' && order.paymentStatus === 'pending')
      .slice(0, 3)
      .map((order) => ({
        id: `pending-${order.id || order.orderNumber}`,
        title: order.orderNumber,
        helper: 'Pending DOKU, cek status terbaru',
        tone: 'bg-amber-50 text-amber-800',
        onClick: () => navigate(`/studio/orders/${order.id || order.orderNumber}`),
      }));
    return [...queued, ...stalePending];
  }, [navigate, opsHealth.pendingPaymentOrders, opsHealth.syncQueue]);
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
  const actionCenterItems = [
    {
      key: 'proof',
      icon: FileCheck2,
      label: 'Payment proof review',
      count: proofReviewOrders.length,
      tone: 'border-sky-100 bg-sky-50 text-sky-700',
      helper: 'Bukti transfer manual yang perlu approve/reject.',
      action: 'Review bukti',
      onClick: () => navigate('/studio/orders?filter=proof_review'),
      rows: proofReviewOrders.slice(0, 3).map((order) => ({
        id: order.id || order.orderNumber,
        title: order.orderNumber,
        helper: `${order.customerName || 'Customer'} / ${formatTotal(order.subtotal)}`,
        onClick: () => navigate(`/studio/orders/${order.id || order.orderNumber}`),
      })),
      empty: 'Tidak ada bukti transfer menunggu review.',
    },
    {
      key: 'packing',
      icon: Truck,
      label: 'Order siap packing',
      count: paidReadyOrders.length,
      tone: 'border-emerald-100 bg-emerald-50 text-emerald-700',
      helper: 'Order paid yang belum shipped/delivered.',
      action: 'Buka fulfillment',
      onClick: () => navigate('/studio/shipments'),
      rows: paidReadyOrders.slice(0, 3).map((order) => ({
        id: order.id || order.orderNumber,
        title: order.orderNumber,
        helper: `${order.customerName || 'Customer'} / ${order.quantity || 0} item`,
        onClick: () => navigate(`/studio/orders/${order.id || order.orderNumber}`),
      })),
      empty: 'Belum ada order paid yang siap packing.',
    },
    {
      key: 'stock',
      icon: Package,
      label: 'Stok rendah',
      count: lowStockProducts.length,
      tone: 'border-rose-100 bg-rose-50 text-rose-700',
      helper: 'Produk di bawah threshold dan rawan oversell.',
      action: 'Cek produk',
      onClick: () => navigate('/studio/products'),
      rows: lowStockProducts.slice(0, 3).map((product) => ({
        id: product.id || product.slug,
        title: product.name,
        helper: `${product.stock || 0} stok tersisa / ${product.category || 'Kategori'}`,
        onClick: () => navigate('/studio/products'),
      })),
      empty: 'Tidak ada produk stok rendah.',
    },
    {
      key: 'voucher',
      icon: BadgePercent,
      label: 'Voucher bermasalah',
      count: voucherIssues.length,
      tone: 'border-amber-100 bg-amber-50 text-amber-800',
      helper: 'Voucher nonaktif, expired, atau limit habis.',
      action: 'Kelola voucher',
      onClick: () => navigate('/studio/vouchers'),
      rows: voucherIssues.slice(0, 3).map((voucher) => ({
        id: voucher.id || voucher.code,
        title: voucher.code,
        helper: voucher.issueReasons.join(', '),
        onClick: () => navigate('/studio/vouchers'),
      })),
      empty: 'Tidak ada voucher bermasalah.',
    },
    {
      key: 'sync',
      icon: WifiOff,
      label: 'Sync issue',
      count: syncIssueItems.length,
      tone: 'border-slate-200 bg-slate-50 text-slate-700',
      helper: 'Local queue atau DOKU pending yang perlu dicek.',
      action: 'Retry sync',
      onClick: retryOpsHealth,
      rows: syncIssueItems.slice(0, 3),
      empty: 'Tidak ada sync issue terdeteksi.',
    },
  ];
  const recentFormulas = useMemo(
    () => [...formulas].sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, 5),
    [formulas]
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
          content="Track formulation progress, guidance coverage, formula activity, and validation follow-up from one perfumery workspace."
        />
      </Helmet>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <div className="dashboard-hero-eyebrow">
              <Sparkles className="w-4 h-4 text-primary" />
              Action center
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>
              Prioritas operasional hari ini.
            </h1>
            <p className="max-w-3xl text-base text-muted-foreground">
              Halo {displayName}, dashboard Studio sekarang memusatkan pekerjaan yang perlu segera disentuh: bukti bayar, packing, stok rendah, voucher bermasalah, dan sync issue.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => navigate('/studio/orders?filter=proof_review')} className="h-11 rounded-2xl gap-2 px-5">
                <FileCheck2 className="w-4 h-4" />
                Review bukti
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={() => navigate('/studio/shipments')} className="h-11 rounded-2xl gap-2 border-white/70 bg-white/80 px-5">
                <Truck className="w-4 h-4" />
                Packing
              </Button>
              <Button variant="outline" onClick={() => navigate('/studio/products')} className="h-11 rounded-2xl gap-2 border-white/70 bg-white/80 px-5">
                Cek stok
              </Button>
              <Button variant="outline" onClick={retryOpsHealth} disabled={Boolean(healthChecking)} className="h-11 rounded-2xl gap-2 border-white/70 bg-white/80 px-5">
                <RefreshCw className={`w-4 h-4 ${healthChecking === 'retry' ? 'animate-spin' : ''}`} />
                Retry sync
              </Button>
            </div>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat-label">Payment proof</span>
              <strong>{proofReviewOrders.length}</strong>
            </div>
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat-label">Siap packing</span>
              <strong>{paidReadyOrders.length}</strong>
            </div>
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat-label">Issue total</span>
              <strong>{lowStockProducts.length + voucherIssues.length + syncIssueItems.length}</strong>
            </div>
          </div>
        </div>

        {loadError ? (
          <div className="mb-5">
            <StateBlock
              tone="error"
              title={loading ? 'Retrying dashboard data' : 'Dashboard data needs attention'}
              description={loadError}
              action={loading ? '' : 'Retry dashboard'}
              onAction={loading ? null : loadDashboardData}
              className="bg-rose-50/80 p-5 text-left sm:text-center"
            />
          </div>
        ) : null}

        <DashboardSection title="Action center" subtitle="Urutan ini dibuat untuk kerja harian: cek bukti bayar, packing order paid, amankan stok, rapikan voucher, lalu bersihkan sync issue.">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            {actionCenterItems.map((item) => {
              const Icon = item.icon;
              return (
                <section key={item.key} className={`rounded-2xl border p-4 shadow-sm ${item.tone}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/85">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-2xl bg-white/85 px-3 py-1 text-xl font-bold text-[#0b130c]">{item.count}</span>
                  </div>
                  <h2 className="mt-4 text-base font-bold text-[#0b130c]">{item.label}</h2>
                  <p className="mt-1 min-h-[40px] text-xs font-semibold leading-relaxed opacity-80">{item.helper}</p>
                  <div className="mt-3 grid gap-2">
                    {item.rows.map((row) => (
                      <button key={row.id} type="button" onClick={row.onClick} className="rounded-2xl bg-white/85 px-3 py-2 text-left transition hover:bg-white">
                        <div className="truncate text-xs font-bold text-[#0b130c]">{row.title}</div>
                        <div className="mt-0.5 truncate text-[11px] font-semibold opacity-75">{row.helper}</div>
                      </button>
                    ))}
                    {!item.rows.length ? (
                      <div className="rounded-2xl bg-white/70 px-3 py-2 text-xs font-semibold opacity-75">{item.empty}</div>
                    ) : null}
                  </div>
                  <Button type="button" variant="outline" className="mt-3 h-10 w-full rounded-2xl bg-white/90 text-xs font-bold" onClick={item.onClick} disabled={item.key === 'sync' && Boolean(healthChecking)}>
                    {item.key === 'sync' && healthChecking === 'retry' ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                    {item.action}
                  </Button>
                </section>
              );
            })}
          </div>
        </DashboardSection>

        <DashboardSection title="Workspace areas" subtitle="Dashboard dibagi dua area besar: Studio untuk proses perfumery, E-commerce untuk toko dan order.">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="rounded-2xl border border-white/70 bg-white/86 p-5 shadow-sm">
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

            <section className="rounded-2xl border border-white/70 bg-white/86 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase text-blue-700">
                    <Beaker className="h-4 w-4" />
                    Studio
                  </div>
                  <h2 className="mt-4 text-xl font-bold">Formula, material, dan validasi</h2>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                    Area kerja inti perfumery untuk library material, composer, costing, dan validation follow-up.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#fbfaf7] px-4 py-3 text-right">
                  <div className="text-xs font-bold uppercase text-muted-foreground">Action logs</div>
                  <div className="text-2xl font-bold">{actionNeededLogs.length}</div>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Button variant="outline" className="h-12 rounded-2xl justify-start gap-2 bg-white" onClick={() => navigate('/formulas')}>
                  <Beaker className="h-4 w-4" />
                  Formulas
                </Button>
                <Button variant="outline" className="h-12 rounded-2xl justify-start gap-2 bg-white" onClick={() => navigate('/raw-materials')}>
                  <Package className="h-4 w-4" />
                  Materials
                </Button>
                <Button variant="outline" className="h-12 rounded-2xl justify-start gap-2 bg-white" onClick={() => navigate('/validation')}>
                  <NotebookPen className="h-4 w-4" />
                  Validation
                </Button>
              </div>
            </section>
          </div>
        </DashboardSection>

        <DashboardSection title="Admin ops metrics" subtitle="Angka praktis untuk follow-up order, packing, payment expiry, stock, dan aging shipment.">
          <div className="grid gap-4 lg:grid-cols-6">
            {[
              ['Pending revenue', formatTotal(pendingRevenue), 'Payment unpaid/pending', 'text-amber-700 bg-amber-50'],
              ['Proof review', proofReviewOrders.length, 'Bukti transfer submitted', 'text-sky-700 bg-sky-50'],
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
            <section className={`rounded-2xl border p-5 shadow-sm ${opsHealth.hasCriticalIssues ? 'border-rose-200 bg-rose-50' : 'border-emerald-100 bg-emerald-50'}`}>
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

            <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
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
              onItemClick={() => navigate('/validation', {
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

