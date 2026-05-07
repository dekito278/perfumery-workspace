import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, FileUp, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import MobileFormulaComposerWorkspace from '@/components/mobile/MobileFormulaComposerWorkspace.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { FORMULA_CATEGORIES, FORMULA_STATUSES } from '@/utils/constants.js';
import { enrichCompositionItems } from '@/utils/mobileFormulaInsights.js';
import { enrichMaterialsWithGuidance } from '@/utils/mobileRawMaterialGuidance.js';
import { parseLocalizedNumber } from '@/utils/numberInputs.js';

const createItem = (material, gramAmount = '1') => ({
  row_key: `${material.id}-${Date.now()}`,
  item_id: material.id,
  item_type: material.type === 'solvent' ? 'solvent' : 'raw_material',
  gram_amount: String(gramAmount),
  role: material.reference_abc_primary_family || material.category || '',
  dilution_type: 'neat',
  dilution_medium: 'DPG',
  concentration_percent: '100',
  dilution_percent: '',
  dilution_solvent_id: '',
  notes: '',
});

const buildItemsForSubmit = (itemsWithInsights) => itemsWithInsights.map((item) => ({
  item_type: item.item_type,
  item_id: item.item_id,
  percentage: item.formulaPercent,
  grams: parseLocalizedNumber(item.gram_amount ?? item.gram),
  dilution_percent: item.dilution_type === 'neat' ? null : parseLocalizedNumber(item.concentration_percent || item.dilution_percent),
  dilution_solvent_id: item.dilution_solvent_id || null,
  concentrate_amount: item.dilution_type === 'neat' ? null : Number(((parseLocalizedNumber(item.gram_amount) * parseLocalizedNumber(item.concentration_percent || item.dilution_percent)) / 100).toFixed(3)),
}));

const buildFormulaCode = (source = '') => {
  const clean = String(source || 'FORMULA')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18);
  return `${clean || 'FORMULA'}-${Date.now()}`;
};

const MobileCreateFormulaPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const briefId = searchParams.get('briefId') || '';
  const seedMaterialIdsParam = searchParams.get('materialIds') || '';
  const seedMaterialIds = useMemo(() => String(seedMaterialIdsParam).split(',').map((value) => value.trim()).filter(Boolean), [seedMaterialIdsParam]);
  const { createFormula, loading } = useFormulas();
  const { getBriefs, updateBrief } = useBriefs();
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [briefContext, setBriefContext] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('perfume');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [seededCount, setSeededCount] = useState(0);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    let active = true;
    const loadMaterials = async () => {
      setLoadingData(true);
      try {
        const [rows, briefRows] = await Promise.all([
          getRawMaterialOptions(),
          briefId ? getBriefs() : Promise.resolve([]),
        ]);
        const baseRows = rows || [];
        const linkedBrief = briefRows.find((brief) => brief.id === briefId) || null;
        if (!active) return;
        setRawMaterials(baseRows);
        setBriefContext(linkedBrief);
        if (linkedBrief) {
          setName((current) => current || `${linkedBrief.title} formula`);
          setCode((current) => current || buildFormulaCode(linkedBrief.title));
          setNotes((current) => current || linkedBrief.mood_story || linkedBrief.description || '');
        }
        if (seedMaterialIds.length) {
          const seededItems = baseRows
            .filter((material) => seedMaterialIds.includes(material.id))
            .slice(0, 9)
            .map((material) => createItem(material));
          setItems(seededItems);
          setSeededCount(seededItems.length);
          if (seededItems.length) {
            toast.success(`${seededItems.length} wizard materials loaded`);
          }
        }
        setLoadingData(false);

        const enrichedRows = await enrichMaterialsWithGuidance(baseRows);
        if (active) {
          setRawMaterials(enrichedRows);
        }
      } catch (error) {
        toast.error('Failed to load materials');
      } finally {
        if (active) setLoadingData(false);
      }
    };
    loadMaterials();
    return () => { active = false; };
  }, [briefId, getBriefs, seedMaterialIds]);

  const rawMaterialsById = useMemo(() => new Map(rawMaterials.map((material) => [material.id, material])), [rawMaterials]);
  const totalGrams = useMemo(() => items.reduce((sum, item) => sum + parseLocalizedNumber(item.gram_amount), 0), [items]);
  const itemsWithInsights = useMemo(() => enrichCompositionItems(items, totalGrams, rawMaterialsById), [items, rawMaterialsById, totalGrams]);
  const canCreate = Boolean(name.trim() && code.trim() && items.length && totalGrams > 0);

  const updateItem = (rowKey, field, value) => setItems((current) => current.map((item) => item.row_key === rowKey ? { ...item, [field]: value } : item));
  const removeItem = (rowKey) => setItems((current) => current.filter((item) => item.row_key !== rowKey));
  const addMaterial = (material) => {
    if (itemsRef.current.some((item) => item.item_id === material.id)) {
      toast.info('Material already in composition');
      return;
    }

    const nextItems = [createItem(material), ...itemsRef.current];
    itemsRef.current = nextItems;
    setItems(nextItems);
    toast.success('Material added to composition');
  };

  const validate = () => {
    if (!name.trim()) {
      toast.error('Formula name is required');
      setMetadataOpen(true);
      return false;
    }
    if (!code.trim()) {
      toast.error('Formula code is required');
      setMetadataOpen(true);
      return false;
    }
    if (!items.length || totalGrams <= 0) {
      toast.error('Add composition materials first');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      const created = await createFormula({ name, code, category, version: version || null, status, notes: notes || null }, buildItemsForSubmit(itemsWithInsights));
      if (briefContext && briefContext.formula_id !== created.id) {
        await updateBrief(briefContext.id, {
          ...briefContext,
          formula_id: created.id,
        });
      }
      toast.success('Formula created');
      navigate(`/mobile/formulas/${created.id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to create formula');
    }
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet><title>New Mobile Formula - Solivagant Studio</title></Helmet>
      <main className="mobile-page space-y-3">
        <MobileTopBar title={name || 'New Formula'} subtitle={code || undefined} onBack={() => navigate('/mobile/formulas')} action={<MobileStatusBadge status={status} />} />
        {loadingData ? <MobileLoadingState eyebrow="Formula composer" title="Loading composer..." subtitle="Preparing material guidance." className="min-h-[calc(100dvh-260px)]" /> : (
          <>
            {briefContext ? (
              <section className="mobile-soft-card p-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
                    <ClipboardList className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase text-amber-700">Brief linked</div>
                    <h2 className="mt-0.5 truncate text-sm font-bold text-[#1f2937]">{briefContext.title}</h2>
                    <p className="mt-1 mobile-line-clamp-2 text-[11px] font-semibold text-[#6b7280]">{briefContext.mood_story || briefContext.description || 'Formula will be attached to this brief after create.'}</p>
                  </div>
                </div>
              </section>
            ) : null}
            {seededCount ? (
              <section className="mobile-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-emerald-700">Wizard handoff</div>
                    <div className="mt-0.5 text-sm font-bold text-[#1f2937]">{seededCount} materials ready</div>
                  </div>
                  <MobileStatusBadge status="loaded" />
                </div>
                <p className="mt-2 text-[11px] font-semibold text-[#6b7280]">
                  Material pilihan brief sudah masuk composition board. Atur gram, dilution, lalu simpan formula.
                </p>
              </section>
            ) : null}
            {!canCreate ? (
              <section className="mobile-card p-3">
                <div className="text-[10px] font-bold uppercase text-amber-700">Setup checklist</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                  <span className={`rounded-xl border px-2 py-2 ${name.trim() && code.trim() ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>Metadata</span>
                  <span className={`rounded-xl border px-2 py-2 ${items.length ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>Materials</span>
                  <span className={`rounded-xl border px-2 py-2 ${totalGrams > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>Grams</span>
                </div>
              </section>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setMetadataOpen(true)} className="h-10 rounded-2xl bg-white text-xs font-bold">
                <WandSparkles className="mr-1 h-4 w-4" />
                Metadata
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/mobile/formulas?action=import')} className="h-10 rounded-2xl bg-white text-xs font-bold">
                <FileUp className="mr-1 h-4 w-4" />
                Import PDF
              </Button>
            </div>
            <MobileFormulaComposerWorkspace
              mode="create"
              metadata={{ name, code, category, version, status, notes }}
              rawMaterials={rawMaterials}
              items={items}
              onUpdateItem={updateItem}
              onRemoveItem={removeItem}
              onAddMaterial={addMaterial}
              onOpenMetadata={() => setMetadataOpen(true)}
              onSave={handleSubmit}
              saveLabel="Create"
              saving={loading}
              saveDisabled={!canCreate}
            />
          </>
        )}
      </main>
      <MobileBottomSheet open={metadataOpen} onOpenChange={setMetadataOpen} title="Formula Metadata" footer={<Button className="h-10 w-full rounded-xl text-xs" onClick={() => setMetadataOpen(false)}>Save Metadata</Button>}>
        <div className="grid gap-3 pb-2">
          <div className="space-y-1"><Label htmlFor="mobile-formula-name" className="text-xs">Formula name</Label><Input id="mobile-formula-name" value={name} onChange={(event) => setName(event.target.value)} className="h-10 rounded-xl bg-white text-xs" /></div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="mobile-formula-code" className="text-xs">Formula code</Label>
              <button type="button" onClick={() => setCode(buildFormulaCode(name || briefContext?.title))} className="text-[11px] font-bold text-amber-700">Generate</button>
            </div>
            <Input id="mobile-formula-code" value={code} onChange={(event) => setCode(event.target.value)} className="h-10 rounded-xl bg-white text-xs" />
          </div>
          <div className="space-y-1"><Label className="text-xs">Category</Label><button type="button" onClick={() => setCategoryOpen(true)} className="mobile-card w-full p-3 text-left text-xs font-bold">{category}</button></div>
          <div className="space-y-1"><Label htmlFor="mobile-formula-version" className="text-xs">Version</Label><Input id="mobile-formula-version" value={version} onChange={(event) => setVersion(event.target.value)} className="h-10 rounded-xl bg-white text-xs" /></div>
          <div className="space-y-1"><Label className="text-xs">Status</Label><MobileSegmentedControl options={FORMULA_STATUSES} value={status} onChange={setStatus} /></div>
          <div className="space-y-1"><Label htmlFor="mobile-formula-notes" className="text-xs">Notes</Label><Textarea id="mobile-formula-notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[90px] rounded-xl bg-white text-xs" /></div>
        </div>
      </MobileBottomSheet>
      <MobileBottomSheet open={categoryOpen} onOpenChange={setCategoryOpen} title="Formula Category">
        <div className="grid gap-2 pb-2">
          {FORMULA_CATEGORIES.map((option) => (
            <button key={option.value} type="button" onClick={() => { setCategory(option.value); setCategoryOpen(false); }} className="mobile-card w-full p-3 text-left text-sm font-bold">
              {option.label}
            </button>
          ))}
        </div>
      </MobileBottomSheet>
    </MobileAuthenticatedLayout>
  );
};

export default MobileCreateFormulaPage;

