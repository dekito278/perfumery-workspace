import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CalendarCheck, ClipboardCheck, FlaskConical, NotebookPen } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileSearchableSelector from '@/components/mobile-ui/MobileSearchableSelector.jsx';
import MobileStatePanel from '@/components/mobile-ui/MobileStatePanel.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import { useMobileBackNavigation } from '@/hooks/useMobileBackNavigation.js';
import { triggerMobileHaptic } from '@/hooks/useMobileTouchFeedback.js';
import { runWithTimeout } from '@/utils/asyncTimeout.js';

const steps = [
  { value: 0, label: 'Formula' },
  { value: 1, label: 'Notes' },
  { value: 2, label: 'Test' },
  { value: 3, label: 'Result' },
];

const testTypeOptions = [
  { value: 'blotter', label: 'Blotter' },
  { value: 'skin', label: 'Skin' },
  { value: 'stability', label: 'Stability' },
  { value: 'revision', label: 'Revision' },
  { value: 'other', label: 'Other' },
];

const statusOptions = [
  { value: 'logged', label: 'Logged' },
  { value: 'action_needed', label: 'Action' },
  { value: 'approved', label: 'Approved' },
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

const ValidationStepSection = ({ icon: Icon, eyebrow, title, description, children }) => (
  <section className="mobile-card p-4">
    <div className="mb-4 flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef7ed] text-[#263d27]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[#647260]">{eyebrow}</div>
        <h2 className="text-base font-bold leading-tight text-[#0b130c]">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">{description}</p> : null}
      </div>
    </div>
    <div className="space-y-4">{children}</div>
  </section>
);

const MobileValidationEditorPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditMode = Boolean(id);
  const queryFormulaId = searchParams.get('formulaId') || 'none';
  const goBack = useMobileBackNavigation('/mobile/validation');
  const { getFormulas } = useFormulas();
  const { createValidationLog, getValidationLogs, updateValidationLog } = useValidationLogs();
  const [formulas, setFormulas] = useState([]);
  const [formState, setFormState] = useState(createEmptyLog(queryFormulaId));
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadEditor = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [formulaRows, logRows] = await Promise.all([
          runWithTimeout(getFormulas(), [], 5000),
          isEditMode ? runWithTimeout(getValidationLogs(), [], 6000) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setFormulas(formulaRows || []);
        if (isEditMode) {
          const match = (logRows || []).find((log) => String(log.id) === String(id));
          if (!match) {
            setLoadError('Validation log not found. It may have been deleted or moved.');
            return;
          }
          setFormState({
            formula_id: match.formula_id || 'none',
            revision_label: match.revision_label || '',
            test_type: match.test_type || 'revision',
            status: match.status || 'logged',
            note: match.note || '',
            next_action: match.next_action || '',
            evaluator_name: match.evaluator_name || '',
            tested_at: match.tested_at || new Date().toISOString().slice(0, 10),
          });
        } else {
          setFormState(createEmptyLog(queryFormulaId));
        }
      } catch (error) {
        if (!cancelled) setLoadError(error.message || 'Validation form could not be loaded right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadEditor();
    return () => { cancelled = true; };
  }, [getFormulas, getValidationLogs, id, isEditMode, queryFormulaId]);

  const formulasById = useMemo(() => new Map(formulas.map((formula) => [formula.id, formula])), [formulas]);
  const selectedFormula = formulasById.get(formState.formula_id);
  const pageTitle = isEditMode ? 'Edit validation' : 'New validation';
  const saveLabel = isEditMode ? 'Update' : 'Save';

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
      if (isEditMode) {
        await updateValidationLog(id, formState);
        toast.success('Validation log updated');
      } else {
        await createValidationLog(formState);
        toast.success(formState.status === 'approved' ? 'Validation completed' : 'Validation saved');
      }
      triggerMobileHaptic('success');
      navigate('/mobile/validation', { state: { restoreScroll: true } });
    } catch (error) {
      toast.error(error.message || 'Failed to save validation');
    } finally {
      setSaving(false);
    }
  };

  const handlePrimaryAction = () => {
    if (step === steps.length - 1) {
      handleSave();
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleSecondaryAction = () => {
    if (step === 0) {
      goBack();
      return;
    }
    setStep((current) => Math.max(current - 1, 0));
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet><title>{pageTitle} - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title={pageTitle} subtitle="Structured test notes" onBack={goBack} />
        <section className="mobile-soft-card p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Dedicated flow</div>
              <h1 className="text-lg font-bold leading-tight text-[#0b130c]">Capture the validation decision without fighting a modal.</h1>
              <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">
                Work through formula, notes, test context, and result. The action bar stays predictable at the bottom.
              </p>
            </div>
          </div>
        </section>

        {loading ? (
          <MobileStatePanel tone="neutral" title="Loading validation form" description="Preparing formulas and existing notes." />
        ) : loadError ? (
          <MobileStatePanel tone="error" title="Couldn't open validation form" description={loadError} action="Back to validation" onAction={goBack} />
        ) : (
          <>
            <MobileSegmentedControl options={steps} value={step} onChange={setStep} />
            {step === 0 ? (
              <ValidationStepSection
                icon={FlaskConical}
                eyebrow="Step 1"
                title="Choose formula and revision"
                description="Anchor the note to the exact candidate before you start writing observations."
              >
                <div className="space-y-2">
                  <Label>Formula</Label>
                  <button
                    type="button"
                    onClick={() => setSelectorOpen(true)}
                    className="mobile-interactive mobile-pressable mobile-card w-full p-4 text-left text-sm font-bold"
                  >
                    <span className="block text-[#0b130c]">{selectedFormula?.name || 'Choose formula'}</span>
                    <span className="mt-1 block text-xs font-medium text-[#6b7280]">{selectedFormula?.code || 'Required before saving'}</span>
                  </button>
                </div>
                <div className="space-y-2">
                  <Label>Revision label</Label>
                  <Input
                    value={formState.revision_label}
                    onChange={(event) => setFormState((current) => ({ ...current, revision_label: event.target.value }))}
                    placeholder="v1 blotter, mod 3, final candidate..."
                    className="rounded-2xl"
                  />
                </div>
              </ValidationStepSection>
            ) : null}

            {step === 1 ? (
              <ValidationStepSection
                icon={NotebookPen}
                eyebrow="Step 2"
                title="Write the observation"
                description="This is the heart of the validation record, so it gets page space instead of cramped modal space."
              >
                <div className="space-y-2">
                  <Label>Validation notes</Label>
                  <Textarea
                    value={formState.note}
                    onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))}
                    placeholder="Opening, heart, drydown, projection, stability notes..."
                    className="min-h-[220px] rounded-2xl"
                  />
                </div>
              </ValidationStepSection>
            ) : null}

            {step === 2 ? (
              <ValidationStepSection
                icon={CalendarCheck}
                eyebrow="Step 3"
                title="Set test context"
                description="Capture where this evidence came from, so the final decision is traceable."
              >
                <div className="space-y-2">
                  <Label>Test type</Label>
                  <MobileSegmentedControl options={testTypeOptions} value={formState.test_type} onChange={(value) => setFormState((current) => ({ ...current, test_type: value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Test date</Label>
                  <Input
                    type="date"
                    value={formState.tested_at}
                    onChange={(event) => setFormState((current) => ({ ...current, tested_at: event.target.value }))}
                    className="rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Evaluator</Label>
                  <Input
                    value={formState.evaluator_name}
                    onChange={(event) => setFormState((current) => ({ ...current, evaluator_name: event.target.value }))}
                    placeholder="Optional evaluator name"
                    className="rounded-2xl"
                  />
                </div>
              </ValidationStepSection>
            ) : null}

            {step === 3 ? (
              <ValidationStepSection
                icon={ClipboardCheck}
                eyebrow="Step 4"
                title="Decide the result"
                description="Close the loop: approve, keep logged, or turn it into an action item."
              >
                <div className="space-y-2">
                  <Label>Status</Label>
                  <MobileSegmentedControl options={statusOptions} value={formState.status} onChange={(value) => setFormState((current) => ({ ...current, status: value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Follow-up action</Label>
                  <Textarea
                    value={formState.next_action}
                    onChange={(event) => setFormState((current) => ({ ...current, next_action: event.target.value }))}
                    placeholder="Reduce top sparkle, add bridge material, re-test skin..."
                    className="min-h-[180px] rounded-2xl"
                  />
                </div>
              </ValidationStepSection>
            ) : null}
          </>
        )}
      </main>

      {!loading && !loadError ? (
        <StickyBottomActionBar fixed reserveSpace aria-label="Validation form actions">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={handleSecondaryAction} disabled={saving}>
              {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            <Button type="button" className="rounded-2xl" disabled={saving} onClick={handlePrimaryAction}>
              {step === steps.length - 1 ? (saving ? 'Saving...' : saveLabel) : 'Continue'}
            </Button>
          </div>
        </StickyBottomActionBar>
      ) : null}

      <MobileSearchableSelector
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        title="Select formula"
        options={formulas}
        onSelect={(formula) => {
          setFormState((current) => ({ ...current, formula_id: formula.id }));
          setSelectorOpen(false);
        }}
        getLabel={(formula) => formula.name}
        getMeta={(formula) => formula.code}
      />
    </MobileAuthenticatedLayout>
  );
};

export default MobileValidationEditorPage;
