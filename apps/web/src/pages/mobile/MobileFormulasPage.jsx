import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Beaker, FileUp, Plus } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSearchBar from '@/components/mobile-ui/MobileSearchBar.jsx';
import MobileFilterChips from '@/components/mobile-ui/MobileFilterChips.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import MobileLoadingSkeleton from '@/components/mobile-ui/MobileLoadingSkeleton.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import DeleteConfirmationDialog from '@/components/mobile-ui/DeleteConfirmationDialog.jsx';
import PaginationOrLoadMore from '@/components/mobile-ui/PaginationOrLoadMore.jsx';
import FormulaCardMobile from '@/components/mobile/FormulaCardMobile.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { filterByText, getVisibleItems, MOBILE_PAGE_SIZE, sortByUpdated } from '@/pages/mobile/mobilePageUtils.js';

const ImportFormulaPdfModal = lazy(() => import('@/components/ImportFormulaPdfModal.jsx'));

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'validated', label: 'Validated' },
  { value: 'standalone', label: 'Standalone' },
  { value: 'linked', label: 'Linked Brief' },
];

const MobileFormulasPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getFormulas, duplicateFormula, deleteFormula } = useFormulas();
  const { getFormulaItems } = useFormulaItems();
  const { getBriefs } = useBriefs();
  const { getValidationLogs } = useValidationLogs();
  const [formulas, setFormulas] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [pipeline, setPipeline] = useState({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE_SIZE);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState('');
  const [importOpen, setImportOpen] = useState(searchParams.get('action') === 'import');

  const loadFormulas = async () => {
    setLoading(true);
    try {
      const formulaRows = await getFormulas();
      setFormulas(formulaRows || []);
      const [briefRows, logRows, metricEntries] = await Promise.all([
        getBriefs(),
        getValidationLogs(),
        Promise.all((formulaRows || []).map(async (formula) => {
          const items = await getFormulaItems(formula.id);
          return [formula.id, { itemCount: items.length, totalGrams: calculateTotalAmount(items) }];
        })),
      ]);
      setMetrics(Object.fromEntries(metricEntries));
      const briefsByFormulaId = briefRows.reduce((map, brief) => {
        if (brief.formula_id) map.set(brief.formula_id, (map.get(brief.formula_id) || 0) + 1);
        return map;
      }, new Map());
      const logsByFormulaId = logRows.reduce((map, log) => {
        const current = map.get(log.formula_id) || { validationCount: 0, actionNeededCount: 0 };
        current.validationCount += 1;
        if (log.status === 'action_needed') current.actionNeededCount += 1;
        map.set(log.formula_id, current);
        return map;
      }, new Map());
      setPipeline(Object.fromEntries((formulaRows || []).map((formula) => [formula.id, {
        briefCount: briefsByFormulaId.get(formula.id) || 0,
        ...(logsByFormulaId.get(formula.id) || { validationCount: 0, actionNeededCount: 0 }),
      }])));
    } catch (error) {
      toast.error('Failed to load formulas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFormulas(); }, []);
  useEffect(() => setVisibleCount(MOBILE_PAGE_SIZE), [query, status]);

  const filtered = useMemo(() => {
    const searched = filterByText(formulas, query, ['name', 'code', 'category', 'status']);
    return sortByUpdated(searched).filter((formula) => {
      if (status === 'all') return true;
      if (status === 'standalone') return !pipeline[formula.id]?.briefCount;
      if (status === 'linked') return Boolean(pipeline[formula.id]?.briefCount);
      if (status === 'validated') return Boolean(pipeline[formula.id]?.validationCount);
      return (formula.status || 'draft') === status;
    });
  }, [formulas, pipeline, query, status]);
  const visible = getVisibleItems(filtered, visibleCount);

  const handleDuplicate = async (formula) => {
    setDuplicatingId(formula.id);
    try {
      await duplicateFormula(formula.id);
      toast.success('Formula duplicated');
      await loadFormulas();
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
      await loadFormulas();
    } catch (error) {
      toast.error(error.message || 'Failed to delete formula');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>Mobile Formulas - Perfumer Studio</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Formulas"
          subtitle="Formula library and imports"
          action={<Button type="button" size="icon" onClick={() => navigate('/mobile/formulas/new')} className="h-11 w-11 rounded-2xl"><Plus className="h-5 w-5" /></Button>}
        />
        <div className="mobile-sticky-search">
          <MobileSearchBar value={query} onChange={setQuery} placeholder="Search formula, code, category..." disabled={loading} />
          <MobileFilterChips options={statusOptions} value={status} onChange={setStatus} />
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)} className="mt-2 h-11 w-full rounded-2xl bg-white">
            <FileUp className="mr-2 h-4 w-4" />
            Import Formula PDF
          </Button>
        </div>
        {loading ? <MobileLoadingSkeleton count={4} /> : formulas.length === 0 ? (
          <MobileEmptyState icon={Beaker} title="No formulas yet" description="Create a standalone formula or import a workbook PDF." action="New Formula" onAction={() => navigate('/mobile/formulas/new')} />
        ) : filtered.length === 0 ? (
          <MobileEmptyState title="No matching formulas" description="Try another search or filter." />
        ) : (
          <>
            <div className="space-y-3">
              {visible.map((formula) => (
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
            </div>
            <PaginationOrLoadMore visibleCount={visible.length} totalCount={filtered.length} onLoadMore={() => setVisibleCount((current) => current + MOBILE_PAGE_SIZE)} />
          </>
        )}
      </main>
      <DeleteConfirmationDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} itemName={deleteTarget?.name} onConfirm={handleDelete} loading={deleting} />
      <MobileBottomSheet open={importOpen} onOpenChange={setImportOpen} title="Import Formula PDF" description="Upload and parse a workbook PDF.">
        <Suspense fallback={<div className="p-4 text-sm text-[#6b7280]">Loading importer...</div>}>
          <ImportFormulaPdfModal
            open={importOpen}
            onOpenChange={setImportOpen}
            onSuccess={(createdFormula) => {
              setImportOpen(false);
              toast.success('Formula imported');
              navigate(createdFormula?.id ? `/mobile/formulas/${createdFormula.id}` : '/mobile/formulas');
            }}
          />
        </Suspense>
      </MobileBottomSheet>
    </MobileAuthenticatedLayout>
  );
};

export default MobileFormulasPage;
