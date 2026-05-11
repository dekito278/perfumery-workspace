import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Beaker, Calculator, ClipboardCheck, ClipboardList, Factory, FileCheck2, LibraryBig, MessageCircle, NotebookPen, PackageCheck, PackageOpen, PackagePlus, Sparkles, Truck, UsersRound, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileLoadingSkeleton from '@/components/mobile-ui/MobileLoadingSkeleton.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import SummaryMetricCardMobile from '@/components/mobile/SummaryMetricCardMobile.jsx';
import ActivityCardMobile from '@/components/mobile/ActivityCardMobile.jsx';
import FormulaCardMobile from '@/components/mobile/FormulaCardMobile.jsx';
import BriefCardMobile from '@/components/mobile/BriefCardMobile.jsx';
import DeleteConfirmationDialog from '@/components/mobile-ui/DeleteConfirmationDialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import { useOrders } from '@/hooks/useOrders.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { getDisplayName, MOBILE_ACTIVITY_LIMIT, sortByUpdated } from '@/pages/mobile/mobilePageUtils.js';
import { getProductLowStock } from '@/services/productCatalogService.js';

const hasGuidanceCoverage = (material) => (
  Boolean(
    material?.workbook_code
    || material?.reference_abc_primary_family
    || material?.reference_impact !== null && material?.reference_impact !== undefined
    || material?.reference_life_hours !== null && material?.reference_life_hours !== undefined
    || material?.ifra_limit !== null && material?.ifra_limit !== undefined
  )
);

const runWithTimeout = (loader, label, timeoutMs = 6000) => Promise.race([
  loader(),
  new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
  }),
]);

const runWithFallback = async (loader, label, fallbackValue, timeoutMs = 3500) => {
  try {
    return await runWithTimeout(loader, label, timeoutMs);
  } catch (error) {
    console.warn(`${label} delayed on studio dashboard:`, error.message || error);
    return fallbackValue;
  }
};

const WorkflowTile = ({ helper, icon: Icon, label, to, tone = 'amber' }) => {
  const tones = {
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
  };

  return (
    <Link to={to} className="mobile-card flex min-w-0 items-center gap-3.5 p-3.5 text-left">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${tones[tone] || tones.amber}`}>
        {Icon ? <Icon className="h-5 w-5" /> : null}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-bold text-[#1f2937]">{label}</span>
        {helper ? <span className="mt-0.5 block truncate text-[11px] font-semibold text-[#6b7280]">{helper}</span> : null}
      </span>
    </Link>
  );
};

const WorkflowButton = ({ helper, icon: Icon, label, onClick, tone = 'amber' }) => {
  const tones = {
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
  };

  return (
    <button type="button" onClick={onClick} className="mobile-card flex min-w-0 items-center gap-3.5 p-3.5 text-left">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${tones[tone] || tones.amber}`}>
        {Icon ? <Icon className="h-5 w-5" /> : null}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-bold text-[#1f2937]">{label}</span>
        {helper ? <span className="mt-0.5 block truncate text-[11px] font-semibold text-[#6b7280]">{helper}</span> : null}
      </span>
    </button>
  );
};

const StudioChip = ({ label, value, tone = 'amber' }) => {
  const tones = {
    amber: 'bg-amber-50 text-amber-800 border-amber-100',
    blue: 'bg-blue-50 text-blue-800 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    rose: 'bg-rose-50 text-rose-800 border-rose-100',
  };

  return (
    <div className={`min-w-[108px] rounded-2xl border px-3 py-2 ${tones[tone] || tones.amber}`}>
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="mt-1 truncate text-[10px] font-bold uppercase">{label}</div>
    </div>
  );
};

const PriorityCard = ({ icon: Icon, label, title, helper, tone = 'amber', onClick }) => {
  const tones = {
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
  };

  return (
    <button type="button" onClick={onClick} className="mobile-card flex w-full items-center gap-3 p-3 text-left">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tones[tone] || tones.amber}`}>
        {Icon ? <Icon className="h-5 w-5" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase text-[#9ca3af]">{label}</span>
        <span className="mt-0.5 block truncate text-sm font-bold text-[#1f2937]">{title}</span>
        {helper ? <span className="mt-0.5 block truncate text-[11px] font-semibold text-[#6b7280]">{helper}</span> : null}
      </span>
    </button>
  );
};

const MobileDashboardPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { fetchMaterialsSummary } = useRawMaterials();
  const { getFormulas, duplicateFormula, deleteFormula } = useFormulas();
  const { getBriefs } = useBriefs();
  const { getValidationLogs } = useValidationLogs();
  const { orders } = useOrders();
  const catalogProducts = useCatalogProducts();
  const [materials, setMaterials] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [briefs, setBriefs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadedSections, setLoadedSections] = useState({
    briefs: false,
    formulas: false,
    logs: false,
    materials: false,
  });
  const [metrics, setMetrics] = useState({});
  const [pipeline, setPipeline] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState('');
  const [productMenuOpen, setProductMenuOpen] = useState(false);

  const loadData = async (isActive = () => true) => {
    setSyncing(true);
    if (!formulas.length && !briefs.length) {
      setLoading(true);
    }
    try {
      const [formulaRows, briefRows] = await Promise.all([
        runWithFallback(getFormulas, 'Formulas', formulas, 3000),
        runWithFallback(getBriefs, 'Briefs', briefs, 3000),
      ]);

      if (!isActive()) return;
      const briefsByFormulaId = (briefRows || []).reduce((map, brief) => {
        if (brief.formula_id) map.set(brief.formula_id, (map.get(brief.formula_id) || 0) + 1);
        return map;
      }, new Map());
      setFormulas(formulaRows || []);
      setBriefs(briefRows || []);
      setLoadedSections((current) => ({
        ...current,
        briefs: true,
        formulas: true,
      }));
      setMetrics({});
      setPipeline(Object.fromEntries((formulaRows || []).map((formula) => [formula.id, {
        briefCount: briefsByFormulaId.get(formula.id) || 0,
        validationCount: 0,
        actionNeededCount: 0,
      }])));
      setLoading(false);

      const [materialRows, logRows] = await Promise.all([
        runWithFallback(fetchMaterialsSummary, 'Materials summary', materials, 4500),
        runWithFallback(getValidationLogs, 'Validation logs', logs, 3500),
      ]);

      if (!isActive()) return;
      const logsByFormulaId = (logRows || []).reduce((map, log) => {
        if (!log.formula_id) return map;
        const current = map.get(log.formula_id) || { validationCount: 0, actionNeededCount: 0 };
        current.validationCount += 1;
        if (log.status === 'action_needed') current.actionNeededCount += 1;
        map.set(log.formula_id, current);
        return map;
      }, new Map());

      setMaterials(materialRows || []);
      setLogs(logRows || []);
      setLoadedSections((current) => ({
        ...current,
        logs: true,
        materials: true,
      }));
      setPipeline(Object.fromEntries((formulaRows || []).map((formula) => [formula.id, {
        briefCount: briefsByFormulaId.get(formula.id) || 0,
        ...(logsByFormulaId.get(formula.id) || { validationCount: 0, actionNeededCount: 0 }),
      }])));
    } catch (error) {
      toast.error('Failed to load mobile dashboard');
    } finally {
      if (isActive()) setLoading(false);
      if (isActive()) setSyncing(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadData(() => active);
    return () => { active = false; };
  }, [fetchMaterialsSummary, getBriefs, getFormulas, getValidationLogs]);

  const activeBriefs = useMemo(() => briefs.filter((brief) => ['draft', 'active'].includes(brief.status || 'draft')), [briefs]);
  const draftFormulas = useMemo(() => sortByUpdated(formulas.filter((formula) => (formula.status || 'draft') === 'draft')).slice(0, MOBILE_ACTIVITY_LIMIT), [formulas]);
  const recentBriefs = useMemo(() => sortByUpdated(briefs).slice(0, MOBILE_ACTIVITY_LIMIT), [briefs]);
  const formulasById = useMemo(() => new Map(formulas.map((formula) => [formula.id, formula])), [formulas]);
  const actionNeededLogs = useMemo(() => logs.filter((log) => log.status === 'action_needed'), [logs]);
  const missingGuidanceMaterials = useMemo(() => materials.filter((material) => !hasGuidanceCoverage(material)), [materials]);
  const lowStockProducts = useMemo(() => catalogProducts.filter(getProductLowStock), [catalogProducts]);
  const paidReadyOrders = useMemo(() => orders.filter((order) => order.paymentStatus === 'paid' && !['shipped', 'delivered'].includes(order.shipmentStatus) && !['completed', 'cancelled'].includes(order.status)), [orders]);
  const proofReviewOrders = useMemo(() => orders.filter((order) => order.paymentProofStatus === 'submitted' && !['completed', 'cancelled'].includes(order.status)), [orders]);
  const paymentFollowUps = useMemo(() => orders.filter((order) => ['unpaid', 'pending'].includes(order.paymentStatus)), [orders]);
  const shippedFollowUps = useMemo(() => orders.filter((order) => order.shipmentStatus === 'shipped' && !['completed', 'cancelled'].includes(order.status)), [orders]);
  const guidanceGapPreview = useMemo(() => sortByUpdated(missingGuidanceMaterials).slice(0, 3), [missingGuidanceMaterials]);
  const recentActivity = useMemo(() => sortByUpdated([
    ...formulas.map((formula) => ({ id: `formula-${formula.id}`, title: formula.name, meta: 'Formula updated', date: formula.updated || formula.created, path: `/mobile/formulas/${formula.id}` })),
    ...briefs.map((brief) => ({ id: `brief-${brief.id}`, title: brief.title, meta: 'Brief updated', date: brief.updated || brief.created, path: `/mobile/briefs/${brief.id}` })),
    ...logs.map((log) => ({
      id: `validation-${log.id}`,
      title: formulasById.get(log.formula_id)?.name || 'Validation log',
      meta: `Validation ${(log.status || 'logged').replace(/_/g, ' ')}`,
      date: log.tested_at || log.updated || log.created,
      path: log.formula_id ? `/mobile/formulas/${log.formula_id}` : '/mobile/validation',
    })),
  ]).slice(0, MOBILE_ACTIVITY_LIMIT), [briefs, formulas, formulasById, logs]);

  const handleDuplicate = async (formula) => {
    setDuplicatingId(formula.id);
    try {
      await duplicateFormula(formula.id);
      toast.success('Formula duplicated');
      await loadData();
    } catch (error) {
      toast.error('Failed to duplicate formula');
    } finally {
      setDuplicatingId('');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFormula(deleteTarget.id);
      toast.success('Formula deleted');
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      toast.error(error.message || 'Failed to delete formula');
    } finally {
      setDeleting(false);
    }
  };

  const attentionCount = actionNeededLogs.length + missingGuidanceMaterials.length;

  return (
    <MobileAuthenticatedLayout showFab>
      <Helmet><title>Studio - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title="Studio" subtitle={getDisplayName(currentUser)} eyebrow="Solivagant" action={<Sparkles className="h-5 w-5 text-amber-600" />} />
        <section className="mobile-studio-hero p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase text-amber-700">Workspace</div>
              <h1 className="mt-1 text-2xl font-bold leading-tight text-[#142116]">
                {syncing && !formulas.length && !briefs.length ? 'Syncing studio' : attentionCount ? 'Ada yang perlu dicek' : 'Studio ready'}
              </h1>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#68736a]">
                {getDisplayName(currentUser)} / {syncing ? 'data sedang disegarkan' : `${activeBriefs.length} brief aktif, ${draftFormulas.length} draft formula`}
              </p>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-amber-700 shadow-sm">
              <Sparkles className="h-5 w-5" />
            </span>
          </div>
          <div className="mobile-horizontal-scroll mt-4 flex gap-2 overflow-x-auto pb-1">
            <StudioChip label="Validations" value={loadedSections.logs ? logs.length : '-'} tone="amber" />
            <StudioChip label="Formulas" value={loadedSections.formulas ? formulas.length : '-'} tone="emerald" />
            <StudioChip label="Materials" value={loadedSections.materials ? materials.length : '-'} tone="blue" />
            <StudioChip label="Needs action" value={loadedSections.logs && loadedSections.materials ? attentionCount : '-'} tone="rose" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button className="rounded-2xl" onClick={() => navigate('/mobile/studio/products')}>Products</Button>
            <Button variant="outline" className="rounded-2xl bg-white" onClick={() => navigate('/mobile/studio/fulfillment')}>Fulfillment</Button>
          </div>
        </section>

        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Today priority</h2>
              <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => navigate('/mobile/studio/orders')}>Orders</Button>
            </div>
            <div className="grid gap-3">
              <PriorityCard
                icon={FileCheck2}
                label="Bukti transfer"
                title={`${proofReviewOrders.length} bukti perlu dicek`}
                helper="Approve atau reject dari detail order"
                tone={proofReviewOrders.length ? 'amber' : 'emerald'}
                onClick={() => navigate('/mobile/studio/orders?filter=proof_review')}
              />
              <PriorityCard
                icon={Truck}
                label="Paid-ready"
                title={`${paidReadyOrders.length} order siap packing`}
                helper="Input resi dan mark shipped"
                tone={paidReadyOrders.length ? 'emerald' : 'amber'}
                onClick={() => navigate('/mobile/studio/fulfillment')}
              />
              <PriorityCard
                icon={MessageCircle}
                label="Follow-up"
                title={`${paymentFollowUps.length} payment pending`}
                helper={`${shippedFollowUps.length} shipped perlu dicek delivery`}
                tone={paymentFollowUps.length || shippedFollowUps.length ? 'amber' : 'emerald'}
                onClick={() => navigate('/mobile/studio/orders')}
              />
              <PriorityCard
                icon={AlertTriangle}
                label="Low stock"
                title={`${lowStockProducts.length} product hampir habis`}
                helper="Cek varian dan publish status"
                tone={lowStockProducts.length ? 'rose' : 'emerald'}
                onClick={() => navigate('/mobile/studio/products?view=list')}
              />
            </div>
          </section>

          <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Priority</h2>
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => navigate('/mobile/studio/orders')}>Open queue</Button>
              </div>
              <div className="grid gap-3">
                <PriorityCard
                  icon={PackageOpen}
                  label="Commerce"
                  title="Fulfillment queue"
                  helper="Paid orders ready to pack"
                  tone="amber"
                  onClick={() => navigate('/mobile/studio/fulfillment')}
                />
                <PriorityCard
                  icon={AlertTriangle}
                  label="Attention"
                  title={attentionCount ? `${attentionCount} item perlu dicek` : 'Tidak ada blocker utama'}
                  helper={actionNeededLogs.length ? 'Validation follow-up tersedia' : missingGuidanceMaterials.length ? 'Raw material guidance belum lengkap' : 'Guidance dan validation aman'}
                  tone={attentionCount ? 'rose' : 'emerald'}
                  onClick={() => navigate(actionNeededLogs.length ? '/mobile/validation' : '/mobile/raw-materials')}
                />
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <SummaryMetricCardMobile icon={ClipboardList} label="Active Briefs" value={loadedSections.briefs ? activeBriefs.length : '-'} to="/mobile/briefs" />
              <SummaryMetricCardMobile icon={Beaker} label="Formulas" value={loadedSections.formulas ? formulas.length : '-'} tone="blue" to="/mobile/formulas" />
              <SummaryMetricCardMobile icon={LibraryBig} label="Materials" value={loadedSections.materials ? materials.length : '-'} tone="green" to="/mobile/raw-materials" />
              <SummaryMetricCardMobile icon={ClipboardCheck} label="Validations" value={loadedSections.logs ? logs.length : '-'} tone="rose" to="/mobile/validation" />
              <div className="col-span-2">
                <SummaryMetricCardMobile icon={AlertTriangle} label="Guidance Gaps" value={loadedSections.materials ? missingGuidanceMaterials.length : '-'} tone="rose" to="/mobile/raw-materials" />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">E-commerce</h2>
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => navigate('/mobile/dashboard')}>Lihat home</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <WorkflowButton icon={PackagePlus} label="Products" helper="Tambah, daftar, kategori" tone="emerald" onClick={() => setProductMenuOpen(true)} />
                <WorkflowTile icon={PackageCheck} label="Orders" helper="Payment & fulfillment" tone="amber" to="/mobile/studio/orders" />
                <WorkflowTile icon={PackageOpen} label="Fulfillment" helper="Packing & shipping" tone="emerald" to="/mobile/studio/fulfillment" />
                <WorkflowTile icon={UsersRound} label="Customers" helper="Codes & repeat orders" tone="blue" to="/mobile/studio/customers" />
                <WorkflowTile icon={WandSparkles} label="Bespoke" helper="Bottle, cap, label" tone="rose" to="/mobile/studio/bespoke" />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Studio ops</h2>
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => navigate('/mobile/production-costing')}>Costing</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <WorkflowTile icon={Beaker} label="Formula" helper="Create or revise" tone="blue" to="/mobile/formulas" />
                <WorkflowTile icon={ClipboardList} label="Briefs" helper="Project direction" tone="amber" to="/mobile/briefs" />
                <WorkflowTile icon={Calculator} label="Batch" helper="Scale grams" to="/mobile/batches" />
                <WorkflowTile icon={Factory} label="Costing" helper="Bottle & bulk" tone="emerald" to="/mobile/production-costing" />
                <WorkflowTile icon={NotebookPen} label="Validation" helper={`${actionNeededLogs.length} action`} tone="rose" to="/mobile/validation" />
              </div>
            </section>

            {loading ? <MobileLoadingSkeleton count={2} /> : null}

            <section className="mobile-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Pipeline</h2>
                <span className="text-xs font-bold text-amber-700">{actionNeededLogs.length} action</span>
              </div>
              <div className="mt-4 grid gap-3">
                {[
                  ['Active briefs', activeBriefs.length, Math.max(briefs.length, 1)],
                  ['Draft formulas', draftFormulas.length, Math.max(formulas.length, 1)],
                  ['Action-needed validation', actionNeededLogs.length, Math.max(logs.length, 1)],
                ].map(([label, value, total]) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs font-bold text-[#6b7280]"><span>{label}</span><span>{value}</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f3f4f6]"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min((value / total) * 100, 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>

            {actionNeededLogs.length || guidanceGapPreview.length ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold">Needs attention</h2>
                  <span className="text-xs font-bold text-amber-700">{actionNeededLogs.length + guidanceGapPreview.length} items</span>
                </div>
                {actionNeededLogs.slice(0, 2).map((log) => (
                  <ActivityCardMobile
                    key={`attention-validation-${log.id}`}
                    title={formulasById.get(log.formula_id)?.name || 'Validation follow-up'}
                    meta={`Validation action · ${log.test_type || 'revision'}`}
                    date={log.tested_at || log.updated || log.created}
                    onClick={() => navigate('/mobile/validation')}
                  />
                ))}
                {guidanceGapPreview.map((material) => (
                  <ActivityCardMobile
                    key={`attention-material-${material.id}`}
                    title={material.name}
                    meta="Missing raw material guidance"
                    date={material.updated || material.created}
                    onClick={() => navigate(`/mobile/raw-material/${material.id}`)}
                  />
                ))}
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="flex items-center justify-between"><h2 className="text-base font-bold">Draft formulas</h2><Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => navigate('/mobile/formulas')}>View all</Button></div>
              {draftFormulas.slice(0, 2).map((formula) => (
                <FormulaCardMobile
                  key={formula.id}
                  formula={formula}
                  metrics={metrics[formula.id]}
                  pipeline={pipeline[formula.id]}
                  duplicating={duplicatingId === formula.id}
                  onView={() => navigate(`/mobile/formulas/${formula.id}`)}
                  onDuplicate={() => handleDuplicate(formula)}
                  onEdit={() => navigate(`/mobile/formulas/${formula.id}/edit`)}
                  onDelete={() => setDeleteTarget(formula)}
                />
              ))}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between"><h2 className="text-base font-bold">Brief updates</h2><Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => navigate('/mobile/briefs')}>View all</Button></div>
              {recentBriefs.slice(0, 2).map((brief) => (
                <BriefCardMobile key={brief.id} brief={brief} linkedFormula={formulasById.get(brief.formula_id)} onOpen={() => navigate(`/mobile/briefs/${brief.id}`)} />
              ))}
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold">Recent activity</h2>
              {recentActivity.map((item) => (
                <ActivityCardMobile key={item.id} title={item.title} meta={item.meta} date={item.date} onClick={() => navigate(item.path)} />
              ))}
            </section>
        </>
      </main>
      <MobileBottomSheet
        open={productMenuOpen}
        onOpenChange={setProductMenuOpen}
        title="Products"
        description="Pilih area produk yang mau dikelola."
      >
        <div className="grid gap-3 pb-2">
          {[
            { label: 'Tambah produk baru', helper: 'Form produk, varian, gambar', path: '/mobile/studio/products?view=new', icon: PackagePlus },
            { label: 'Daftar produk', helper: 'Edit dan hapus produk katalog', path: '/mobile/studio/products?view=list', icon: PackageCheck },
            { label: 'Kategori produk', helper: 'Kelola family/kategori shop', path: '/mobile/studio/products?view=categories', icon: LibraryBig },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  setProductMenuOpen(false);
                  navigate(item.path);
                }}
                className="mobile-card flex items-center gap-3 p-3 text-left"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-[#1f2937]">{item.label}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-[#6b7280]">{item.helper}</span>
                </span>
              </button>
            );
          })}
        </div>
      </MobileBottomSheet>
      <DeleteConfirmationDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} itemName={deleteTarget?.name} onConfirm={handleDelete} loading={deleting} />
    </MobileAuthenticatedLayout>
  );
};

export default MobileDashboardPage;

