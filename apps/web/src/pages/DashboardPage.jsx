import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { Package, Beaker, AlertTriangle, Sparkles, ArrowRight, ClipboardCheck, NotebookPen, ClipboardList, Layers3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import { useBriefMaterialShortlists } from '@/hooks/useBriefMaterialShortlists.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import DashboardSummaryCard from '@/components/DashboardSummaryCard.jsx';
import DashboardSection from '@/components/DashboardSection.jsx';
import RecentActivityList from '@/components/RecentActivityList.jsx';
import OperationalInsightCard from '@/components/OperationalInsightCard.jsx';
import { formatStatus } from '@/utils/formatting.js';

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

  const [materials, setMaterials] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [briefs, setBriefs] = useState([]);
  const [validationLogs, setValidationLogs] = useState([]);
  const [pipelineSummary, setPipelineSummary] = useState({ shortlistCount: 0 });
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        runWithRetry(() => fetchMaterialsSummary()),
        runWithRetry(() => getFormulas()),
        runWithRetry(() => getBriefs()),
        runWithRetry(() => getValidationLogs()),
      ]);

      const [materialsResult, formulasResult, briefsResult, validationLogsResult] = results;
      const failedRequests = results.filter((result) => result.status === 'rejected');

      setMaterials(materialsResult.status === 'fulfilled' ? materialsResult.value : []);
      setFormulas(formulasResult.status === 'fulfilled' ? formulasResult.value : []);
      setBriefs(briefsResult.status === 'fulfilled' ? briefsResult.value : []);
      setValidationLogs(validationLogsResult.status === 'fulfilled' ? validationLogsResult.value : []);

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
    || 'Dekito';

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
        <title>Studio - Perfumer Studio</title>
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
              Perfumer Studio siap dipakai.
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
