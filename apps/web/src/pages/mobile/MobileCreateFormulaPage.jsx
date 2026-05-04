import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { FORMULA_STATUSES } from '@/utils/constants.js';
import { enrichCompositionItems } from '@/utils/mobileFormulaInsights.js';
import { enrichMaterialsWithGuidance } from '@/utils/mobileRawMaterialGuidance.js';

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
  grams: Number(item.gram_amount || item.gram || 0),
  dilution_percent: item.dilution_type === 'neat' ? null : Number(item.concentration_percent || item.dilution_percent || 0),
  dilution_solvent_id: item.dilution_solvent_id || null,
  concentrate_amount: item.dilution_type === 'neat' ? null : Number(((Number(item.gram_amount || 0) * Number(item.concentration_percent || item.dilution_percent || 0)) / 100).toFixed(3)),
}));

const MobileCreateFormulaPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const seedMaterialIds = useMemo(() => String(searchParams.get('materialIds') || '').split(',').map((value) => value.trim()).filter(Boolean), [searchParams]);
  const { createFormula, loading } = useFormulas();
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [metadataOpen, setMetadataOpen] = useState(true);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('perfume');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    const loadMaterials = async () => {
      setLoadingData(true);
      try {
        const rows = await getRawMaterialOptions();
        const enrichedRows = await enrichMaterialsWithGuidance(rows || []);
        if (!active) return;
        setRawMaterials(enrichedRows);
        if (seedMaterialIds.length) {
          setItems(enrichedRows.filter((material) => seedMaterialIds.includes(material.id)).slice(0, 5).map((material) => createItem(material)));
        }
      } catch (error) {
        toast.error('Failed to load materials');
      } finally {
        if (active) setLoadingData(false);
      }
    };
    loadMaterials();
    return () => { active = false; };
  }, [seedMaterialIds]);

  const rawMaterialsById = useMemo(() => new Map(rawMaterials.map((material) => [material.id, material])), [rawMaterials]);
  const totalGrams = useMemo(() => items.reduce((sum, item) => sum + Number(item.gram_amount || 0), 0), [items]);
  const itemsWithInsights = useMemo(() => enrichCompositionItems(items, totalGrams, rawMaterialsById), [items, rawMaterialsById, totalGrams]);

  const updateItem = (rowKey, field, value) => setItems((current) => current.map((item) => item.row_key === rowKey ? { ...item, [field]: value } : item));
  const removeItem = (rowKey) => setItems((current) => current.filter((item) => item.row_key !== rowKey));
  const addMaterial = (material) => {
    if (items.some((item) => item.item_id === material.id)) {
      toast.info('Material already in composition');
      return;
    }
    setItems((current) => [...current, createItem(material)]);
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
      toast.success('Formula created');
      navigate(`/mobile/formulas/${created.id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to create formula');
    }
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet><title>New Mobile Formula - Perfumer Studio</title></Helmet>
      <main className="mobile-page space-y-3">
        <MobileTopBar title={name || 'New Formula'} subtitle={code || undefined} onBack={() => navigate('/mobile/formulas')} action={<MobileStatusBadge status={status} />} />
        {loadingData ? <MobileLoadingState eyebrow="Formula composer" title="Loading composer..." subtitle="Preparing material guidance." className="min-h-[calc(100dvh-260px)]" /> : (
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
            saveDisabled={false}
          />
        )}
      </main>
      <MobileBottomSheet open={metadataOpen} onOpenChange={setMetadataOpen} title="Formula Metadata" footer={<Button className="h-10 w-full rounded-xl text-xs" onClick={() => setMetadataOpen(false)}>Save Metadata</Button>}>
        <div className="grid gap-3 pb-2">
          <div className="space-y-1"><Label className="text-xs">Formula name</Label><Input value={name} onChange={(event) => setName(event.target.value)} className="h-10 rounded-xl bg-white text-xs" /></div>
          <div className="space-y-1"><Label className="text-xs">Formula code</Label><Input value={code} onChange={(event) => setCode(event.target.value)} className="h-10 rounded-xl bg-white text-xs" /></div>
          <div className="space-y-1"><Label className="text-xs">Category</Label><button type="button" onClick={() => setCategoryOpen(true)} className="mobile-card w-full p-3 text-left text-xs font-bold">{category}</button></div>
          <div className="space-y-1"><Label className="text-xs">Version</Label><Input value={version} onChange={(event) => setVersion(event.target.value)} className="h-10 rounded-xl bg-white text-xs" /></div>
          <div className="space-y-1"><Label className="text-xs">Status</Label><MobileSegmentedControl options={FORMULA_STATUSES} value={status} onChange={setStatus} /></div>
          <div className="space-y-1"><Label className="text-xs">Notes</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[90px] rounded-xl bg-white text-xs" /></div>
        </div>
      </MobileBottomSheet>
      <MobileBottomSheet open={categoryOpen} onOpenChange={setCategoryOpen} title="Formula Category">
        <button type="button" onClick={() => { setCategory('perfume'); setCategoryOpen(false); }} className="mobile-card w-full p-3 text-left text-sm font-bold">perfume</button>
      </MobileBottomSheet>
    </MobileAuthenticatedLayout>
  );
};

export default MobileCreateFormulaPage;
