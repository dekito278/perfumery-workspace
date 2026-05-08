import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Calculator, Copy, Download, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import DeleteConfirmationDialog from '@/components/mobile-ui/DeleteConfirmationDialog.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import PaceAnalysisCard from '@/components/mobile/PaceAnalysisCard.jsx';
import { CompactWorkbookPreview } from '@/components/mobile/MobileFormulaComposerWorkspace.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useFormulaDetailPage } from '@/hooks/useFormulaDetailPage.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { formatDate, formatGramAmount, formatStatus } from '@/utils/formatting.js';
import { formatPrice } from '@/utils/pricingUtils.js';
import { buildMobileFormulaMetrics } from '@/utils/mobileFormulaMetrics.js';
import { MOBILE_ACTIVITY_LIMIT } from '@/pages/mobile/mobilePageUtils.js';
import { buildFormulaSensoryCharts } from '@/utils/formulaSensoryCharts.js';

const tabs = [
  { value: 'summary', label: 'Summary' },
  { value: 'composition', label: 'Composition' },
  { value: 'workbook', label: 'Workbook' },
  { value: 'activity', label: 'Activity' },
];

const formatPercent = (value, digits = 1) => `${Number(value || 0).toFixed(digits)}%`;
const formatScore = (value) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : '-';

const MetricTile = ({ label, value, helper }) => (
  <div className="rounded-xl bg-[#f8f7f4] p-3">
    <div className="text-[10px] font-bold uppercase text-[#9ca3af]">{label}</div>
    <div className="mt-1 text-sm font-bold text-[#1f2937]">{value}</div>
    {helper ? <div className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">{helper}</div> : null}
  </div>
);

const MiniBarRows = ({ rows = [], labelKey = 'label', valueKey = 'value', empty = 'No chart data' }) => {
  const visibleRows = rows.filter((row) => Number(row?.[valueKey] || row?.percent || 0) > 0).slice(0, 6);
  if (!visibleRows.length) {
    return <div className="rounded-xl bg-[#f8f7f4] p-3 text-xs font-semibold text-[#6b7280]">{empty}</div>;
  }

  return (
    <div className="space-y-2">
      {visibleRows.map((row) => {
        const value = Number(row[valueKey] ?? row.percent ?? 0);
        const label = row[labelKey] || row.family || row.facet || row.label || '-';
        return (
          <div key={`${label}-${value}`} className="grid grid-cols-[74px_1fr_38px] items-center gap-2 text-[11px] font-semibold">
            <span className="truncate text-[#374151]">{label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-[#ece8df]">
              <span className="block h-full rounded-full bg-amber-500" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
            </span>
            <span className="text-right text-[#6b7280]">{Math.round(value)}</span>
          </div>
        );
      })}
    </div>
  );
};

const MobileFormulaDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('summary');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { deleteFormula, duplicateFormula } = useFormulas();
  const detail = useFormulaDetailPage(id);
  const {
    formula,
    handleExportPdf,
    items,
    linkedBriefs,
    loading,
    rawMaterialsById,
    totalCost,
    totalGrams,
    totalPercentage,
    validationLogs,
    itemReferenceLinksMap,
    workbookSimulation,
  } = detail;

  const compositionRows = useMemo(() => {
    const safeTotalGrams = Number(totalGrams || 0);
    return (items || []).map((item) => ({
      ...item,
      displayPercentage: safeTotalGrams > 0
        ? (Number(item.grams ?? item.gram_amount ?? 0) / safeTotalGrams) * 100
        : Number(item.percentage || 0),
    }));
  }, [items, totalGrams]);
  const formulaMetrics = useMemo(() => buildMobileFormulaMetrics({
    items,
    rawMaterialsById,
    referenceLinksMap: itemReferenceLinksMap,
  }), [items, itemReferenceLinksMap, rawMaterialsById]);
  const sensoryCharts = useMemo(() => buildFormulaSensoryCharts({
    items,
    rawMaterialsById,
    referenceLinksMap: itemReferenceLinksMap,
  }), [items, itemReferenceLinksMap, rawMaterialsById]);
  const paceWarnings = useMemo(() => (
    (workbookSimulation?.performanceWarnings || [])
      .map((warning) => warning.message || warning.title)
      .filter(Boolean)
  ), [workbookSimulation]);
  const paceRecommendations = useMemo(() => {
    const weakestAxis = workbookSimulation?.pace?.weakestAxis;
    if (!weakestAxis?.label) return [];
    return [`Improve ${String(weakestAxis.label).toLowerCase()} (${Math.round(Number(weakestAxis.value) || 0)}).`];
  }, [workbookSimulation]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteFormula(id);
      toast.success('Formula deleted');
      navigate('/mobile/formulas');
    } catch (error) {
      toast.error(error.message || 'Failed to delete formula');
      setDeleting(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      await duplicateFormula(id);
      toast.success('Formula duplicated');
      navigate('/mobile/formulas');
    } catch (error) {
      toast.error('Failed to duplicate formula');
    }
  };

  if (loading || !formula) {
    return <MobileAuthenticatedLayout><MobileLoadingState eyebrow="Formula" title="Loading formula..." subtitle="Preparing workbook and composition data." /></MobileAuthenticatedLayout>;
  }

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>{formula.name} - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title={formula.name} subtitle={`${formula.code} / ${formatStatus(formula.category || 'perfume')}`} onBack={() => navigate('/mobile/formulas')} action={<MobileStatusBadge status={formula.status || 'draft'} />} />
        <MobileSegmentedControl options={tabs} value={tab} onChange={setTab} />
        {tab === 'summary' ? (
          <section className="space-y-3">
            <div className="mobile-soft-card p-4">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-[10px] font-bold uppercase text-amber-700">Size</div><div className="mt-1 text-lg font-bold">{formatGramAmount(totalGrams)}</div></div>
                <div><div className="text-[10px] font-bold uppercase text-amber-700">Cost</div><div className="mt-1 text-lg font-bold">{formatPrice(totalCost)}</div></div>
                <div><div className="text-[10px] font-bold uppercase text-amber-700">Impact</div><div className="mt-1 text-lg font-bold">{formulaMetrics.impactDisplay}</div></div>
                <div><div className="text-[10px] font-bold uppercase text-amber-700">Lifetime</div><div className="mt-1 text-lg font-bold">{formulaMetrics.lifetimeDisplay}</div></div>
              </div>
            </div>
            {[
              ['Version', formula.version || '-'],
              ['Linked brief', linkedBriefs?.[0]?.title || 'Standalone formula'],
              ['Last updated', formatDate(formula.updated || formula.created)],
              ['Notes', formula.notes || '-'],
            ].map(([label, value]) => <div key={label} className="mobile-card p-4"><div className="text-xs font-bold uppercase text-[#9ca3af]">{label}</div><div className="mt-1 text-sm font-semibold text-[#1f2937]">{value}</div></div>)}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11 rounded-2xl bg-white text-xs font-bold" onClick={handleExportPdf}><Download className="mr-1 h-4 w-4" />Formula PDF</Button>
              <Button variant="outline" className="h-11 rounded-2xl bg-white text-xs font-bold" onClick={() => navigate(`/mobile/batches?formulaId=${id}`)}><Calculator className="mr-1 h-4 w-4" />Batch</Button>
            </div>
          </section>
        ) : null}
        {tab === 'composition' ? (
          compositionRows.length ? (
            <section className="space-y-3">
              <div className="mobile-soft-card p-4">
                <div className="text-xs font-bold uppercase text-amber-700">Total percentage</div>
                <div className="mt-1 text-xl font-bold">{totalGrams > 0 ? '100.0%' : formatPercent(totalPercentage)}</div>
                <div className="mt-1 text-xs font-semibold text-[#6b7280]">{compositionRows.length} material rows in full composition</div>
              </div>
              <div className="mobile-card overflow-hidden">
                <div className="grid grid-cols-[1.6fr_62px_62px] gap-2 border-b border-[#ece8df] bg-[#faf9f6] px-3 py-2 text-[10px] font-bold uppercase text-[#9ca3af]">
                  <span>Material</span>
                  <span className="text-right">Gram</span>
                  <span className="text-right">%</span>
                </div>
                {compositionRows.map((item) => {
                const material = rawMaterialsById.get(item.item_id);
                return (
                  <div key={item.id || item.item_id} className="grid grid-cols-[1.6fr_62px_62px] gap-2 border-b border-[#f0ede7] px-3 py-2 last:border-b-0">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-[#1f2937]">{material?.name || item.item_name || item.name || 'Material'}</div>
                    </div>
                    <div className="text-right text-xs font-bold">{formatGramAmount(item.grams ?? item.gram_amount)}</div>
                    <div className="text-right text-xs font-bold">{formatPercent(item.displayPercentage)}</div>
                  </div>
                );
              })}
              </div>
            </section>
          ) : <MobileEmptyState title="No composition rows" />
        ) : null}
        {tab === 'workbook' ? (
          <section className="space-y-3">
            <CompactWorkbookPreview
              items={items}
              rawMaterialsById={rawMaterialsById}
              referenceLinksMap={itemReferenceLinksMap}
            />
            <PaceAnalysisCard score={formulaMetrics.paceScore} warnings={paceWarnings} recommendations={paceRecommendations} />
            <section className="mobile-card p-4">
              <h2 className="text-sm font-bold text-[#1f2937]">Composition Board</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MetricTile label="Rows" value={items.length} helper={`${formulaMetrics.guidanceBackedCount} guided`} />
                <MetricTile label="Coverage" value={formatPercent(formulaMetrics.coveragePercent, 0)} helper={`${formulaMetrics.missingGuidanceCount} missing`} />
                <MetricTile label="Impact" value={formulaMetrics.impactDisplay} helper="odour weighted" />
                <MetricTile label="Lifetime" value={formulaMetrics.lifetimeDisplay} helper="projected decay" />
              </div>
            </section>
            <section className="mobile-card p-4">
              <h2 className="text-sm font-bold text-[#1f2937]">PACE Board</h2>
              <div className="mt-3 grid gap-2">
                {(workbookSimulation.pace?.scores || []).slice(0, 8).map((entry) => (
                  <div key={entry.key} className="grid grid-cols-[86px_1fr_34px] items-center gap-2 text-[11px] font-semibold">
                    <span className="truncate">{entry.label}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-[#ece8df]"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(Math.max(entry.value || 0, 0), 100)}%` }} /></span>
                    <span className="text-right">{formatScore(entry.value)}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="mobile-card p-4">
              <h2 className="text-sm font-bold text-[#1f2937]">Facet Chart</h2>
              <div className="mt-3"><MiniBarRows rows={sensoryCharts.fallbackFacetData} labelKey="facet" valueKey="percent" /></div>
            </section>
            <section className="mobile-card p-4">
              <h2 className="text-sm font-bold text-[#1f2937]">Family Chart</h2>
              <div className="mt-3"><MiniBarRows rows={sensoryCharts.familyData} labelKey="family" valueKey="percent" /></div>
            </section>
            <section className="mobile-card p-4">
              <h2 className="text-sm font-bold text-[#1f2937]">Decay Preview</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(sensoryCharts.decayData || []).slice(0, 6).map((entry) => (
                  <MetricTile key={entry.label} label={entry.label} value={formatScore(entry.total)} helper={`T ${formatScore(entry.top)} M ${formatScore(entry.middle)} B ${formatScore(entry.base)}`} />
                ))}
              </div>
            </section>
            <section className="mobile-card p-4">
              <h2 className="text-sm font-bold text-[#1f2937]">Billing Preview</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MetricTile label="Formula Cost" value={formatPrice(totalCost)} helper={formatGramAmount(totalGrams)} />
                <MetricTile label="Per 100g" value={formatPrice(totalGrams > 0 ? (totalCost / totalGrams) * 100 : 0)} helper="material only" />
              </div>
            </section>
          </section>
        ) : null}
        {tab === 'activity' ? (
          validationLogs?.length ? validationLogs.slice(0, MOBILE_ACTIVITY_LIMIT).map((log) => (
            <div key={log.id} className="mobile-card p-4"><div className="text-sm font-bold">{formatStatus(log.test_type || 'revision')}</div><div className="mt-1 text-xs text-[#6b7280]">{formatDate(log.tested_at || log.created)}</div><p className="mt-2 text-sm text-[#374151]">{log.note}</p></div>
          )) : <MobileEmptyState title="No activity yet" />
        ) : null}
        <StickyBottomActionBar>
          <div className="grid grid-cols-4 gap-2">
            <Button variant="outline" className="rounded-2xl bg-white text-xs" onClick={() => navigate(`/mobile/formulas/${id}/edit`)}><Pencil className="mr-1 h-4 w-4" />Edit</Button>
            <Button variant="outline" className="rounded-2xl bg-white text-xs" onClick={() => navigate(`/mobile/batches?formulaId=${id}`)}><Calculator className="mr-1 h-4 w-4" />Batch</Button>
            <Button variant="outline" className="rounded-2xl bg-white text-xs" onClick={handleDuplicate}><Copy className="mr-1 h-4 w-4" />Duplicate</Button>
            <Button variant="outline" className="rounded-2xl border-rose-200 bg-rose-50 text-xs text-rose-700" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
          </div>
        </StickyBottomActionBar>
      </main>
      <DeleteConfirmationDialog open={deleteOpen} onOpenChange={setDeleteOpen} itemName={formula.name} onConfirm={handleDelete} loading={deleting} />
    </MobileAuthenticatedLayout>
  );
};

export default MobileFormulaDetailPage;
