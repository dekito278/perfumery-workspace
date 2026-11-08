import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { BookOpenText, Calculator, Copy, Download, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import MobileActionDock from '@/components/mobile-ui/MobileActionDock.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import DeleteConfirmationDialog from '@/components/mobile-ui/DeleteConfirmationDialog.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import PaceAnalysisCard from '@/components/mobile/PaceAnalysisCard.jsx';
import { CompactWorkbookPreview } from '@/components/mobile/MobileFormulaComposerWorkspace.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useFormulaDetailPage } from '@/hooks/useFormulaDetailPage.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useJournalPosts } from '@/hooks/useJournalPosts.js';
import { updateFormulaStatus } from '@/services/formulasSupabaseService.js';
import { validationTestTypeLabel } from '@/services/validationLogsSupabaseService.js';
import { formatDate, formatGramAmount, formatStatus } from '@/utils/formatting.js';
import { formatPrice } from '@/utils/pricingUtils.js';
import { buildMobileFormulaMetrics } from '@/utils/mobileFormulaMetrics.js';
import { MOBILE_ACTIVITY_LIMIT } from '@/pages/mobile/mobilePageUtils.js';
import { buildFormulaSensoryCharts } from '@/utils/formulaSensoryCharts.js';
import { getMobileFromState, useMobileBackNavigation } from '@/hooks/useMobileBackNavigation.js';

const tabs = [
  { value: 'summary', label: 'Ringkasan' },
  { value: 'composition', label: 'Komposisi' },
  { value: 'workbook', label: 'Workbook' },
  { value: 'activity', label: 'Aktivitas' },
];

const JOURNAL_STATUS_LABELS = { draft: 'Draf', published: 'Terbit' };

const formatPercent = (value, digits = 1) => `${Number(value || 0).toFixed(digits)}%`;
const formatScore = (value) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : '-';

const MetricTile = ({ label, value, helper }) => (
  <div className="rounded-xl bg-[#f8f7f4] p-3">
    <div className="text-[10px] font-bold uppercase text-[#6b7280]">{label}</div>
    <div className="mt-1 text-sm font-bold text-[#1f2937]">{value}</div>
    {helper ? <div className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">{helper}</div> : null}
  </div>
);

const MiniBarRows = ({ rows = [], labelKey = 'label', valueKey = 'value', empty = 'Belum ada data grafik' }) => {
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
  const location = useLocation();
  const handleBack = useMobileBackNavigation('/mobile/formulas');
  const [tab, setTab] = useState('summary');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { deleteFormula, duplicateFormula } = useFormulas();
  const { getJournalPosts } = useJournalPosts();
  const [linkedJournalPosts, setLinkedJournalPosts] = useState([]);
  const detail = useFormulaDetailPage(id);
  const {
    formula,
    handleExportPdf,
    items,
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
    return [`Perkuat ${String(weakestAxis.label).toLowerCase()} (${Math.round(Number(weakestAxis.value) || 0)}).`];
  }, [workbookSimulation]);

  useEffect(() => {
    let active = true;

    const loadLinkedJournalPosts = async () => {
      try {
        const posts = await getJournalPosts();
        if (active) {
          setLinkedJournalPosts(posts.filter((post) => post.related_formula_id === id));
        }
      } catch (error) {
        if (active) {
          setLinkedJournalPosts([]);
        }
      }
    };

    loadLinkedJournalPosts();

    return () => {
      active = false;
    };
  }, [getJournalPosts, id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteFormula(id);
      toast.success('Formula dihapus');
      navigate('/mobile/formulas');
    } catch (error) {
      toast.error(error.message || 'Gagal menghapus formula');
      setDeleting(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      await duplicateFormula(id);
      toast.success('Formula digandakan');
      navigate('/mobile/formulas');
    } catch (error) {
      toast.error('Gagal menggandakan formula');
    }
  };

  const markReadyForBatch = async () => {
    setUpdatingStatus(true);
    try {
      await updateFormulaStatus(id, 'ready_for_batch');
      toast.success('Formula ditandai siap batch');
      navigate(`/mobile/batches?formulaId=${id}`);
    } catch (error) {
      toast.error(error.message || 'Gagal memperbarui status formula');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading || !formula) {
    return <MobileAuthenticatedLayout><MobileLoadingState eyebrow="Formula" title="Memuat formula..." subtitle="Menyiapkan workbook dan data komposisi." /></MobileAuthenticatedLayout>;
  }

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>{formula.name} - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title={formula.name} subtitle={`${formula.code} / ${formatStatus(formula.category || 'perfume')}`} onBack={handleBack} action={<MobileStatusBadge status={formula.status || 'draft'} />} />
        <MobileSegmentedControl options={tabs} value={tab} onChange={setTab} />
        {tab === 'summary' ? (
          <section className="space-y-3">
            <div className="mobile-soft-card p-4">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-[10px] font-bold uppercase text-amber-700">Ukuran</div><div className="mt-1 text-lg font-bold">{formatGramAmount(totalGrams)}</div></div>
                <div><div className="text-[10px] font-bold uppercase text-amber-700">Biaya</div><div className="mt-1 text-lg font-bold">{formatPrice(totalCost)}</div></div>
                <div><div className="text-[10px] font-bold uppercase text-amber-700">Kekuatan</div><div className="mt-1 text-lg font-bold">{formulaMetrics.impactDisplay}</div></div>
                <div><div className="text-[10px] font-bold uppercase text-amber-700">Ketahanan</div><div className="mt-1 text-lg font-bold">{formulaMetrics.lifetimeDisplay}</div></div>
              </div>
            </div>
            {[
              ['Versi', formula.version || '-'],
              ['Jenis', 'Formula mandiri'],
              ['Terakhir diperbarui', formatDate(formula.updated || formula.created)],
              ['Catatan', formula.notes || '-'],
            ].map(([label, value]) => <div key={label} className="mobile-card p-4"><div className="text-xs font-bold uppercase text-[#6b7280]">{label}</div><div className="mt-1 text-sm font-semibold text-[#1f2937]">{value}</div></div>)}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="mobile-interactive mobile-pressable h-11 rounded-2xl bg-white text-xs font-bold" onClick={handleExportPdf}><Download className="mr-1 h-4 w-4" />PDF formula</Button>
              <Button className="mobile-interactive mobile-pressable h-11 rounded-2xl text-xs font-bold" onClick={markReadyForBatch} disabled={updatingStatus}><Calculator className="mr-1 h-4 w-4" />Siap batch</Button>
              <Button variant="outline" className="mobile-interactive mobile-pressable col-span-2 h-11 rounded-2xl bg-white text-xs font-bold" onClick={() => navigate(`/mobile/journal/new?formulaId=${id}`)}><BookOpenText className="mr-1 h-4 w-4" />Tulis catatan Journal terkait</Button>
            </div>
            <section className="mobile-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-[#1f2937]">Catatan Journal terkait</h2>
                <span className="text-[11px] font-bold text-[#6b7280]">{linkedJournalPosts.length}</span>
              </div>
              {linkedJournalPosts.length ? (
                <div className="mt-3 space-y-2">
                  {linkedJournalPosts.slice(0, 3).map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => navigate(`/mobile/journal/${post.id}`)}
                      className="block w-full rounded-xl border border-[#ece8df] bg-white p-3 text-left"
                    >
                      <div className="line-clamp-1 text-xs font-bold text-[#1f2937]">{post.title || 'Catatan tanpa judul'}</div>
                      <div className="mt-1 text-[11px] font-semibold capitalize text-[#6b7280]">{JOURNAL_STATUS_LABELS[post.status || 'draft'] || post.status}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">Belum ada catatan Journal yang terhubung ke formula ini.</p>
              )}
            </section>
          </section>
        ) : null}
        {tab === 'composition' ? (
          compositionRows.length ? (
            <section className="space-y-3">
              <div className="mobile-soft-card p-4">
                <div className="text-xs font-bold uppercase text-amber-700">Total persentase</div>
                <div className="mt-1 text-xl font-bold">{totalGrams > 0 ? '100.0%' : formatPercent(totalPercentage)}</div>
                <div className="mt-1 text-xs font-semibold text-[#6b7280]">{compositionRows.length} baris bahan dalam komposisi lengkap</div>
              </div>
              <div className="mobile-card overflow-hidden">
                <div className="grid grid-cols-[1.6fr_62px_62px] gap-2 border-b border-[#ece8df] bg-[#faf9f6] px-3 py-2 text-[10px] font-bold uppercase text-[#6b7280]">
                  <span>Bahan</span>
                  <span className="text-right">Gram</span>
                  <span className="text-right">%</span>
                </div>
                {compositionRows.map((item) => {
                const material = rawMaterialsById.get(item.item_id);
                return (
                  <div key={item.id || item.item_id} className="grid grid-cols-[1.6fr_62px_62px] gap-2 border-b border-[#f0ede7] px-3 py-2 last:border-b-0">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-[#1f2937]">{material?.name || item.item_name || item.name || 'Bahan'}</div>
                    </div>
                    <div className="text-right text-xs font-bold">{formatGramAmount(item.grams ?? item.gram_amount)}</div>
                    <div className="text-right text-xs font-bold">{formatPercent(item.displayPercentage)}</div>
                  </div>
                );
              })}
              </div>
            </section>
          ) : <MobileEmptyState title="Belum ada baris komposisi" />
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
              <h2 className="text-sm font-bold text-[#1f2937]">Papan komposisi</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MetricTile label="Baris" value={items.length} helper={`${formulaMetrics.guidanceBackedCount} berpanduan`} />
                <MetricTile label="Cakupan" value={formatPercent(formulaMetrics.coveragePercent, 0)} helper={`${formulaMetrics.missingGuidanceCount} tanpa panduan`} />
                <MetricTile label="Kekuatan" value={formulaMetrics.impactDisplay} helper="berbobot aroma" />
                <MetricTile label="Ketahanan" value={formulaMetrics.lifetimeDisplay} helper="proyeksi penguapan" />
              </div>
            </section>
            <section className="mobile-card p-4">
              <h2 className="text-sm font-bold text-[#1f2937]">Papan PACE</h2>
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
              <h2 className="text-sm font-bold text-[#1f2937]">Grafik nuansa aroma</h2>
              <div className="mt-3"><MiniBarRows rows={sensoryCharts.fallbackFacetData} labelKey="facet" valueKey="percent" /></div>
            </section>
            <section className="mobile-card p-4">
              <h2 className="text-sm font-bold text-[#1f2937]">Grafik keluarga aroma</h2>
              <div className="mt-3"><MiniBarRows rows={sensoryCharts.familyData} labelKey="family" valueKey="percent" /></div>
            </section>
            <section className="mobile-card p-4">
              <h2 className="text-sm font-bold text-[#1f2937]">Pratinjau penguapan</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(sensoryCharts.decayData || []).slice(0, 6).map((entry) => (
                  <MetricTile key={entry.label} label={entry.label} value={formatScore(entry.total)} helper={`A ${formatScore(entry.top)} T ${formatScore(entry.middle)} D ${formatScore(entry.base)}`} />
                ))}
              </div>
            </section>
            <section className="mobile-card p-4">
              <h2 className="text-sm font-bold text-[#1f2937]">Pratinjau biaya</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MetricTile label="Biaya formula" value={formatPrice(totalCost)} helper={formatGramAmount(totalGrams)} />
                <MetricTile label="Per 100 g" value={formatPrice(totalGrams > 0 ? (totalCost / totalGrams) * 100 : 0)} helper="bahan saja" />
              </div>
            </section>
          </section>
        ) : null}
        {tab === 'activity' ? (
          validationLogs?.length ? validationLogs.slice(0, MOBILE_ACTIVITY_LIMIT).map((log) => (
            <div key={log.id} className="mobile-card p-4"><div className="text-sm font-bold">{validationTestTypeLabel(log.test_type)}</div><div className="mt-1 text-xs text-[#6b7280]">{formatDate(log.tested_at || log.created)}</div><p className="mt-2 text-sm text-[#374151]">{log.note}</p></div>
          )) : <MobileEmptyState title="Belum ada aktivitas" />
        ) : null}
        <StickyBottomActionBar>
          <MobileActionDock
            className="border-0 bg-transparent p-0 shadow-none"
            primary={(
              <Button className="mobile-interactive mobile-pressable h-11 w-full rounded-2xl text-xs font-bold" onClick={() => navigate(`/mobile/batches?formulaId=${id}`)}>
                <Calculator className="mr-2 h-4 w-4" />
                Buka kalkulator batch
              </Button>
            )}
            secondary={[
              <Button key="edit" variant="outline" className="mobile-interactive mobile-pressable h-10 rounded-2xl bg-white text-xs" onClick={() => navigate(`/mobile/formulas/${id}/edit`, { state: getMobileFromState(location) })}><Pencil className="mr-1 h-4 w-4" />Ubah</Button>,
              <Button key="duplicate" variant="outline" className="mobile-interactive mobile-pressable h-10 rounded-2xl bg-white text-xs" onClick={handleDuplicate}><Copy className="mr-1 h-4 w-4" />Gandakan</Button>,
            ]}
            destructive={<Button variant="outline" className="mobile-interactive mobile-delete-action h-10 rounded-2xl border-rose-200 bg-rose-50 text-xs text-rose-700" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1 h-4 w-4" />Hapus</Button>}
          />
        </StickyBottomActionBar>
      </main>
      <DeleteConfirmationDialog open={deleteOpen} onOpenChange={setDeleteOpen} itemName={formula.name} onConfirm={handleDelete} loading={deleting} />
    </MobileAuthenticatedLayout>
  );
};

export default MobileFormulaDetailPage;
