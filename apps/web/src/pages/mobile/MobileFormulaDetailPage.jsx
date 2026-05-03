import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import DeleteConfirmationDialog from '@/components/mobile-ui/DeleteConfirmationDialog.jsx';
import PaceAnalysisCard from '@/components/mobile/PaceAnalysisCard.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useFormulaDetailPage } from '@/hooks/useFormulaDetailPage.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { formatDate, formatGramAmount, formatStatus } from '@/utils/formatting.js';
import { formatPrice } from '@/utils/pricingUtils.js';
import { MOBILE_ACTIVITY_LIMIT, MOBILE_PAGE_SIZE } from '@/pages/mobile/mobilePageUtils.js';

const tabs = [
  { value: 'summary', label: 'Summary' },
  { value: 'composition', label: 'Composition' },
  { value: 'workbook', label: 'Workbook' },
  { value: 'validation', label: 'Validation' },
  { value: 'activity', label: 'Activity' },
];

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
    items,
    linkedBriefs,
    loading,
    rawMaterialsById,
    totalCost,
    totalGrams,
    totalPercentage,
    validationLogs,
    validationLoading,
    workbookBoardStats,
  } = detail;

  const compositionRows = useMemo(() => (items || []).slice(0, MOBILE_PAGE_SIZE), [items]);

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
    return <MobileAuthenticatedLayout><main className="mobile-page"><div className="mobile-card p-6 text-sm text-[#6b7280]">Loading formula...</div></main></MobileAuthenticatedLayout>;
  }

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>{formula.name} - Mobile Formula</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title={formula.name} subtitle={`${formula.code} · ${formatStatus(formula.category || 'perfume')}`} onBack={() => navigate('/mobile/formulas')} action={<MobileStatusBadge status={formula.status || 'draft'} />} />
        <MobileSegmentedControl options={tabs} value={tab} onChange={setTab} />
        {tab === 'summary' ? (
          <section className="space-y-3">
            <div className="mobile-soft-card p-4">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs font-bold uppercase text-amber-700">Formula size</div><div className="mt-1 text-xl font-bold">{formatGramAmount(totalGrams)}</div></div>
                <div><div className="text-xs font-bold uppercase text-amber-700">Material cost</div><div className="mt-1 text-xl font-bold">{formatPrice(totalCost)}</div></div>
              </div>
            </div>
            {[
              ['Version', formula.version || 'Not set'],
              ['Linked brief', linkedBriefs?.[0]?.title || 'Standalone formula'],
              ['Last updated', formatDate(formula.updated || formula.created)],
              ['Notes', formula.notes || 'No notes yet'],
            ].map(([label, value]) => <div key={label} className="mobile-card p-4"><div className="text-xs font-bold uppercase text-[#9ca3af]">{label}</div><div className="mt-1 text-sm font-semibold text-[#1f2937]">{value}</div></div>)}
          </section>
        ) : null}
        {tab === 'composition' ? (
          compositionRows.length ? (
            <section className="space-y-3">
              <div className="mobile-soft-card p-4"><div className="text-xs font-bold uppercase text-amber-700">Total percentage</div><div className="mt-1 text-2xl font-bold">{Number(totalPercentage || 0).toFixed(1)}%</div></div>
              {compositionRows.map((item) => {
                const material = rawMaterialsById.get(item.item_id);
                return (
                  <div key={item.id || item.item_id} className="mobile-card p-4">
                    <div className="text-sm font-bold">{material?.name || item.item_name || 'Material'}</div>
                    <div className="mt-1 text-xs text-[#6b7280]">{material?.category || item.item_type || 'raw material'}</div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-[#f8f7f4] p-3"><div className="text-[11px] font-bold uppercase text-[#9ca3af]">Grams</div><div className="mt-1 font-bold">{formatGramAmount(item.grams ?? item.gram_amount)}</div></div>
                      <div className="rounded-2xl bg-[#f8f7f4] p-3"><div className="text-[11px] font-bold uppercase text-[#9ca3af]">Percent</div><div className="mt-1 font-bold">{Number(item.percentage || 0).toFixed(1)}%</div></div>
                    </div>
                  </div>
                );
              })}
              {(items || []).length > MOBILE_PAGE_SIZE ? <div className="text-center text-xs font-semibold text-[#9ca3af]">Showing 7 of {items.length}. Open edit for full composition.</div> : null}
            </section>
          ) : <MobileEmptyState title="No composition rows" description="Edit formula to add materials." />
        ) : null}
        {tab === 'workbook' ? <PaceAnalysisCard score={workbookBoardStats?.coverageRate || 68} warnings={['Review workbook groups in edit mode']} recommendations={['Export from desktop for print-ready workbook']} /> : null}
        {tab === 'validation' ? (
          validationLoading ? <div className="mobile-card p-6">Loading validation...</div> : validationLogs.length ? validationLogs.slice(0, MOBILE_PAGE_SIZE).map((log) => (
            <div key={log.id} className="mobile-card p-4"><MobileStatusBadge status={log.status || 'logged'} /><div className="mt-2 text-sm font-medium">{log.note}</div><div className="mt-2 text-xs text-[#6b7280]">{formatDate(log.tested_at || log.created)}</div></div>
          )) : <MobileEmptyState title="No validation notes" description="Start validation for this formula." action="Validate" onAction={() => navigate(`/mobile/validation?formulaId=${id}`)} />
        ) : null}
        {tab === 'activity' ? (
          validationLogs?.length ? validationLogs.slice(0, MOBILE_ACTIVITY_LIMIT).map((log) => (
            <div key={log.id} className="mobile-card p-4"><div className="text-sm font-bold">{formatStatus(log.test_type || 'revision')}</div><div className="mt-1 text-xs text-[#6b7280]">{formatDate(log.tested_at || log.created)}</div><p className="mt-2 text-sm text-[#374151]">{log.note}</p></div>
          )) : <MobileEmptyState title="No activity yet" />
        ) : null}
        <StickyBottomActionBar>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="rounded-2xl bg-white text-xs" onClick={() => navigate(`/mobile/formulas/${id}/edit`)}><Pencil className="mr-1 h-4 w-4" />Edit</Button>
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
