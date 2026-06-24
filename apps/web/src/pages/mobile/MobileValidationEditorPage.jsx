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
  { value: 1, label: 'Catatan' },
  { value: 2, label: 'Tes' },
  { value: 3, label: 'Hasil' },
];

const testTypeOptions = [
  { value: 'blotter', label: 'Blotter' },
  { value: 'skin', label: 'Skin' },
  { value: 'stability', label: 'Stability' },
  { value: 'revision', label: 'Revision' },
  { value: 'other', label: 'Lainnya' },
];

const statusOptions = [
  { value: 'logged', label: 'Tercatat' },
  { value: 'action_needed', label: 'Aksi' },
  { value: 'approved', label: 'Disetujui' },
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
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef7ed] text-[#1b1a16]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[#647260]">{eyebrow}</div>
        <h2 className="text-base font-bold leading-tight text-[#1b1a16]">{title}</h2>
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
            setLoadError('Catatan validasi tidak ditemukan. Mungkin sudah dihapus atau dipindah.');
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
        if (!cancelled) setLoadError(error.message || 'Form validasi belum bisa dimuat saat ini.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadEditor();
    return () => { cancelled = true; };
  }, [getFormulas, getValidationLogs, id, isEditMode, queryFormulaId]);

  const formulasById = useMemo(() => new Map(formulas.map((formula) => [formula.id, formula])), [formulas]);
  const selectedFormula = formulasById.get(formState.formula_id);
  const pageTitle = isEditMode ? 'Edit validasi' : 'Validasi baru';
  const saveLabel = isEditMode ? 'Update' : 'Simpan';

  const handleSave = async () => {
    if (saving) {
      return;
    }

    if (!formState.formula_id || formState.formula_id === 'none') {
      toast.error('Pilih formula dulu');
      setStep(0);
      return;
    }
    if (!formState.note.trim()) {
      toast.error('Catatan validasi wajib diisi');
      setStep(1);
      return;
    }
    setSaving(true);
    try {
      if (isEditMode) {
        await updateValidationLog(id, formState);
        toast.success('Catatan validasi diperbarui');
      } else {
        await createValidationLog(formState);
        toast.success(formState.status === 'approved' ? 'Validasi selesai' : 'Validasi disimpan');
      }
      triggerMobileHaptic('success');
      navigate('/mobile/validation', { state: { restoreScroll: true } });
    } catch (error) {
      toast.error(error.message || 'Validasi belum bisa disimpan');
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
    <MobileAuthenticatedLayout taskMode>
      <Helmet><title>{pageTitle} - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title={pageTitle} subtitle="Catatan tes terstruktur" onBack={goBack} />
        <section className="mobile-soft-card p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Flow khusus</div>
              <h1 className="text-lg font-bold leading-tight text-[#1b1a16]">Catat keputusan validasi tanpa modal yang sempit.</h1>
              <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">
                Isi formula, catatan, konteks tes, dan hasil. Tombol aksi tetap konsisten di bawah.
              </p>
            </div>
          </div>
        </section>

        {loading ? (
          <MobileStatePanel tone="loading" title="Memuat form validasi" description="Menyiapkan formula dan catatan yang sudah ada." />
        ) : loadError ? (
          <MobileStatePanel tone="error" title="Form validasi belum bisa dibuka" description={loadError} action="Kembali ke validasi" onAction={goBack} />
        ) : (
          <>
            <MobileSegmentedControl options={steps} value={step} onChange={setStep} />
            {step === 0 ? (
              <ValidationStepSection
                icon={FlaskConical}
                eyebrow="Langkah 1"
                title="Pilih formula dan revisi"
                description="Kaitkan catatan ke kandidat formula yang tepat sebelum menulis observasi."
              >
                <div className="space-y-2">
                  <Label>Formula</Label>
                  <button
                    type="button"
                    onClick={() => setSelectorOpen(true)}
                    className="mobile-interactive mobile-pressable mobile-card w-full p-4 text-left text-sm font-bold"
                  >
                    <span className="block text-[#1b1a16]">{selectedFormula?.name || 'Pilih formula'}</span>
                    <span className="mt-1 block text-xs font-medium text-[#6b7280]">{selectedFormula?.code || 'Wajib sebelum simpan'}</span>
                  </button>
                </div>
                <div className="space-y-2">
                  <Label>Label revisi</Label>
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
                eyebrow="Langkah 2"
                title="Tulis observasi"
                description="Ini inti catatan validasi, jadi diberi ruang halaman penuh."
              >
                <div className="space-y-2">
                  <Label>Catatan validasi</Label>
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
                eyebrow="Langkah 3"
                title="Atur konteks tes"
                description="Simpan sumber evidence agar keputusan akhirnya bisa ditelusuri."
              >
                <div className="space-y-2">
                  <Label>Tipe tes</Label>
                  <MobileSegmentedControl options={testTypeOptions} value={formState.test_type} onChange={(value) => setFormState((current) => ({ ...current, test_type: value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal tes</Label>
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
                    placeholder="Nama evaluator opsional"
                    className="rounded-2xl"
                  />
                </div>
              </ValidationStepSection>
            ) : null}

            {step === 3 ? (
              <ValidationStepSection
                icon={ClipboardCheck}
                eyebrow="Langkah 4"
                title="Tentukan hasil"
                description="Tutup loop: setujui, simpan sebagai catatan, atau jadikan item aksi."
              >
                <div className="space-y-2">
                  <Label>Status</Label>
                  <MobileSegmentedControl options={statusOptions} value={formState.status} onChange={(value) => setFormState((current) => ({ ...current, status: value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Aksi lanjutan</Label>
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
        <StickyBottomActionBar fixed reserveSpace keyboardBehavior="stay" aria-label="Validation form actions">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={handleSecondaryAction} disabled={saving}>
              {step === 0 ? 'Batal' : 'Kembali'}
            </Button>
            <Button type="button" className="rounded-2xl" disabled={saving} onClick={handlePrimaryAction}>
              {step === steps.length - 1 ? (saving ? 'Menyimpan...' : saveLabel) : 'Lanjut'}
            </Button>
          </div>
        </StickyBottomActionBar>
      ) : null}

      <MobileSearchableSelector
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        title="Pilih formula"
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
