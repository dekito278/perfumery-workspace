
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Package, Beaker, Activity, AlertTriangle, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useBatches } from '@/hooks/useBatches.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import DashboardSummaryCard from '@/components/DashboardSummaryCard.jsx';
import DashboardSection from '@/components/DashboardSection.jsx';
import RecentActivityList from '@/components/RecentActivityList.jsx';
import OperationalInsightCard from '@/components/OperationalInsightCard.jsx';
import BatchStatusBadge from '@/components/BatchStatusBadge.jsx';

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

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

const DashboardPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { fetchMaterialsSummary } = useRawMaterials();
  const { getFormulas } = useFormulas();
  const { getBatches } = useBatches();

  const [materials, setMaterials] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        runWithRetry(() => fetchMaterialsSummary()),
        runWithRetry(() => getFormulas()),
        runWithRetry(() => getBatches())
      ]);

      const [materialsResult, formulasResult, batchesResult] = results;
      const failedRequests = results.filter((result) => result.status === 'rejected');

      setMaterials(materialsResult.status === 'fulfilled' ? materialsResult.value : []);
      setFormulas(formulasResult.status === 'fulfilled' ? formulasResult.value : []);
      setBatches(batchesResult.status === 'fulfilled' ? batchesResult.value : []);

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

  const lowStockMaterials = materials.filter(m => {
    const threshold = m.low_stock_threshold || m.minimum_stock;
    return m.stock_quantity < threshold;
  });

  const activeBatches = batches.filter(b => b.status === 'in_progress' || b.status === 'draft');
  const lowStockPreview = lowStockMaterials.slice(0, 5);
  const activeBatchPreview = activeBatches.slice(0, 5);
  const recentFormulas = [...formulas].sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, 5);
  const recentBatches = [...batches].sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, 5);
  const displayName =
    currentUser?.user_metadata?.name?.trim()
    || currentUser?.email?.split('@')[0]
    || 'Dekito';

  const summaryCards = [
    {
      icon: Package,
      label: 'Raw materials',
      count: materials.length,
      color: 'text-amber-600',
      onClick: () => navigate('/raw-materials')
    },
    {
      icon: Beaker,
      label: 'Formulas',
      count: formulas.length,
      color: 'text-primary',
      onClick: () => navigate('/formulas')
    },
    {
      icon: Activity,
      label: 'Active batches',
      count: batches.filter((b) => b.status === 'in_progress' || b.status === 'draft').length,
      color: 'text-blue-600',
      onClick: () => navigate('/batches')
    },
    {
      icon: AlertTriangle,
      label: 'Low stock materials',
      count: lowStockMaterials.length,
      color: 'text-destructive',
      onClick: () => navigate('/raw-materials')
    }
  ];

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Dashboard - Perfumer Studio</title>
        <meta name="description" content="Manage your perfume production workflow with tools for raw materials, formulas, and batches." />
      </Helmet>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <div className="dashboard-hero-eyebrow">
              <Sparkles className="w-4 h-4 text-primary" />
              Halo, {displayName}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>
              Lab hari ini siap dipakai.
            </h1>
            <p className="max-w-3xl text-base text-muted-foreground">
              {formulas.length > 0
                ? `${displayName}, sekarang ada ${formulas.length} formula, ${activeBatches.length} batch aktif, dan ${lowStockMaterials.length} bahan yang perlu dicek.`
                : `${displayName}, belum ada formula hari ini. Mau mulai racik yang baru?`}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => navigate('/formulas')} className="h-11 rounded-2xl gap-2 px-5">
                Open formulas
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={() => navigate('/raw-materials')} className="h-11 rounded-2xl gap-2 border-white/70 bg-white/80 px-5">
                Open inventory
              </Button>
            </div>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat-label">Total formula</span>
              <strong>{formulas.length}</strong>
            </div>
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat-label">Batch aktif</span>
              <strong>{activeBatches.length}</strong>
            </div>
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat-label">Low stock alerts</span>
              <strong>{lowStockMaterials.length}</strong>
            </div>
          </div>
        </div>

        <DashboardSection title="Ringkasan">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <DashboardSection title="Baru-barusan">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentActivityList
              title="Formula terbaru"
              items={recentFormulas}
              columns={[
                {
                  key: 'name',
                  render: (item) => (
                    <span className="text-sm font-medium truncate">{item.name}</span>
                  ),
                  className: 'flex-1'
                },
                {
                  key: 'code',
                  render: (item) => (
                    <span className="text-xs text-muted-foreground font-mono">{item.code}</span>
                  ),
                  className: 'text-right'
                }
              ]}
              emptyMessage="No formulas yet"
              onRowClick={(item) => navigate(`/formulas/${item.id}`)}
              isLoading={loading}
            />

            <RecentActivityList
              title="Batch terbaru"
              items={recentBatches}
              columns={[
                {
                  key: 'batch_code',
                  render: (item) => (
                    <span className="text-sm font-medium font-mono truncate">{item.batch_code}</span>
                  ),
                  className: 'flex-1'
                },
                {
                  key: 'status',
                  render: (item) => (
                    <BatchStatusBadge status={item.status} />
                  ),
                  className: 'text-right'
                }
              ]}
              emptyMessage="No batches yet"
              onRowClick={(item) => navigate(`/batches/${item.id}`)}
              isLoading={loading}
            />
          </div>
        </DashboardSection>

        <DashboardSection title="Perlu dilihat">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OperationalInsightCard
              title="Low stock"
              icon={AlertTriangle}
              items={lowStockPreview.map(m => ({
                id: m.id,
                name: m.name,
                badge: `${m.stock_quantity.toFixed(1)} ${m.unit}`
              }))}
              emptyMessage="All materials are well stocked"
              color="text-destructive"
              badgeVariant="destructive"
              onItemClick={() => navigate('/raw-materials')}
              isLoading={loading}
            />

            <OperationalInsightCard
              title="Batch aktif"
              icon={Activity}
              items={activeBatchPreview.map(b => ({
                id: b.id,
                name: b.batch_code,
                badge: b.status === 'in_progress' ? 'In progress' : 'Draft'
              }))}
              emptyMessage="No active batches"
              color="text-blue-600"
              badgeVariant="default"
              onItemClick={(item) => navigate(`/batches/${item.id}`)}
              isLoading={loading}
            />
          </div>
        </DashboardSection>
      </div>
    </AuthenticatedLayout>
  );
};

export default DashboardPage;
