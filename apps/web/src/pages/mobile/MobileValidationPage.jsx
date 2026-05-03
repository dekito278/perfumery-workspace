import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { NotebookPen, Plus } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileSearchableSelector from '@/components/mobile-ui/MobileSearchableSelector.jsx';
import MobileFullScreenModal from '@/components/mobile-ui/MobileFullScreenModal.jsx';
import MobileLoadingSkeleton from '@/components/mobile-ui/MobileLoadingSkeleton.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import PaginationOrLoadMore from '@/components/mobile-ui/PaginationOrLoadMore.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import ValidationCardMobile from '@/components/mobile/ValidationCardMobile.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import { getVisibleItems, MOBILE_PAGE_SIZE, sortByUpdated } from '@/pages/mobile/mobilePageUtils.js';

const tabs = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const createEmptyLog = (formulaId = 'none') => ({
  formula_id: formulaId,
  revision_label: '',
  test_type: 'revision',
  status: 'logged',
  note: '',
  next_action: '',
  evaluator_name: '',
  tested_at: new Date().toISOString().slice(0, 10),
});

const MobileValidationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryFormulaId = searchParams.get('formulaId') || 'none';
  const { getFormulas } = useFormulas();
  const { getValidationLogs, createValidationLog } = useValidationLogs();
  const [formulas, setFormulas] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE_SIZE);
  const [formOpen, setFormOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState(createEmptyLog(queryFormulaId));

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const [formulaRows, logRows] = await Promise.all([getFormulas(), getValidationLogs()]);
      setFormulas(formulaRows || []);
      setLogs(logRows || []);
    } catch (error) {
      toast.error('Failed to load validation workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadWorkspace(); }, []);
  useEffect(() => setVisibleCount(MOBILE_PAGE_SIZE), [tab]);

  const formulasById = useMemo(() => new Map(formulas.map((formula) => [formula.id, formula])), [formulas]);
  const activeLogs = useMemo(() => sortByUpdated(logs).filter((log) => {
    if (tab === 'pending') return log.status === 'action_needed';
    if (tab === 'completed') return log.status === 'approved';
    return log.status !== 'action_needed' && log.status !== 'approved';
  }), [logs, tab]);
  const visible = getVisibleItems(activeLogs, visibleCount);
  const selectedFormula = formulasById.get(formState.formula_id);

  const handleSave = async () => {
    if (!formState.formula_id || formState.formula_id === 'none') {
      toast.error('Choose a formula first');
      setStep(0);
      return;
    }
    if (!formState.note.trim()) {
      toast.error('Validation note is required');
      setStep(1);
      return;
    }
    setSaving(true);
    try {
      await createValidationLog(formState);
      toast.success(formState.status === 'approved' ? 'Validation completed' : 'Validation saved');
      setFormOpen(false);
      setStep(0);
      setFormState(createEmptyLog(queryFormulaId));
      await loadWorkspace();
    } catch (error) {
      toast.error(error.message || 'Failed to save validation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>Mobile Validation - Perfumer Studio</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title="Validation" subtitle="Checklist and follow-up" action={<Button type="button" size="icon" onClick={() => setFormOpen(true)} className="h-11 w-11 rounded-2xl"><Plus className="h-5 w-5" /></Button>} />
        <MobileSegmentedControl options={tabs} value={tab} onChange={setTab} />
        {loading ? <MobileLoadingSkeleton count={4} /> : visible.length ? (
          <>
            <div className="space-y-3">
              {visible.map((log) => (
                <ValidationCardMobile key={log.id} log={log} formula={formulasById.get(log.formula_id)} onOpen={() => log.formula_id && navigate(`/mobile/formulas/${log.formula_id}`)} />
              ))}
            </div>
            <PaginationOrLoadMore visibleCount={visible.length} totalCount={activeLogs.length} onLoadMore={() => setVisibleCount((current) => current + MOBILE_PAGE_SIZE)} />
          </>
        ) : <MobileEmptyState icon={NotebookPen} title="No validation items" description="Create a validation note from a formula or start one here." action="New Validation" onAction={() => setFormOpen(true)} />}
      </main>
      <MobileFullScreenModal
        open={formOpen}
        title="Validation form"
        onClose={() => setFormOpen(false)}
        footer={<StickyBottomActionBar className="static mt-0"><div className="grid grid-cols-2 gap-2"><Button variant="outline" className="rounded-2xl bg-white" onClick={() => step === 0 ? setFormOpen(false) : setStep((current) => current - 1)}>{step === 0 ? 'Cancel' : 'Back'}</Button><Button className="rounded-2xl" disabled={saving} onClick={() => step === 3 ? handleSave() : setStep((current) => current + 1)}>{step === 3 ? saving ? 'Saving...' : 'Save' : 'Continue'}</Button></div></StickyBottomActionBar>}
      >
        <MobileSegmentedControl options={[{ value: 0, label: 'Formula' }, { value: 1, label: 'Notes' }, { value: 2, label: 'Result' }, { value: 3, label: 'Follow-up' }]} value={step} onChange={setStep} />
        <div className="mt-4 mobile-card p-4">
          {step === 0 ? (
            <div className="space-y-2">
              <Label>Formula</Label>
              <button type="button" onClick={() => setSelectorOpen(true)} className="mobile-card w-full p-4 text-left text-sm font-bold">{selectedFormula?.name || 'Choose formula'}</button>
            </div>
          ) : null}
          {step === 1 ? <div className="space-y-2"><Label>Validation notes</Label><Textarea value={formState.note} onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))} className="min-h-[180px] rounded-2xl" /></div> : null}
          {step === 2 ? (
            <div className="grid gap-4">
              <div className="space-y-2"><Label>Revision label</Label><Input value={formState.revision_label} onChange={(event) => setFormState((current) => ({ ...current, revision_label: event.target.value }))} className="rounded-2xl" /></div>
              <div className="space-y-2"><Label>Test date</Label><Input type="date" value={formState.tested_at} onChange={(event) => setFormState((current) => ({ ...current, tested_at: event.target.value }))} className="rounded-2xl" /></div>
              <MobileSegmentedControl options={[{ value: 'logged', label: 'Logged' }, { value: 'action_needed', label: 'Action' }, { value: 'approved', label: 'Approved' }]} value={formState.status} onChange={(value) => setFormState((current) => ({ ...current, status: value }))} />
            </div>
          ) : null}
          {step === 3 ? <div className="space-y-2"><Label>Follow-up action</Label><Textarea value={formState.next_action} onChange={(event) => setFormState((current) => ({ ...current, next_action: event.target.value }))} className="min-h-[180px] rounded-2xl" /></div> : null}
        </div>
      </MobileFullScreenModal>
      <MobileSearchableSelector
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        title="Select formula"
        options={formulas}
        onSelect={(formula) => setFormState((current) => ({ ...current, formula_id: formula.id }))}
        getLabel={(formula) => formula.name}
        getMeta={(formula) => formula.code}
      />
    </MobileAuthenticatedLayout>
  );
};

export default MobileValidationPage;
