import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useBriefProjects } from '@/hooks/useBriefProjects.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { generateBriefRecommendations } from '@/utils/briefRecommendationEngine.js';

const createEmptyBrief = (formulaId = 'none') => ({
  title: '',
  formula_id: formulaId || 'none',
  status: 'draft',
  mood_story: '',
  audience_usage: '',
  performance_target: '',
  budget_direction: '',
});

const buildAutoFormulaCode = (title) => {
  const normalizedTitle = String(title || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  return `${normalizedTitle || 'FORMULA'}-${Date.now()}`;
};

const BriefEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryFormulaId = searchParams.get('formulaId') || 'none';
  const isEditMode = Boolean(id);
  const { getBriefs, createBrief, updateBrief } = useBriefs();
  const { ensureBriefProject } = useBriefProjects();
  const { getFormulas, createFormula } = useFormulas();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formulas, setFormulas] = useState([]);
  const [formState, setFormState] = useState(createEmptyBrief(queryFormulaId));
  const [descriptionInput, setDescriptionInput] = useState('');

  useEffect(() => {
    let active = true;

    const loadEditor = async () => {
      setLoading(true);
      try {
        const [formulaRows, briefRows] = await Promise.all([
          getFormulas(),
          isEditMode ? getBriefs() : Promise.resolve([]),
        ]);

        if (!active) {
          return;
        }

        setFormulas(formulaRows);

        if (isEditMode) {
          const brief = briefRows.find((item) => item.id === id) || null;
          if (!brief) {
            toast.error('Brief not found');
            navigate('/briefs');
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
        } else {
          setFormState(createEmptyBrief(queryFormulaId));
        }
      } catch (error) {
        toast.error('Failed to load brief editor');
        navigate('/briefs');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadEditor();

    return () => {
      active = false;
    };
  }, [getBriefs, getFormulas, id, isEditMode, navigate, queryFormulaId]);

  const pageTitle = useMemo(
    () => (isEditMode ? 'Edit Brief - Formulation Workspace' : 'New Brief - Formulation Workspace'),
    [isEditMode]
  );

  const handleChange = (field, value) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleGenerateRecommendations = () => {
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

    toast.success('Brief recommendations generated');
  };

  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from, { state: { restoreScroll: true } });
      return;
    }

    navigate('/briefs');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formState.title.trim()) {
      toast.error('Brief title is required');
      return;
    }

    setSaving(true);
    try {
      const shouldAutoCreateFormula = formState.formula_id === 'none';
      const basePayload = {
        ...formState,
        formula_id: formState.formula_id === 'none' ? null : formState.formula_id,
      };

      const initialBrief = isEditMode
        ? await updateBrief(id, basePayload)
        : await createBrief(basePayload);

      const linkedFormula = shouldAutoCreateFormula
        ? await createFormula({
            name: formState.title.trim(),
            code: buildAutoFormulaCode(formState.title),
            category: 'perfume',
            status: 'draft',
            notes: formState.mood_story || null,
          }, [])
        : null;

      const savedBrief = linkedFormula
        ? await updateBrief(initialBrief.id, {
            ...basePayload,
            formula_id: linkedFormula.id,
          })
        : initialBrief;

      const targetFormulaId = linkedFormula?.id || basePayload.formula_id || '';
      toast.success(
        targetFormulaId
          ? (isEditMode ? 'Brief updated. Opening formula workspace...' : 'Brief and formula created. Opening formula workspace...')
          : (isEditMode ? 'Brief updated. Opening project board...' : 'Brief saved. Opening project board...')
      );

      try {
        const project = await ensureBriefProject(savedBrief.id);

        if (targetFormulaId) {
          navigate({
            pathname: `/formulas/${targetFormulaId}/edit`,
            search: `?briefId=${savedBrief.id}${project?.id ? `&projectId=${project.id}` : ''}&openBriefWizard=1`,
          });
          return;
        }
      } catch (projectError) {
        console.error('Failed to ensure brief project:', projectError);
        if (targetFormulaId) {
          navigate({
            pathname: `/formulas/${targetFormulaId}/edit`,
            search: `?briefId=${savedBrief.id}&openBriefWizard=1`,
          });
          return;
        }

        toast.error(
          isEditMode
            ? 'Brief updated, but the project board could not be opened.'
            : 'Brief saved, but the project board could not be opened.'
        );
        navigate('/briefs');
        return;
      }

      navigate({
        pathname: `/briefs/${savedBrief.id}`,
        search: '?openWizard=1',
      }, {
        state: { from: '/briefs' },
      });
    } catch (error) {
      toast.error(isEditMode ? 'Failed to update brief' : 'Failed to save brief');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content="Create or edit a formulation brief before opening its project board." />
      </Helmet>

      <div className="page-container space-y-6">
        <div>
          <Button variant="ghost" onClick={handleBack} className="mb-4 gap-2 h-9">
            <ArrowLeft className="w-4 h-4" />
            Back to briefs
          </Button>
        </div>

        <div className="rounded-[30px] border bg-[linear-gradient(135deg,rgba(255,255,255,0.97)_0%,rgba(246,241,232,0.98)_100%)] p-6 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full border bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5 text-primary" />
            Brief editor
          </div>
          <h1 className="mt-4 text-3xl font-bold" style={{ letterSpacing: '-0.02em' }}>
            {isEditMode ? 'Edit brief.' : 'Start a new brief.'}
          </h1>
          <p className="mt-3 max-w-3xl text-base text-muted-foreground">
            Simpan arah formula dulu, lalu lanjutkan langsung ke project board untuk shortlist dan formula.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-5">
              <div className="rounded-[28px] border bg-white/90 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <WandSparkles className="h-4 w-4 text-amber-700" />
                  Describe first
                </div>
                <div className="mt-4 space-y-3">
                  <Textarea
                    value={descriptionInput}
                    onChange={(event) => setDescriptionInput(event.target.value)}
                    className="min-h-[150px] bg-white/85"
                    placeholder="Contoh: rose kering, panas, elegan, breathable, cocok untuk sore sampai malam..."
                  />
                  <Button type="button" variant="outline" className="rounded-2xl gap-2" onClick={handleGenerateRecommendations}>
                    Generate recommendation
                    <WandSparkles className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-[28px] border bg-white/90 p-5 shadow-sm">
                <div className="text-sm font-semibold">Brief identity</div>
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Title</div>
                    <Input
                      value={formState.title}
                      onChange={(event) => handleChange('title', event.target.value)}
                      placeholder="Office citrus skin, dense resin evening, airy floral laundry..."
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Status</div>
                      <Select value={formState.status} onValueChange={(value) => handleChange('status', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Linked formula</div>
                      <Select value={formState.formula_id} onValueChange={(value) => handleChange('formula_id', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Optional formula link" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No linked formula yet (auto-create new)</SelectItem>
                          {formulas.map((formula) => (
                            <SelectItem key={formula.id} value={formula.id}>
                              {formula.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Jika tetap kosong, sistem akan otomatis membuat formula draft baru memakai title brief ini lalu langsung membuka workspace formula.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border bg-white/90 p-5 shadow-sm">
              <div className="text-sm font-semibold">Direction details</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Mood and story</div>
                  <Textarea
                    value={formState.mood_story}
                    onChange={(event) => handleChange('mood_story', event.target.value)}
                    className="min-h-[160px]"
                    placeholder="What world should the fragrance open?"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Audience and usage</div>
                  <Textarea
                    value={formState.audience_usage}
                    onChange={(event) => handleChange('audience_usage', event.target.value)}
                    className="min-h-[160px]"
                    placeholder="Who is this for, where will it be worn, and how should it feel?"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Performance target</div>
                  <Textarea
                    value={formState.performance_target}
                    onChange={(event) => handleChange('performance_target', event.target.value)}
                    className="min-h-[160px]"
                    placeholder="Opening lift, heart body, drydown persistence, diffusion, skin comfort..."
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Budget and direction</div>
                  <Textarea
                    value={formState.budget_direction}
                    onChange={(event) => handleChange('budget_direction', event.target.value)}
                    className="min-h-[160px]"
                    placeholder="Budget ceiling, natural vs synthetic leaning, hero material constraints..."
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button type="submit" className="rounded-2xl" disabled={saving}>
                  {saving ? 'Saving...' : isEditMode ? 'Update brief' : 'Start formula wizard'}
                </Button>
                <Button type="button" variant="outline" className="rounded-2xl" onClick={handleBack} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default BriefEditorPage;
