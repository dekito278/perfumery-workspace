import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import MobileFormField from '@/components/mobile-ui/MobileFormField.jsx';
import MobileFormulaComposerWorkspace from '@/components/mobile/MobileFormulaComposerWorkspace.jsx';
import FormulaMaterialQuickCreateDialog from '@/components/FormulaMaterialQuickCreateDialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import { createRawMaterial, getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { FORMULA_CATEGORIES, FORMULA_STATUSES } from '@/utils/constants.js';
import { enrichCompositionItems } from '@/utils/mobileFormulaInsights.js';
import { enrichMaterialsWithGuidance } from '@/utils/mobileRawMaterialGuidance.js';
import { parseLocalizedNumber } from '@/utils/numberInputs.js';
import { useMobileBackNavigation } from '@/hooks/useMobileBackNavigation.js';
import { buildQuickRawMaterialPayload, normalizeQuickMaterialName, upsertMaterialOption } from '@/utils/formulaMaterialQuickCreate.js';

const createItem = (material, gramAmount = '1', item = {}) => ({
  row_key: `${material.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  item_id: material.id,
  item_type: material.type === 'solvent' ? 'solvent' : 'raw_material',
  gram_amount: String(gramAmount),
  role: item.role || material.reference_abc_primary_family || material.category || '',
  dilution_type: item.dilution_percent ? 'custom' : 'neat',
  dilution_medium: item.dilution_medium || 'DPG',
  concentration_percent: item.dilution_percent ? String(item.dilution_percent) : '100',
  dilution_percent: item.dilution_percent ? String(item.dilution_percent) : '',
  dilution_solvent_id: item.dilution_solvent_id || '',
  notes: item.notes || '',
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

const MobileEditFormulaPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const handleBack = useMobileBackNavigation(`/mobile/formulas/${id}`);
  const [searchParams] = useSearchParams();
  const seedMaterialIdsParam = searchParams.get('materialIds') || '';
  const seedMaterialIds = useMemo(() => String(seedMaterialIdsParam).split(',').map((value) => value.trim()).filter(Boolean), [seedMaterialIdsParam]);
  const { getFormulaById, updateFormula, loading } = useFormulas();
  const { getFormulaItems } = useFormulaItems();
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [formula, setFormula] = useState(null);
  const [originalItems, setOriginalItems] = useState([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('perfume');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [seededCount, setSeededCount] = useState(0);
  const [composerOverlayOpen, setComposerOverlayOpen] = useState(false);
  const [quickCreateIntent, setQuickCreateIntent] = useState(null);
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);
  const [focusMaterialId, setFocusMaterialId] = useState('');
  const metadataRef = useRef(null);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoadingData(true);
      try {
        const [formulaRow, itemRows, materialRows] = await Promise.all([getFormulaById(id), getFormulaItems(id), getRawMaterialOptions()]);
        const enrichedMaterialRows = await enrichMaterialsWithGuidance(materialRows || []);
        if (!active) return;
        setFormula(formulaRow);
        setRawMaterials(enrichedMaterialRows);
        setName(formulaRow.name || '');
        setCode(formulaRow.code || '');
        setCategory(formulaRow.category || 'perfume');
        setVersion(formulaRow.version || '');
        setStatus(formulaRow.status || 'draft');
        setNotes(formulaRow.notes || '');
        const formatted = (itemRows || []).filter((item) => item.item_type !== 'accord').map((item) => {
          const material = enrichedMaterialRows.find((entry) => entry.id === item.item_id);
          return createItem(material || { id: item.item_id, type: item.item_type }, item.grams ?? item.percentage ?? 1, item);
        });
        const existingMaterialIds = new Set(formatted.map((item) => item.item_id));
        const wizardSeedItems = seedMaterialIds.length
          ? enrichedMaterialRows
            .filter((material) => seedMaterialIds.includes(material.id) && !existingMaterialIds.has(material.id))
            .slice(0, 9)
            .map((material) => createItem(material))
          : [];
        const seededItems = wizardSeedItems.length ? [...wizardSeedItems, ...formatted] : formatted;
        setOriginalItems(formatted);
        setItems(seededItems);
        setSeededCount(wizardSeedItems.length);
        if (wizardSeedItems.length) {
          toast.success(`${wizardSeedItems.length} wizard materials loaded`);
        }
      } catch (error) {
        toast.error('Failed to load formula');
        navigate('/mobile/formulas');
      } finally {
        if (active) setLoadingData(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, [getFormulaById, getFormulaItems, id, navigate, seedMaterialIds]);

  const rawMaterialsById = useMemo(() => new Map(rawMaterials.map((material) => [material.id, material])), [rawMaterials]);
  const totalGrams = useMemo(() => items.reduce((sum, item) => sum + parseLocalizedNumber(item.gram_amount), 0), [items]);
  const itemsWithInsights = useMemo(() => enrichCompositionItems(items, totalGrams, rawMaterialsById), [items, rawMaterialsById, totalGrams]);
  const unsaved = useMemo(() => JSON.stringify(items) !== JSON.stringify(originalItems) || name !== (formula?.name || '') || code !== (formula?.code || '') || category !== (formula?.category || 'perfume') || version !== (formula?.version || '') || status !== (formula?.status || 'draft') || notes !== (formula?.notes || ''), [category, code, formula, items, name, notes, originalItems, status, version]);

  const updateItem = (rowKey, field, value) => setItems((current) => current.map((item) => item.row_key === rowKey ? { ...item, [field]: value } : item));
  const removeItem = (rowKey) => setItems((current) => current.filter((item) => item.row_key !== rowKey));
  const addMaterial = (material) => {
    if (items.some((item) => item.item_id === material.id)) {
      toast.info('Material already in composition');
      setFocusMaterialId(material.id);
      return false;
    }
    setItems((current) => [createItem(material), ...current]);
    setFocusMaterialId(material.id);
    toast.success('Material added to composition');
    return true;
  };

  const handleCreateMissingMaterial = ({ name: materialName }) => {
    const nextName = normalizeQuickMaterialName(materialName);
    if (!nextName) return;
    setQuickCreateIntent({ name: nextName });
  };

  const handleConfirmQuickCreateMaterial = async (details = {}) => {
    const nextName = normalizeQuickMaterialName(quickCreateIntent?.name);
    if (!nextName) return;

    setQuickCreateLoading(true);
    try {
      const createdMaterial = await createRawMaterial(buildQuickRawMaterialPayload(nextName, details));
      setRawMaterials((current) => upsertMaterialOption(current, createdMaterial));
      addMaterial(createdMaterial);
      setQuickCreateIntent(null);
    } catch (error) {
      toast.error(error.message || 'Failed to add raw material');
    } finally {
      setQuickCreateLoading(false);
    }
  };

  const scrollToMetadata = () => metadataRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleSubmit = async () => {
    if (!name.trim() || !code.trim()) {
      toast.error('Name and code are required');
      scrollToMetadata();
      return;
    }
    if (!items.length || totalGrams <= 0) {
      toast.error('Composition needs at least one material');
      return;
    }
    try {
      await updateFormula(id, { name, code, category, version: version || null, status, notes: notes || null }, buildItemsForSubmit(itemsWithInsights));
      toast.success('Revision saved');
      navigate(`/mobile/formulas/${id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to save revision');
    }
  };

  if (loadingData) {
    return (
      <MobileAuthenticatedLayout showFab={false}>
        <Helmet><title>Loading Formula Editor - Solivagant</title></Helmet>
        <MobileLoadingState eyebrow="Formula editor" title="Loading workbook..." subtitle="Syncing composition and material guidance." />
      </MobileAuthenticatedLayout>
    );
  }

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet><title>Edit {name} - Solivagant</title></Helmet>
      <main className="mobile-page space-y-3">
        <MobileTopBar title={name || 'Edit Formula'} subtitle={unsaved ? 'Unsaved revision' : 'Workbook ready'} onBack={handleBack} action={<MobileStatusBadge status={status} />} />
        {seededCount ? (
          <section className="mobile-card p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase text-emerald-700">Wizard handoff</div>
                <div className="mt-0.5 text-sm font-bold text-[#1f2937]">{seededCount} new materials added</div>
              </div>
              <MobileStatusBadge status="unsaved" />
            </div>
            <p className="mt-2 text-[11px] font-semibold text-[#6b7280]">
              Review gram dan dilution material baru, lalu Save Revision untuk menyimpan ke formula linked.
            </p>
          </section>
        ) : null}
        <section ref={metadataRef} className="mobile-card scroll-mt-24 p-3">
          <div>
            <div className="text-[10px] font-bold uppercase text-amber-700">Formula setup</div>
            <h2 className="mt-0.5 text-sm font-bold text-[#1f2937]">Metadata utama</h2>
            <p className="mt-1 text-[11px] font-semibold text-[#6b7280]">Edit identity dan status langsung di flow, tanpa membuka sheet tambahan.</p>
          </div>
          <div className="mt-3 grid gap-3">
            <MobileFormField id="mobile-edit-formula-name" label="Formula name" helper="Nama yang tampil di daftar formula.">
              <Input id="mobile-edit-formula-name" value={name} onChange={(event) => setName(event.target.value)} className="h-10 rounded-xl bg-white text-xs" />
            </MobileFormField>
            <div className="grid grid-cols-2 gap-2">
              <MobileFormField id="mobile-edit-formula-code" label="Formula code" helper="Kode singkat untuk pencarian.">
                <Input id="mobile-edit-formula-code" value={code} onChange={(event) => setCode(event.target.value)} className="h-10 rounded-xl bg-white text-xs" />
              </MobileFormField>
              <MobileFormField id="mobile-edit-formula-version" label="Version" helper="Contoh: v2 atau pilot.">
                <Input id="mobile-edit-formula-version" value={version} onChange={(event) => setVersion(event.target.value)} className="h-10 rounded-xl bg-white text-xs" />
              </MobileFormField>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <div className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-xs font-bold text-[#1f2937]">{FORMULA_CATEGORIES.find((option) => option.value === category)?.label || category}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <MobileSegmentedControl options={FORMULA_STATUSES} value={status} onChange={setStatus} />
            </div>
            <MobileFormField id="mobile-edit-formula-notes" label="Notes" helper="Catatan revisi, evaluasi, atau arahan batch.">
              <Textarea id="mobile-edit-formula-notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[90px] rounded-xl bg-white text-xs" />
            </MobileFormField>
          </div>
        </section>
        <MobileFormulaComposerWorkspace
          mode="edit"
          metadata={{ name, code, category, version, status, notes }}
          rawMaterials={rawMaterials}
          items={items}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          onAddMaterial={addMaterial}
          onCreateMissingMaterial={handleCreateMissingMaterial}
          focusMaterialId={focusMaterialId}
          onOpenMetadata={scrollToMetadata}
          onSave={handleSubmit}
          saveLabel="Save"
          saving={loading}
          saveDisabled={!unsaved}
          showActionBar={false}
          onOverlayOpenChange={setComposerOverlayOpen}
        />
        <FormulaMaterialQuickCreateDialog
          open={Boolean(quickCreateIntent)}
          materialName={quickCreateIntent?.name || ''}
          loading={quickCreateLoading}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setQuickCreateIntent(null);
          }}
          onConfirm={handleConfirmQuickCreateMaterial}
        />
        {!composerOverlayOpen ? <StickyBottomActionBar fixed reserveSpace aria-label="Formula editor actions">
          <div className="grid grid-cols-2 items-stretch gap-2">
            <Button variant="outline" className="h-12 rounded-2xl bg-white text-sm font-bold" onClick={() => navigate(`/mobile/formulas/${id}`)}><X className="mr-1 h-4 w-4" />Cancel</Button>
            <Button className="h-12 rounded-2xl text-sm font-bold" onClick={handleSubmit} disabled={loading || !unsaved}>{loading ? 'Saving...' : 'Save Revision'}</Button>
          </div>
        </StickyBottomActionBar> : null}
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileEditFormulaPage;

