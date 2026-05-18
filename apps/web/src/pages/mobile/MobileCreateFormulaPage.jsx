import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import MobileFormField from '@/components/mobile-ui/MobileFormField.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import MobileFormulaComposerWorkspace from '@/components/mobile/MobileFormulaComposerWorkspace.jsx';
import FormulaMaterialQuickCreateDialog from '@/components/FormulaMaterialQuickCreateDialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { getBespokeItem, getOrderById, updateOrderBespokeProductionStatus, updateOrderProductionLinks } from '@/services/orderService.js';
import { createRawMaterial, getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { FORMULA_CATEGORIES, FORMULA_STATUSES } from '@/utils/constants.js';
import { enrichCompositionItems } from '@/utils/mobileFormulaInsights.js';
import { enrichMaterialsWithGuidance } from '@/utils/mobileRawMaterialGuidance.js';
import { parseLocalizedNumber } from '@/utils/numberInputs.js';
import { buildQuickRawMaterialPayload, normalizeQuickMaterialName, upsertMaterialOption } from '@/utils/formulaMaterialQuickCreate.js';

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
  const source = searchParams.get('source') || '';
  const orderId = searchParams.get('orderId') || '';
  const nameParam = searchParams.get('name') || '';
  const notesParam = searchParams.get('notes') || '';
  const seedMaterialIdsParam = searchParams.get('materialIds') || '';
  const seedMaterialIds = useMemo(() => String(seedMaterialIdsParam).split(',').map((value) => value.trim()).filter(Boolean), [seedMaterialIdsParam]);
  const { createFormula, loading } = useFormulas();
  const { getBriefs, updateBrief } = useBriefs();
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [briefContext, setBriefContext] = useState(null);
  const [orderContext, setOrderContext] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category] = useState('perfume');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [seededCount, setSeededCount] = useState(0);
  const [quickCreateIntent, setQuickCreateIntent] = useState(null);
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);
  const [focusMaterialId, setFocusMaterialId] = useState('');
  const itemsRef = useRef(items);
  const metadataRef = useRef(null);

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
        const linkedOrder = source === 'order' && orderId ? await getOrderById(orderId) : null;
        const orderItem = linkedOrder ? getBespokeItem(linkedOrder) : null;
        const baseRows = rows || [];
        const linkedBrief = briefRows.find((brief) => brief.id === briefId) || null;
        if (!active) return;
        setRawMaterials(baseRows);
        setBriefContext(linkedBrief);
        setOrderContext(linkedOrder);
        if (linkedBrief) {
          setName((current) => current || `${linkedBrief.title} formula`);
          setCode((current) => current || buildFormulaCode(linkedBrief.title));
          setNotes((current) => current || linkedBrief.mood_story || linkedBrief.description || '');
        }
        if (linkedOrder) {
          const customer = linkedOrder.customerName || linkedOrder.customerCode || 'Customer';
          const aroma = orderItem?.preferredNotes || orderItem?.notes || orderItem?.mood || 'Bespoke perfume';
          setName((current) => current || nameParam || `${customer} bespoke formula`);
          setCode((current) => current || buildFormulaCode(`${linkedOrder.orderNumber || customer}-BESPOKE`));
          setNotes((current) => current || notesParam || [
            `Order: ${linkedOrder.orderNumber || '-'}`,
            `Customer: ${customer}`,
            orderItem?.size ? `Size: ${orderItem.size}` : '',
            aroma ? `Aroma: ${aroma}` : '',
            orderItem?.occasion ? `Occasion: ${orderItem.occasion}` : '',
            orderItem?.avoidedNotes ? `Avoid: ${orderItem.avoidedNotes}` : '',
            orderItem?.story ? `Story: ${orderItem.story}` : '',
            orderItem?.referenceProductName ? `Reference: ${orderItem.referenceProductName}` : '',
          ].filter(Boolean).join('\n'));
          setStatus((current) => current === 'draft' ? 'in_review' : current);
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
  }, [briefId, getBriefs, nameParam, notesParam, orderId, seedMaterialIds, source]);

  const rawMaterialsById = useMemo(() => new Map(rawMaterials.map((material) => [material.id, material])), [rawMaterials]);
  const totalGrams = useMemo(() => items.reduce((sum, item) => sum + parseLocalizedNumber(item.gram_amount), 0), [items]);
  const itemsWithInsights = useMemo(() => enrichCompositionItems(items, totalGrams, rawMaterialsById), [items, rawMaterialsById, totalGrams]);
  const canCreate = Boolean(name.trim() && code.trim() && items.length && totalGrams > 0);

  const updateItem = (rowKey, field, value) => setItems((current) => current.map((item) => item.row_key === rowKey ? { ...item, [field]: value } : item));
  const removeItem = (rowKey) => setItems((current) => current.filter((item) => item.row_key !== rowKey));
  const addMaterial = (material) => {
    if (itemsRef.current.some((item) => item.item_id === material.id)) {
      toast.info('Material already in composition');
      setFocusMaterialId(material.id);
      return false;
    }

    const nextItems = [createItem(material), ...itemsRef.current];
    itemsRef.current = nextItems;
    setItems(nextItems);
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

  const validate = () => {
    if (!name.trim()) {
      toast.error('Formula name is required');
      scrollToMetadata();
      return false;
    }
    if (!code.trim()) {
      toast.error('Formula code is required');
      scrollToMetadata();
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
      if (orderContext) {
        await updateOrderProductionLinks(orderContext.id || orderContext.orderNumber, {
          ...orderContext.productionLinks,
          batchReference: created.code,
          formulaId: created.id,
          formulaCode: created.code,
          formulaName: created.name,
          sourceOrderId: orderContext.id || '',
          sourceOrderNumber: orderContext.orderNumber || '',
          notes: [
            orderContext.productionLinks?.notes,
            `Formula ${created.code} created from bespoke order ${orderContext.orderNumber || orderContext.id}.`,
          ].filter(Boolean).join('\n'),
        });
        await updateOrderBespokeProductionStatus(orderContext.id || orderContext.orderNumber, 'formula');
      }
      toast.success('Formula created');
      navigate(`/mobile/formulas/${created.id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to create formula');
    }
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet><title>New Mobile Formula - Solivagant</title></Helmet>
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
            {orderContext ? (
              <section className="mobile-soft-card p-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
                    <ClipboardList className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase text-[#263d27]">Order handoff</div>
                    <h2 className="mt-0.5 truncate text-sm font-bold text-[#1f2937]">{orderContext.orderNumber}</h2>
                    <p className="mt-1 mobile-line-clamp-2 text-[11px] font-semibold text-[#6b7280]">
                      Formula will be linked back to {orderContext.customerName || 'this customer'} after create.
                    </p>
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
            <section ref={metadataRef} className="mobile-card scroll-mt-24 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase text-amber-700">Formula setup</div>
                  <h2 className="mt-0.5 text-sm font-bold text-[#1f2937]">Metadata utama</h2>
                  <p className="mt-1 text-[11px] font-semibold text-[#6b7280]">Isi identity formula dulu, lalu lanjut susun composition.</p>
                </div>
                <Button type="button" variant="outline" onClick={() => navigate('/mobile/formulas?action=import')} className="h-10 shrink-0 rounded-2xl bg-white text-xs font-bold">
                  <FileUp className="mr-1 h-4 w-4" />
                  Import
                </Button>
              </div>
              <div className="mt-3 grid gap-3">
                <MobileFormField id="mobile-formula-name" label="Formula name" helper="Nama yang akan terlihat di daftar formula.">
                  <Input id="mobile-formula-name" value={name} onChange={(event) => setName(event.target.value)} className="h-10 rounded-xl bg-white text-xs" required />
                </MobileFormField>
                <div data-mobile-field className="mobile-form-field space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="mobile-formula-code" className="text-xs">Formula code</Label>
                    <button type="button" onClick={() => setCode(buildFormulaCode(name || briefContext?.title))} className="text-[11px] font-bold text-amber-700">Generate</button>
                  </div>
                  <Input id="mobile-formula-code" value={code} onChange={(event) => setCode(event.target.value)} className="h-10 rounded-xl bg-white text-xs" required />
                  <p className="mobile-form-helper text-xs font-medium text-[#6b7280]">Gunakan kode singkat yang mudah dicari.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MobileFormField id="mobile-formula-version" label="Version" helper="Contoh: v1 atau pilot.">
                    <Input id="mobile-formula-version" value={version} onChange={(event) => setVersion(event.target.value)} className="h-10 rounded-xl bg-white text-xs" />
                  </MobileFormField>
                  <div className="space-y-1">
                    <Label className="text-xs">Category</Label>
                    <div className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-xs font-bold text-[#1f2937]">{FORMULA_CATEGORIES.find((option) => option.value === category)?.label || category}</div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <MobileSegmentedControl options={FORMULA_STATUSES} value={status} onChange={setStatus} />
                </div>
                <MobileFormField id="mobile-formula-notes" label="Notes" helper="Catatan opsional untuk revisi atau arah evaluasi.">
                  <Textarea id="mobile-formula-notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[90px] rounded-xl bg-white text-xs" />
                </MobileFormField>
              </div>
            </section>
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
            <MobileFormulaComposerWorkspace
              mode="create"
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
              saveLabel="Create"
              saving={loading}
              saveDisabled={!canCreate}
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
          </>
        )}
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileCreateFormulaPage;

