import React, { useEffect, useMemo, useRef, useState } from 'react';
import { validateFormulaItems } from '@/utils/formulaCalculations.js';
import { duplicateMaterialErrors } from '@/hooks/useFormulaComposer.js';
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
import RawMaterialGuidanceQuickEditDialog from '@/components/RawMaterialGuidanceQuickEditDialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import { createRawMaterial, getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { FORMULA_CATEGORIES, FORMULA_STATUSES } from '@/utils/constants.js';
import { enrichCompositionItems } from '@/utils/mobileFormulaInsights.js';
import { enrichMaterialsWithGuidance, getResolvedGuidanceValues } from '@/utils/mobileRawMaterialGuidance.js';
import { parseLocalizedNumber } from '@/utils/numberInputs.js';
import { useMobileBackNavigation } from '@/hooks/useMobileBackNavigation.js';
import { buildQuickRawMaterialPayload, getQuickMaterialDuplicateCandidates, normalizeQuickMaterialName, upsertMaterialOption } from '@/utils/formulaMaterialQuickCreate.js';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning.js';
import { formulaComposerSnapshot, isFormulaComposerDirty } from '@/utils/formulaComposerDirty.js';

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
  const [legacyAccordItems, setLegacyAccordItems] = useState([]);
  const [formula, setFormula] = useState(null);
  const [originalItems, setOriginalItems] = useState([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('perfume');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  // The formula as it was loaded. Wizard seed rows are deliberately NOT in here: they are unsaved
  // additions, so a page opened with seeds is dirty from the first frame — leaving would lose them.
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [seededCount, setSeededCount] = useState(0);
  const [composerOverlayOpen, setComposerOverlayOpen] = useState(false);
  const [quickCreateIntent, setQuickCreateIntent] = useState(null);
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);
  const [focusMaterialId, setFocusMaterialId] = useState('');
  const [needsGuidanceMaterialId, setNeedsGuidanceMaterialId] = useState('');
  const [guidanceEditorOpen, setGuidanceEditorOpen] = useState(false);
  const [guidanceEditorMaterial, setGuidanceEditorMaterial] = useState(null);
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
        // Legacy accord rows are not editable here, but updateFormula replaces the whole item set — so
        // filtering them out of the editor used to delete them from the formula on the next save. Desktop
        // keeps them aside and blocks the update until they are cleaned up; mobile now keeps them too and
        // re-submits them untouched (audit round 8).
        setLegacyAccordItems((itemRows || []).filter((item) => item.item_type === 'accord'));
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
        setSavedSnapshot(formulaComposerSnapshot({
          name: formulaRow.name || '',
          code: formulaRow.code || '',
          category: formulaRow.category || 'perfume',
          version: formulaRow.version || '',
          status: formulaRow.status || 'draft',
          notes: formulaRow.notes || '',
          formulaItems: formatted,
        }));
        setSeededCount(wizardSeedItems.length);
        if (wizardSeedItems.length) {
          toast.success(`${wizardSeedItems.length} bahan dari wizard dimuat`);
        }
      } catch (error) {
        toast.error('Gagal memuat formula');
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
      toast.info('Bahan sudah ada di komposisi');
      setFocusMaterialId(material.id);
      return false;
    }
    setItems((current) => [createItem(material), ...current]);
    setFocusMaterialId(material.id);
    toast.success('Bahan ditambahkan ke komposisi');
    return true;
  };

  const handleCreateMissingMaterial = ({ name: materialName }) => {
    const nextName = normalizeQuickMaterialName(materialName);
    if (!nextName) return;
    setQuickCreateIntent({ name: nextName });
  };

  const quickCreateDuplicateCandidates = getQuickMaterialDuplicateCandidates(rawMaterials, quickCreateIntent?.name);

  const handleSelectQuickCreateExistingMaterial = (material) => {
    if (!material?.id) return;
    setRawMaterials((current) => upsertMaterialOption(current, material));
    addMaterial(material);
    setQuickCreateIntent(null);
  };

  const handleConfirmQuickCreateMaterial = async (details = {}) => {
    const nextName = normalizeQuickMaterialName(quickCreateIntent?.name);
    if (!nextName) return;

    setQuickCreateLoading(true);
    try {
      const createdMaterial = await createRawMaterial(buildQuickRawMaterialPayload(nextName, details));
      setRawMaterials((current) => upsertMaterialOption(current, createdMaterial));
      addMaterial(createdMaterial);
      if (!createdMaterial?._creationResolution) {
        setNeedsGuidanceMaterialId(createdMaterial.id);
      }
      setQuickCreateIntent(null);
    } catch (error) {
      toast.error(error.message || 'Gagal menambah bahan baku');
    } finally {
      setQuickCreateLoading(false);
    }
  };

  const handleOpenGuidanceEditor = (item) => {
    const material = rawMaterialsById.get(item?.item_id) || item?.material || item;
    if (!material?.id) return;
    setGuidanceEditorMaterial({
      ...material,
      guidance_resolved_values: getResolvedGuidanceValues(material),
    });
    setGuidanceEditorOpen(true);
  };

  const handleGuidanceSaved = (updatedMaterial) => {
    setRawMaterials((current) => current.map((material) => (
      material.id === updatedMaterial.id ? updatedMaterial : material
    )));
    setGuidanceEditorMaterial(updatedMaterial);
    if (updatedMaterial?.id === needsGuidanceMaterialId) {
      setNeedsGuidanceMaterialId('');
    }
  };

  const scrollToMetadata = () => metadataRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleSubmit = async () => {
    if (!name.trim() || !code.trim()) {
      toast.error('Nama dan kode formula wajib diisi');
      scrollToMetadata();
      return;
    }
    if (!items.length || totalGrams <= 0) {
      toast.error('Komposisi butuh minimal satu bahan');
      return;
    }
    // Run the same shared validation the desktop modals run, on the same shape buildItemsForSubmit sends.
    // Mobile skipped it entirely, so an incomplete dilution (a percentage with no solvent) saved silently
    // and came back wrong (audit round 7).
    const itemErrors = validateFormulaItems(itemsWithInsights.map((item) => ({
      item_type: item.item_type,
      item_id: item.item_id,
      gram_amount: item.gram_amount ?? item.gram,
      dilution_percent: item.dilution_type === 'neat' ? '' : (item.concentration_percent || item.dilution_percent),
      dilution_solvent_id: item.dilution_solvent_id,
    })));
    if (itemErrors.length) {
      toast.error(itemErrors[0]);
      return;
    }
    // Same question the desktop composers ask. It used to be buried inside validateComposerFields, which
    // only they call, so the phone would save a formula naming one material twice — and the desktop then
    // refused to save that formula at all.
    const duplicates = Object.values(duplicateMaterialErrors(itemsWithInsights));
    if (duplicates.length) {
      toast.error(`${duplicates[0]} — dua baris memakai bahan yang sama`);
      return;
    }
    try {
      await updateFormula(
        id,
        { name, code, category, version: version || null, status, notes: notes || null },
        [...buildItemsForSubmit(itemsWithInsights), ...legacyAccordItems.map((item) => ({
          item_type: item.item_type,
          item_id: item.item_id,
          percentage: item.percentage,
          grams: item.grams,
          dilution_percent: item.dilution_percent ?? null,
          dilution_solvent_id: item.dilution_solvent_id || null,
          concentrate_amount: item.concentrate_amount ?? null,
        }))],
      );
      toast.success('Revisi disimpan');
      navigate(`/mobile/formulas/${id}`);
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan revisi');
    }
  };

  const currentSnapshot = formulaComposerSnapshot({ name, code, category, version, status, notes, formulaItems: items });
  // Same gap as the desktop editor: no warning of any kind before this.
  useUnsavedChangesWarning(isFormulaComposerDirty(currentSnapshot, savedSnapshot));

  if (loadingData) {
    return (
      <MobileAuthenticatedLayout taskMode>
        <Helmet><title>Memuat editor formula - Solivagant</title></Helmet>
        <MobileLoadingState eyebrow="Editor formula" title="Memuat workbook..." subtitle="Menyelaraskan komposisi dan panduan bahan." />
      </MobileAuthenticatedLayout>
    );
  }

  return (
    <MobileAuthenticatedLayout taskMode>
      <Helmet><title>Edit {name} - Solivagant</title></Helmet>
      <main className="mobile-page space-y-3">
        <MobileTopBar title={name || 'Edit formula'} subtitle={unsaved ? 'Revisi belum disimpan' : 'Workbook siap'} onBack={handleBack} action={<MobileStatusBadge status={status} />} />
        {seededCount ? (
          <section className="mobile-card p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase text-emerald-700">Dari wizard</div>
                <div className="mt-0.5 text-sm font-bold text-[#1f2937]">{seededCount} bahan baru ditambahkan</div>
              </div>
              <MobileStatusBadge status="unsaved">Belum disimpan</MobileStatusBadge>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-[#6b7280]">
              Periksa gram dan pengenceran bahan baru, lalu ketuk Simpan revisi untuk menyimpannya ke formula ini.
            </p>
          </section>
        ) : null}
        <section ref={metadataRef} className="mobile-card scroll-mt-24 p-3">
          <div>
            <div className="text-[10px] font-bold uppercase text-amber-700">Pengaturan formula</div>
            <h2 className="mt-0.5 text-sm font-bold text-[#1f2937]">Data utama</h2>
            <p className="mt-1 text-[11px] font-semibold text-[#6b7280]">Ubah identitas dan status langsung di sini, tanpa membuka lembar tambahan.</p>
          </div>
          <div className="mt-3 grid gap-3">
            <MobileFormField id="mobile-edit-formula-name" label="Nama formula" helper="Nama yang tampil di daftar formula.">
              <Input id="mobile-edit-formula-name" value={name} onChange={(event) => setName(event.target.value)} className="h-10 rounded-xl bg-white text-xs" />
            </MobileFormField>
            <div className="grid grid-cols-2 gap-2">
              <MobileFormField id="mobile-edit-formula-code" label="Kode formula" helper="Kode singkat untuk pencarian.">
                <Input id="mobile-edit-formula-code" value={code} onChange={(event) => setCode(event.target.value)} className="h-10 rounded-xl bg-white text-xs" />
              </MobileFormField>
              <MobileFormField id="mobile-edit-formula-version" label="Versi" helper="Contoh: v2 atau pilot.">
                <Input id="mobile-edit-formula-version" value={version} onChange={(event) => setVersion(event.target.value)} className="h-10 rounded-xl bg-white text-xs" />
              </MobileFormField>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kategori</Label>
              <div className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-xs font-bold text-[#1f2937]">{FORMULA_CATEGORIES.find((option) => option.value === category)?.label || category}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <MobileSegmentedControl options={FORMULA_STATUSES} value={status} onChange={setStatus} />
            </div>
            <MobileFormField id="mobile-edit-formula-notes" label="Catatan" helper="Catatan revisi, evaluasi, atau arahan batch.">
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
          onOpenGuidanceEditor={handleOpenGuidanceEditor}
          focusMaterialId={focusMaterialId}
          needsGuidanceMaterialId={needsGuidanceMaterialId}
          onOpenMetadata={scrollToMetadata}
          onSave={handleSubmit}
          saveLabel="Simpan"
          saving={loading}
          saveDisabled={!unsaved}
          showActionBar={false}
          onOverlayOpenChange={setComposerOverlayOpen}
        />
        <FormulaMaterialQuickCreateDialog
          open={Boolean(quickCreateIntent)}
          materialName={quickCreateIntent?.name || ''}
          duplicateCandidates={quickCreateDuplicateCandidates}
          loading={quickCreateLoading}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setQuickCreateIntent(null);
          }}
          onSelectExisting={handleSelectQuickCreateExistingMaterial}
          onConfirm={handleConfirmQuickCreateMaterial}
        />
        <RawMaterialGuidanceQuickEditDialog
          open={guidanceEditorOpen}
          onOpenChange={setGuidanceEditorOpen}
          material={guidanceEditorMaterial}
          guidanceStatus={null}
          onSaved={handleGuidanceSaved}
        />
        {!composerOverlayOpen && !guidanceEditorOpen ? <StickyBottomActionBar fixed reserveSpace aria-label="Aksi editor formula">
          <div className="grid grid-cols-2 items-stretch gap-2">
            <Button variant="outline" className="h-12 rounded-2xl bg-white text-sm font-bold" onClick={() => navigate(`/mobile/formulas/${id}`)}><X className="mr-1 h-4 w-4" />Batal</Button>
            <Button className="h-12 rounded-2xl text-sm font-bold" onClick={handleSubmit} disabled={loading || !unsaved}>{loading ? 'Menyimpan...' : 'Simpan revisi'}</Button>
          </div>
        </StickyBottomActionBar> : null}
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileEditFormulaPage;

