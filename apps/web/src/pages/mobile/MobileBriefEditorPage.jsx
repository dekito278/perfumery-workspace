import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileSearchableSelector from '@/components/mobile-ui/MobileSearchableSelector.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import MobileFormField from '@/components/mobile-ui/MobileFormField.jsx';
import { useMobileBackNavigation } from '@/hooks/useMobileBackNavigation.js';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useBriefProjects } from '@/hooks/useBriefProjects.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { generateBriefRecommendations } from '@/utils/briefRecommendationEngine.js';

const steps = [
  { value: 'idea', label: 'Idea' },
  { value: 'direction', label: 'Direction' },
  { value: 'identity', label: 'Identity' },
  { value: 'review', label: 'Review' },
];

const createEmptyBrief = (formulaId = 'none') => ({
  title: '',
  formula_id: formulaId || 'none',
  status: 'draft',
  mood_story: '',
  audience_usage: '',
  performance_target: '',
  budget_direction: '',
});

const buildAutoFormulaCode = (title) => `${String(title || 'FORMULA').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'FORMULA'}-${Date.now()}`;

const MobileBriefEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryFormulaId = searchParams.get('formulaId') || 'none';
  const isEditMode = Boolean(id);
  const { getBriefs, createBrief, updateBrief } = useBriefs();
  const { ensureBriefProject } = useBriefProjects();
  const { getFormulas, createFormula } = useFormulas();
  const [step, setStep] = useState('idea');
  const [formulas, setFormulas] = useState([]);
  const [formState, setFormState] = useState(createEmptyBrief(queryFormulaId));
  const [descriptionInput, setDescriptionInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formulaSelectorOpen, setFormulaSelectorOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const loadEditor = async () => {
      setLoading(true);
      try {
        const [formulaRows, briefRows] = await Promise.all([getFormulas(), isEditMode ? getBriefs() : Promise.resolve([])]);
        if (!active) return;
        setFormulas(formulaRows || []);
        if (isEditMode) {
          const brief = briefRows.find((item) => item.id === id);
          if (!brief) {
            toast.error('Brief not found');
            navigate('/mobile/briefs');
            return;
          }
          setFormState({
            title: brief.title || '',
            formula_id: brief.formula_id || 'none',
            status: brief.status || 'draft',
            mood_story: brief.mood_story || '',
            audience_usage: brief.audience_usage || '',
            performance_target: brief.performance_target || '',
            budget_direction: brief.budget_direction || '',
          });
        }
      } catch (error) {
        toast.error('Failed to load brief editor');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadEditor();
    return () => { active = false; };
  }, [getBriefs, getFormulas, id, isEditMode, navigate]);

  const linkedFormula = useMemo(() => formulas.find((formula) => formula.id === formState.formula_id), [formState.formula_id, formulas]);
  const currentIndex = steps.findIndex((item) => item.value === step);
  const setField = (field, value) => setFormState((current) => ({ ...current, [field]: value }));
  const goNext = () => setStep(steps[Math.min(currentIndex + 1, steps.length - 1)].value);
  const returnToParent = useMobileBackNavigation(isEditMode ? `/mobile/briefs/${id}` : '/mobile/briefs');
  const goBack = () => currentIndex === 0 ? returnToParent() : setStep(steps[Math.max(currentIndex - 1, 0)].value);

  const handleGenerate = () => {
    const recommendation = generateBriefRecommendations(descriptionInput);
    if (!recommendation) {
      toast.error('Add a short description first');
      return;
    }
    setFormState((current) => ({
      ...current,
      title: current.title || recommendation.title || current.title,
      mood_story: recommendation.mood_story,
      audience_usage: recommendation.audience_usage,
      performance_target: recommendation.performance_target,
      budget_direction: recommendation.budget_direction,
    }));
    toast.success('Recommendation generated');
    setStep('direction');
  };

  const handleSubmit = async () => {
    if (!formState.title.trim()) {
      toast.error('Brief title is required');
      setStep('identity');
      return;
    }
    setSaving(true);
    try {
      const shouldAutoCreateFormula = formState.formula_id === 'none';
      const basePayload = { ...formState, formula_id: shouldAutoCreateFormula ? null : formState.formula_id };
      const initialBrief = isEditMode ? await updateBrief(id, basePayload) : await createBrief(basePayload);
      const linkedFormulaRow = shouldAutoCreateFormula ? await createFormula({
        name: formState.title.trim(),
        code: buildAutoFormulaCode(formState.title),
        category: 'perfume',
        status: 'draft',
        notes: formState.mood_story || null,
      }, []) : null;
      const savedBrief = linkedFormulaRow ? await updateBrief(initialBrief.id, { ...basePayload, formula_id: linkedFormulaRow.id }) : initialBrief;
      try {
        await ensureBriefProject(savedBrief.id);
      } catch (projectError) {
        console.error('Failed to ensure mobile brief project:', projectError);
      }
      toast.success(isEditMode ? 'Brief updated' : 'Brief created');
      navigate(`/mobile/briefs/${savedBrief.id}`);
    } catch (error) {
      toast.error(isEditMode ? 'Failed to update brief' : 'Failed to create brief');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet><title>{isEditMode ? 'Edit Mobile Brief' : 'New Mobile Brief'} - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title={isEditMode ? 'Edit Brief' : 'New Brief'} onBack={goBack} action={<WandSparkles className="h-6 w-6 text-amber-600" />} />
        <MobileSegmentedControl options={steps} value={step} onChange={setStep} />
        {loading ? <MobileLoadingState eyebrow="Brief editor" title="Loading editor..." subtitle="Preparing formulas and brief details." className="min-h-[calc(100dvh-260px)]" /> : (
          <section className="mobile-card p-4">
            {step === 'idea' ? (
              <div className="space-y-4">
                <MobileFormField label="Describe idea" helper="Tulis ringkasan yang cukup jelas agar rekomendasi awal lebih tepat.">
                  <Textarea value={descriptionInput} onChange={(event) => setDescriptionInput(event.target.value)} className="min-h-[180px] rounded-2xl bg-white" placeholder="Rose kering, panas, elegan, breathable..." />
                </MobileFormField>
                <Button type="button" variant="outline" onClick={handleGenerate} className="w-full rounded-2xl bg-white">Generate Recommendation</Button>
              </div>
            ) : null}
            {step === 'direction' ? (
              <div className="grid gap-4">
                <MobileFormField label="Mood and story" helper="Nuansa, emosi, dan cerita yang ingin dibawa."><Textarea value={formState.mood_story} onChange={(event) => setField('mood_story', event.target.value)} className="min-h-[120px] rounded-2xl" /></MobileFormField>
                <MobileFormField label="Audience and usage" helper="Siapa yang memakai dan kapan dipakai."><Textarea value={formState.audience_usage} onChange={(event) => setField('audience_usage', event.target.value)} className="min-h-[120px] rounded-2xl" /></MobileFormField>
                <MobileFormField label="Performance target" helper="Ekspektasi projection, longevity, atau feel pemakaian."><Textarea value={formState.performance_target} onChange={(event) => setField('performance_target', event.target.value)} className="min-h-[120px] rounded-2xl" /></MobileFormField>
                <MobileFormField label="Budget and direction" helper="Batas biaya atau batasan bahan bila ada."><Textarea value={formState.budget_direction} onChange={(event) => setField('budget_direction', event.target.value)} className="min-h-[120px] rounded-2xl" /></MobileFormField>
              </div>
            ) : null}
            {step === 'identity' ? (
              <div className="grid gap-4">
                <MobileFormField label="Title" helper="Nama singkat yang mudah dikenali tim."><Input value={formState.title} onChange={(event) => setField('title', event.target.value)} className="rounded-2xl" required /></MobileFormField>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <MobileSegmentedControl options={[{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]} value={formState.status} onChange={(value) => setField('status', value)} />
                </div>
                <div className="space-y-2">
                  <Label>Linked formula</Label>
                  <button type="button" onClick={() => setFormulaSelectorOpen(true)} className="mobile-card w-full p-4 text-left text-sm font-bold">
                    {linkedFormula?.name || 'Auto-create new'}
                  </button>
                </div>
              </div>
            ) : null}
            {step === 'review' ? (
              <div className="space-y-3">
                {[
                  ['Title', formState.title || 'Untitled'],
                  ['Status', formState.status],
                  ['Formula', linkedFormula?.name || 'Auto-create new'],
                  ['Mood', formState.mood_story || '-'],
                  ['Audience', formState.audience_usage || '-'],
                  ['Performance', formState.performance_target || '-'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-[#f8f7f4] p-3">
                    <div className="text-[11px] font-bold uppercase text-[#9ca3af]">{label}</div>
                    <div className="mt-1 text-sm font-semibold text-[#1f2937]">{value}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        )}
        <StickyBottomActionBar fixed reserveSpace keyboardBehavior="stay" aria-label="Brief editor actions">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={goBack} className="rounded-2xl bg-white">{currentIndex === 0 ? 'Cancel' : 'Back'}</Button>
            {step === 'review' ? (
              <Button type="button" onClick={handleSubmit} disabled={saving} className="rounded-2xl">{saving ? 'Saving...' : isEditMode ? 'Update Brief' : 'Create Brief'}</Button>
            ) : (
              <Button type="button" onClick={goNext} className="rounded-2xl">Continue</Button>
            )}
          </div>
        </StickyBottomActionBar>
      </main>
      <MobileSearchableSelector
        open={formulaSelectorOpen}
        onOpenChange={setFormulaSelectorOpen}
        title="Linked formula"
        options={[{ id: 'none', name: 'No linked formula yet', code: 'Auto-create new' }, ...formulas]}
        onSelect={(formula) => setField('formula_id', formula.id)}
        getLabel={(formula) => formula.name}
        getMeta={(formula) => formula.code}
      />
    </MobileAuthenticatedLayout>
  );
};

export default MobileBriefEditorPage;

