import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardCheck, NotebookPen, Plus } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileLoadingSkeleton from '@/components/mobile-ui/MobileLoadingSkeleton.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import MobileStatePanel from '@/components/mobile-ui/MobileStatePanel.jsx';
import DeleteConfirmationDialog from '@/components/mobile-ui/DeleteConfirmationDialog.jsx';
import PaginationOrLoadMore from '@/components/mobile-ui/PaginationOrLoadMore.jsx';
import ValidationCardMobile from '@/components/mobile/ValidationCardMobile.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import { getMobileFromState } from '@/hooks/useMobileBackNavigation.js';
import { getVisibleItems, MOBILE_PAGE_SIZE } from '@/pages/mobile/mobilePageUtils.js';
import { runWithTimeout } from '@/utils/asyncTimeout.js';
import { triggerMobileHaptic } from '@/hooks/useMobileTouchFeedback.js';

const tabs = [
  { value: 'pending', label: 'Action' },
  { value: 'in_progress', label: 'Logged' },
  { value: 'completed', label: 'Approved' },
];

const StatTile = ({ label, value, tone = 'neutral' }) => {
  const toneClass = tone === 'amber'
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-[#ece8df] bg-[#f8f7f4] text-[#1f2937]';

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="text-[10px] font-bold uppercase opacity-70">{label}</div>
      <div className="mt-1 text-lg font-bold leading-none">{value}</div>
    </div>
  );
};

const MobileValidationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryFormulaId = searchParams.get('formulaId') || 'none';
  const { getFormulas } = useFormulas();
  const { deleteValidationLog, getValidationLogs } = useValidationLogs();
  const [formulas, setFormulas] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE_SIZE);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadWorkspace = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const logRows = await runWithTimeout(getValidationLogs(), [], 6000);
      setLogs(logRows || []);
      setLoading(false);
      try {
        const formulaRows = await runWithTimeout(getFormulas(), [], 4500);
        setFormulas(formulaRows || []);
      } catch (error) {
        console.warn('Validation formula names are delayed:', error);
      }
    } catch (error) {
      toast.error('Failed to load validation workspace');
      setLoadError(error.message || 'Validation workspace could not be loaded right now.');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadWorkspace(); }, []);
  useEffect(() => setVisibleCount(MOBILE_PAGE_SIZE), [tab]);

  const formulasById = useMemo(() => new Map(formulas.map((formula) => [formula.id, formula])), [formulas]);
  const sortedLogs = useMemo(
    () => [...logs].sort((left, right) => {
      const rightDate = new Date(right.tested_at || right.created || 0).getTime();
      const leftDate = new Date(left.tested_at || left.created || 0).getTime();
      return rightDate - leftDate;
    }),
    [logs]
  );
  const activeLogs = useMemo(() => sortedLogs.filter((log) => {
    if (tab === 'pending') return log.status === 'action_needed';
    if (tab === 'completed') return log.status === 'approved';
    return log.status !== 'action_needed' && log.status !== 'approved';
  }), [sortedLogs, tab]);
  const visible = getVisibleItems(activeLogs, visibleCount);
  const actionCount = logs.filter((log) => log.status === 'action_needed').length;
  const approvedCount = logs.filter((log) => log.status === 'approved').length;
  const loggedCount = Math.max(logs.length - actionCount - approvedCount, 0);

  const editorState = getMobileFromState(location);
  const openNewLog = () => {
    const formulaQuery = queryFormulaId && queryFormulaId !== 'none'
      ? `?formulaId=${encodeURIComponent(queryFormulaId)}`
      : '';
    navigate(`/mobile/validation/new${formulaQuery}`, { state: editorState });
  };
  const openEditLog = (log) => navigate(`/mobile/validation/${log.id}/edit`, { state: editorState });

  const handleDeleteLog = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteValidationLog(deleteTarget.id);
      triggerMobileHaptic('success');
      toast.success('Validation log deleted');
      setDeleteTarget(null);
      await loadWorkspace();
    } catch (error) {
      toast.error(error.message || 'Failed to delete validation log');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet><title>Mobile Validation - Solivagant</title></Helmet>
      <main className="mobile-page space-y-3">
        <MobileTopBar
          title="Validation"
          subtitle="Tests and revision notes"
          action={(
            <Button type="button" size="icon" onClick={openNewLog} className="mobile-interactive mobile-add-action mobile-pressable h-11 w-11 rounded-2xl">
              <Plus className="h-5 w-5" />
            </Button>
          )}
        />
        <section className="mobile-soft-card p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase text-amber-700">Validation queue</div>
              <h2 className="mt-0.5 truncate text-base font-bold text-[#1f2937]">{actionCount ? `${actionCount} needs action` : 'No urgent action'}</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <StatTile label="Action" value={actionCount} tone="amber" />
                <StatTile label="Logged" value={loggedCount} />
                <StatTile label="Approved" value={approvedCount} tone="emerald" />
              </div>
            </div>
          </div>
        </section>
        <MobileSegmentedControl options={tabs} value={tab} onChange={setTab} />
        {loading ? <MobileLoadingSkeleton count={4} title="Loading validation..." subtitle="Preparing action queue, approvals, and recent notes." /> : loadError ? (
          <MobileStatePanel
            tone="error"
            title="Couldn't load validation"
            description={loadError}
            action="Try again"
            onAction={loadWorkspace}
          />
        ) : visible.length ? (
          <>
            <div className="space-y-2">
              {visible.map((log) => (
                <ValidationCardMobile
                  key={log.id}
                  log={log}
                  formula={formulasById.get(log.formula_id)}
                  onDelete={() => setDeleteTarget(log)}
                  onEdit={() => openEditLog(log)}
                  onOpen={() => log.formula_id && navigate(`/mobile/formulas/${log.formula_id}`, { state: editorState })}
                />
              ))}
            </div>
            <PaginationOrLoadMore visibleCount={visible.length} totalCount={activeLogs.length} onLoadMore={() => setVisibleCount((current) => current + MOBILE_PAGE_SIZE)} />
          </>
        ) : (
          <MobileEmptyState
            icon={NotebookPen}
            title={tab === 'pending' ? 'No items need action' : tab === 'completed' ? 'No approved validations yet' : 'No validation notes yet'}
            description={tab === 'pending'
              ? 'When a test needs follow-up, it will appear here for quick review.'
              : tab === 'completed'
                ? 'Approved validation results will collect here after review.'
                : 'Log blotter, skin, stability, or revision notes once a formula is ready to review.'}
            action={tab === 'in_progress' ? 'New Validation' : 'View logged'}
            onAction={tab === 'in_progress' ? openNewLog : () => setTab('in_progress')}
          />
        )}
      </main>
      <DeleteConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemName={deleteTarget ? formulasById.get(deleteTarget.formula_id)?.name || 'Validation log' : ''}
        onConfirm={handleDeleteLog}
        loading={deleting}
      />
    </MobileAuthenticatedLayout>
  );
};

export default MobileValidationPage;
