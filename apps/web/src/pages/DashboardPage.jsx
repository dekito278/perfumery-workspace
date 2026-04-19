
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Package, Beaker, Boxes, Activity, AlertTriangle, Plus, Eye, Sparkles, ArrowRight, Layers3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useBatches } from '@/hooks/useBatches.js';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import DashboardSummaryCard from '@/components/DashboardSummaryCard.jsx';
import DashboardSection from '@/components/DashboardSection.jsx';
import RecentActivityList from '@/components/RecentActivityList.jsx';
import OperationalInsightCard from '@/components/OperationalInsightCard.jsx';
import BatchStatusBadge from '@/components/BatchStatusBadge.jsx';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { fetchMaterials } = useRawMaterials();
  const { getFormulas } = useFormulas();
  const { getBatches } = useBatches();

  const [materials, setMaterials] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [materialsData, formulasData, batchesData] = await Promise.all([
        fetchMaterials(),
        getFormulas(),
        getBatches()
      ]);
      setMaterials(materialsData);
      setFormulas(formulasData);
      setBatches(batchesData);
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
  }).slice(0, 5);

  const activeBatches = batches.filter(b => b.status === 'in_progress' || b.status === 'draft').slice(0, 5);
  const recentFormulas = [...formulas].sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, 5);
  const recentBatches = [...batches].sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, 5);
  const recentMaterials = [...materials].sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, 5);
  const accordFormulaCount = formulas.filter((formula) => formula.category === 'accord').length;
  const perfumeFormulaCount = formulas.filter((formula) => formula.category !== 'accord').length;

  const summaryCards = [
    {
      icon: Package,
      label: 'Total raw materials',
      count: materials.length,
      color: 'text-amber-600',
      onClick: () => navigate('/raw-materials')
    },
    {
      icon: Beaker,
      label: 'Total formulas',
      count: formulas.length,
      color: 'text-primary',
      onClick: () => navigate('/formulas')
    },
    {
      icon: Boxes,
      label: 'Total batches',
      count: batches.length,
      color: 'text-emerald-600',
      onClick: () => navigate('/batches')
    },
    {
      icon: Activity,
      label: 'Active batches',
      count: batches.filter(b => b.status === 'in_progress').length,
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

  const quickActions = [
    { label: 'Add raw material', icon: Plus, onClick: () => navigate('/raw-materials'), variant: 'default' },
    { label: 'Create formula', icon: Plus, onClick: () => navigate('/formulas'), variant: 'default' },
    { label: 'Create batch', icon: Plus, onClick: () => navigate('/batches'), variant: 'default' },
    { label: 'View inventory', icon: Eye, onClick: () => navigate('/raw-materials'), variant: 'outline' },
    { label: 'View formulas', icon: Eye, onClick: () => navigate('/formulas'), variant: 'outline' }
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
              Production overview
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>
              Workspace yang lebih fokus, lebih cepat dipindai, dan tanpa menu Accord terpisah.
            </h1>
            <p className="max-w-3xl text-base text-muted-foreground">
              Semua alur sekarang berpusat di formulas, raw materials, batches, dan production costing. Formula kategori accord tetap ada, tapi sudah menyatu dalam workflow utama.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => navigate('/formulas')} className="h-11 rounded-2xl gap-2 px-5">
                Open formulas
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={() => navigate('/raw-materials')} className="h-11 rounded-2xl gap-2 border-white/70 bg-white/80 px-5">
                View inventory
              </Button>
            </div>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat-label">Perfume formulas</span>
              <strong>{perfumeFormulaCount}</strong>
            </div>
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat-label">Accord formulas</span>
              <strong>{accordFormulaCount}</strong>
            </div>
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat-label">Low stock alerts</span>
              <strong>{lowStockMaterials.length}</strong>
            </div>
          </div>
        </div>

        <DashboardSection title="Summary" subtitle="Key metrics at a glance">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        <DashboardSection title="Quick actions" subtitle="Common tasks and shortcuts">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant={action.variant}
                  onClick={action.onClick}
                  className="h-auto min-h-[88px] flex-col items-start justify-between rounded-[24px] px-4 py-4 text-left shadow-sm sm:flex-row sm:items-center"
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs sm:text-sm">{action.label}</span>
                </Button>
              );
            })}
          </div>
        </DashboardSection>

        <DashboardSection title="Formula pulse" subtitle="Distribusi formula utama di workspace saat ini">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_-42px_rgba(125,86,13,0.35)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Layers3 className="w-4 h-4 text-primary" />
                    Formula categories
                  </div>
                  <h3 className="mt-3 text-xl font-semibold">Semua formula sekarang berada dalam satu workspace.</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Accord tidak lagi tampil sebagai fitur terpisah. Gunakan kategori formula untuk membedakan formula parfum penuh dan formula accord.
                  </p>
                </div>
                <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
                  Unified
                </Badge>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Perfume</p>
                <p className="mt-3 text-3xl font-bold">{perfumeFormulaCount}</p>
              </div>
              <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Accord</p>
                <p className="mt-3 text-3xl font-bold">{accordFormulaCount}</p>
              </div>
            </div>
          </div>
        </DashboardSection>

        <DashboardSection title="Recent activity" subtitle="Latest additions and updates">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <RecentActivityList
              title="Recently added formulas"
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
              title="Recently created batches"
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

            <RecentActivityList
              title="Recently added materials"
              items={recentMaterials}
              columns={[
                {
                  key: 'name',
                  render: (item) => (
                    <span className="text-sm font-medium truncate">{item.name}</span>
                  ),
                  className: 'flex-1'
                },
                {
                  key: 'type',
                  render: (item) => (
                    <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
                  ),
                  className: 'text-right'
                }
              ]}
              emptyMessage="No materials yet"
              onRowClick={() => navigate('/raw-materials')}
              isLoading={loading}
            />
          </div>
        </DashboardSection>

        <DashboardSection title="Operational insights" subtitle="Alerts and items requiring attention">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OperationalInsightCard
              title="Low stock alert"
              icon={AlertTriangle}
              items={lowStockMaterials.map(m => ({
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
              title="Batches in progress"
              icon={Activity}
              items={activeBatches.map(b => ({
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
