import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Beaker, Calculator, ClipboardCheck, ClipboardList, Factory, LibraryBig, NotebookPen, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileLoadingSkeleton from '@/components/mobile-ui/MobileLoadingSkeleton.jsx';
import SummaryMetricCardMobile from '@/components/mobile/SummaryMetricCardMobile.jsx';
import ActivityCardMobile from '@/components/mobile/ActivityCardMobile.jsx';
import FormulaCardMobile from '@/components/mobile/FormulaCardMobile.jsx';
import BriefCardMobile from '@/components/mobile/BriefCardMobile.jsx';
import DeleteConfirmationDialog from '@/components/mobile-ui/DeleteConfirmationDialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import { getReferenceMatchStatusMap } from '@/services/materialReferenceService.js';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import {
  buildFormulaReferenceLinksMap,
  buildMobileFormulaMetrics,
} from '@/utils/mobileFormulaMetrics.js';
import { getDisplayName, MOBILE_ACTIVITY_LIMIT, sortByUpdated } from '@/pages/mobile/mobilePageUtils.js';

const hasGuidanceCoverage = (material) => (
  Boolean(
    material?.workbook_code
    || material?.reference_abc_primary_family
    || material?.reference_impact !== null && material?.reference_impact !== undefined
    || material?.reference_life_hours !== null && material?.reference_life_hours !== undefined
    || material?.ifra_limit !== null && material?.ifra_limit !== undefined
  )
);

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

const MobileDashboardPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { fetchMaterialsSummary } = useRawMaterials();
  const { getFormulas, duplicateFormula, deleteFormula } = useFormulas();
  const { getFormulaItems } = useFormulaItems();
  const { getBriefs } = useBriefs();
  const { getValidationLogs } = useValidationLogs();
  const [materials, setMaterials] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [briefs, setBriefs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [pipeline, setPipeline] = useState({});
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState('');

  const loadData = async (isActive = () => true) => {
    setLoading(true);
    try {
      const [materialRows, formulaRows, briefRows, logRows] = await Promise.all([
        fetchMaterialsSummary(),
        getFormulas(),
        getBriefs(),
        getValidationLogs(),
      ]);
      const formulaItemEntries = await Promise.all((formulaRows || []).map(async (formula) => {
        const items = await getFormulaItems(formula.id);
        return [formula.id, items || []];
      }));
      const allItems = formulaItemEntries.flatMap(([, formulaItems]) => formulaItems || []);
      const materialIds = [...new Set(allItems.map((item) => item.item_id).filter(Boolean))];
      const [rawMaterialRows, referenceStatusMap] = await Promise.all([
        getRawMaterialOptions(),
        getReferenceMatchStatusMap(materialIds),
      ]);
      if (!isActive()) return;
      const rawMaterialsById = new Map((rawMaterialRows || []).map((material) => [material.id, material]));
      const metricEntries = formulaItemEntries.map(([formulaId, formulaItems]) => [
        formulaId,
        buildMobileFormulaMetrics({
          items: formulaItems,
          rawMaterialsById,
          referenceLinksMap: buildFormulaReferenceLinksMap(formulaItems, referenceStatusMap),
        }),
      ]);
      const briefsByFormulaId = (briefRows || []).reduce((map, brief) => {
        if (brief.formula_id) map.set(brief.formula_id, (map.get(brief.formula_id) || 0) + 1);
        return map;
      }, new Map());
      const logsByFormulaId = (logRows || []).reduce((map, log) => {
        if (!log.formula_id) return map;
        const current = map.get(log.formula_id) || { validationCount: 0, actionNeededCount: 0 };
        current.validationCount += 1;
        if (log.status === 'action_needed') current.actionNeededCount += 1;
        map.set(log.formula_id, current);
        return map;
      }, new Map());
      setMaterials(materialRows || []);
      setFormulas(formulaRows || []);
      setBriefs(briefRows || []);
      setLogs(logRows || []);
      setMetrics(Object.fromEntries(metricEntries));
      setPipeline(Object.fromEntries((formulaRows || []).map((formula) => [formula.id, {
        briefCount: briefsByFormulaId.get(formula.id) || 0,
        ...(logsByFormulaId.get(formula.id) || { validationCount: 0, actionNeededCount: 0 }),
      }])));
    } catch (error) {
      toast.error('Failed to load mobile dashboard');
    } finally {
      if (isActive()) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadData(() => active);
    return () => { active = false; };
  }, [fetchMaterialsSummary, getBriefs, getFormulaItems, getFormulas, getValidationLogs]);

  const activeBriefs = useMemo(() => briefs.filter((brief) => ['draft', 'active'].includes(brief.status || 'draft')), [briefs]);
  const draftFormulas = useMemo(() => sortByUpdated(formulas.filter((formula) => (formula.status || 'draft') === 'draft')).slice(0, MOBILE_ACTIVITY_LIMIT), [formulas]);
  const recentBriefs = useMemo(() => sortByUpdated(briefs).slice(0, MOBILE_ACTIVITY_LIMIT), [briefs]);
  const formulasById = useMemo(() => new Map(formulas.map((formula) => [formula.id, formula])), [formulas]);
  const actionNeededLogs = useMemo(() => logs.filter((log) => log.status === 'action_needed'), [logs]);
  const missingGuidanceMaterials = useMemo(() => materials.filter((material) => !hasGuidanceCoverage(material)), [materials]);
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

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>Mobile Dashboard - Perfumer Studio</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title="Home" subtitle={getDisplayName(currentUser)} eyebrow="Perfumer Studio" action={<Sparkles className="h-5 w-5 text-amber-600" />} />
        <section className="mobile-soft-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase text-amber-700">Workspace</div>
              <h2 className="mt-1 truncate text-lg font-bold text-[#1f2937]">{actionNeededLogs.length ? `${actionNeededLogs.length} validation action` : 'Ready'}</h2>
            </div>
            <div className="shrink-0 rounded-2xl bg-white px-3 py-2 text-right text-[11px] font-bold text-[#6b7280]">
              {formulas.length} formulas<br />
              {materials.length} materials
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button className="rounded-2xl" onClick={() => navigate('/mobile/formulas/new')}>New Formula</Button>
            <Button variant="outline" className="rounded-2xl bg-white" onClick={() => navigate('/mobile/briefs/new')}>New Brief</Button>
          </div>
        </section>

        {loading ? <MobileLoadingSkeleton count={4} /> : (
          <>
            <section className="grid grid-cols-2 gap-3">
              <SummaryMetricCardMobile icon={ClipboardList} label="Active Briefs" value={activeBriefs.length} to="/mobile/briefs" />
              <SummaryMetricCardMobile icon={Beaker} label="Formulas" value={formulas.length} tone="blue" to="/mobile/formulas" />
              <SummaryMetricCardMobile icon={LibraryBig} label="Materials" value={materials.length} tone="green" to="/mobile/raw-materials" />
              <SummaryMetricCardMobile icon={ClipboardCheck} label="Validations" value={logs.length} tone="rose" to="/mobile/validation" />
              <div className="col-span-2">
                <SummaryMetricCardMobile icon={AlertTriangle} label="Guidance Gaps" value={missingGuidanceMaterials.length} tone="rose" to="/mobile/raw-materials" />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Workflow</h2>
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => navigate('/mobile/production-costing')}>Costing</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <WorkflowTile icon={Beaker} label="Formula" helper="Create or revise" tone="blue" to="/mobile/formulas" />
                <WorkflowTile icon={NotebookPen} label="Validation" helper={`${actionNeededLogs.length} action`} tone="rose" to="/mobile/validation" />
                <WorkflowTile icon={Calculator} label="Batch" helper="Scale grams" to="/mobile/batches" />
                <WorkflowTile icon={Factory} label="Costing" helper="Bottle & bulk" tone="emerald" to="/mobile/production-costing" />
              </div>
            </section>

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
        )}
      </main>
      <DeleteConfirmationDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} itemName={deleteTarget?.name} onConfirm={handleDelete} loading={deleting} />
    </MobileAuthenticatedLayout>
  );
};

export default MobileDashboardPage;
