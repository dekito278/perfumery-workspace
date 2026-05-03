import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import MobileSearchableSelector from '@/components/mobile-ui/MobileSearchableSelector.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import PaceAnalysisCard from '@/components/mobile/PaceAnalysisCard.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useFormulas } from '@/hooks/useFormulas.js';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { calculatePercentages, calculateTotalGrams } from '@/utils/formulaCalculations.js';
import { FORMULA_STATUSES } from '@/utils/constants.js';
import { MOBILE_PAGE_SIZE } from '@/pages/mobile/mobilePageUtils.js';

const tabs = [
  { value: 'overview', label: 'Overview' },
  { value: 'composition', label: 'Composition' },
  { value: 'materials', label: 'Materials' },
  { value: 'pace', label: 'PACE' },
  { value: 'preview', label: 'Preview' },
];

const createItem = (material, gramAmount = '1') => ({
  row_key: `${material.id}-${Date.now()}`,
  item_id: material.id,
  item_type: material.type === 'solvent' ? 'solvent' : 'raw_material',
  gram_amount: String(gramAmount),
  dilution_percent: '',
  dilution_solvent_id: '',
});

const buildItemsForSubmit = (itemsWithPercentages) => itemsWithPercentages.map((item) => ({
  item_type: item.item_type,
  item_id: item.item_id,
  percentage: item.percentage,
  grams: Number(item.gram_amount || 0),
  dilution_percent: item.dilution_percent ? Number(item.dilution_percent) : null,
  dilution_solvent_id: item.dilution_solvent_id || null,
  concentrate_amount: item.dilution_percent ? Number(((Number(item.gram_amount || 0) * Number(item.dilution_percent)) / 100).toFixed(3)) : null,
}));

const MobileCreateFormulaPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const seedMaterialIds = useMemo(() => String(searchParams.get('materialIds') || '').split(',').map((value) => value.trim()).filter(Boolean), [searchParams]);
  const { createFormula, loading } = useFormulas();
  const [tab, setTab] = useState('overview');
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [metadataOpen, setMetadataOpen] = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [materialQueryOpen, setMaterialQueryOpen] = useState(false);
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
        if (!active) return;
        setRawMaterials(rows || []);
        if (seedMaterialIds.length) {
          setItems((rows || []).filter((material) => seedMaterialIds.includes(material.id)).slice(0, MOBILE_PAGE_SIZE).map((material) => createItem(material)));
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
  const totalGrams = useMemo(() => calculateTotalGrams(items), [items]);
  const itemsWithPercentages = useMemo(() => calculatePercentages(items, totalGrams), [items, totalGrams]);
  const compositionWarnings = [
    totalGrams <= 0 ? 'Add at least one material before saving' : null,
    items.length > MOBILE_PAGE_SIZE ? `Showing ${MOBILE_PAGE_SIZE} composition rows at a time` : null,
  ].filter(Boolean);

  const updateItem = (rowKey, field, value) => setItems((current) => current.map((item) => item.row_key === rowKey ? { ...item, [field]: value } : item));
  const removeItem = (rowKey) => setItems((current) => current.filter((item) => item.row_key !== rowKey));
  const addMaterial = (material) => {
    if (items.some((item) => item.item_id === material.id)) {
      toast.info('Material already in composition');
      return;
    }
    setItems((current) => [...current, createItem(material)]);
    toast.success('Material added');
    setTab('composition');
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
      setTab('composition');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      const created = await createFormula({ name, code, category, version: version || null, status, notes: notes || null }, buildItemsForSubmit(itemsWithPercentages));
      toast.success('Formula created');
      navigate(`/mobile/formulas/${created.id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to create formula');
    }
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet><title>New Mobile Formula - Perfumer Studio</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title={name || 'New Formula'} subtitle={code || 'Standalone composer'} onBack={() => navigate('/mobile/formulas')} action={<MobileStatusBadge status={status} />} />
        <MobileSegmentedControl options={tabs} value={tab} onChange={setTab} />
        {tab === 'overview' ? (
          <section className="mobile-card p-4">
            <h2 className="text-lg font-bold">Formula metadata</h2>
            <div className="mt-3 grid gap-2">
              {[
                ['Name', name || 'Untitled formula'],
                ['Code', code || 'Not set'],
                ['Category', category],
                ['Version', version || 'Not set'],
                ['Status', status],
              ].map(([label, value]) => <div key={label} className="rounded-2xl bg-[#f8f7f4] p-3"><div className="text-[11px] font-bold uppercase text-[#9ca3af]">{label}</div><div className="mt-1 text-sm font-bold">{value}</div></div>)}
            </div>
            <Button className="mt-4 w-full rounded-2xl" variant="outline" onClick={() => setMetadataOpen(true)}>Edit metadata</Button>
          </section>
        ) : null}
        {tab === 'composition' ? (
          <section className="space-y-3">
            <div className="mobile-soft-card p-4">
              <div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase text-amber-700">Total grams</div><div className="mt-1 text-2xl font-bold">{totalGrams.toFixed(2)} g</div></div><Button onClick={() => setSelectorOpen(true)} className="rounded-2xl"><Plus className="mr-1 h-4 w-4" />Add</Button></div>
              {compositionWarnings.length ? <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle className="h-4 w-4" />{compositionWarnings[0]}</div> : null}
            </div>
            {itemsWithPercentages.slice(0, MOBILE_PAGE_SIZE).map((item) => {
              const material = rawMaterialsById.get(item.item_id);
              return (
                <div key={item.row_key} className="mobile-card p-4">
                  <div className="text-sm font-bold">{material?.name || 'Material'}</div>
                  <div className="mt-1 text-xs text-[#6b7280]">{material?.category || 'No category'} · {item.percentage?.toFixed?.(2) || 0}%</div>
                  <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input value={item.gram_amount} inputMode="decimal" onChange={(event) => updateItem(item.row_key, 'gram_amount', event.target.value)} className="rounded-2xl" />
                    <Input value={item.dilution_percent} inputMode="decimal" placeholder="Dil. %" onChange={(event) => updateItem(item.row_key, 'dilution_percent', event.target.value)} className="rounded-2xl" />
                    <Button variant="outline" className="rounded-2xl bg-white" onClick={() => removeItem(item.row_key)}>Remove</Button>
                  </div>
                </div>
              );
            })}
          </section>
        ) : null}
        {tab === 'materials' ? (
          <section className="space-y-3">
            <Button className="h-12 w-full rounded-2xl" onClick={() => setSelectorOpen(true)}>Open searchable material selector</Button>
            {rawMaterials.slice(0, MOBILE_PAGE_SIZE).map((material) => (
              <button key={material.id} type="button" onClick={() => addMaterial(material)} className="mobile-card flex w-full items-center justify-between gap-3 p-4 text-left">
                <span><span className="block text-sm font-bold">{material.name}</span><span className="mt-1 block text-xs text-[#6b7280]">{material.category || 'Uncategorized'}</span></span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Quick add</span>
              </button>
            ))}
          </section>
        ) : null}
        {tab === 'pace' ? <PaceAnalysisCard score={totalGrams > 0 ? Math.min(92, 54 + items.length * 7) : 28} warnings={compositionWarnings} /> : null}
        {tab === 'preview' ? (
          <section className="mobile-card p-4">
            <h2 className="text-lg font-bold">Workbook preview</h2>
            <div className="mt-3 space-y-2">
              {itemsWithPercentages.slice(0, MOBILE_PAGE_SIZE).map((item) => <div key={item.row_key} className="rounded-2xl bg-[#f8f7f4] p-3 text-sm"><strong>{rawMaterialsById.get(item.item_id)?.name}</strong><div className="text-xs text-[#6b7280]">{Number(item.gram_amount || 0).toFixed(2)} g · {Number(item.percentage || 0).toFixed(2)}%</div></div>)}
            </div>
          </section>
        ) : null}
        <StickyBottomActionBar>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="rounded-2xl bg-white" onClick={() => setMetadataOpen(true)}>Metadata</Button>
            <Button className="rounded-2xl" onClick={handleSubmit} disabled={loading}><Save className="mr-1 h-4 w-4" />Create</Button>
          </div>
        </StickyBottomActionBar>
      </main>
      <MobileBottomSheet open={metadataOpen} onOpenChange={setMetadataOpen} title="Formula Metadata" description="Identity fields for this formula." footer={<Button className="h-12 w-full rounded-2xl" onClick={() => setMetadataOpen(false)}>Save Metadata</Button>}>
        <div className="grid gap-4 pb-2">
          <div className="space-y-2"><Label>Formula name</Label><Input value={name} onChange={(event) => setName(event.target.value)} className="rounded-2xl bg-white" /></div>
          <div className="space-y-2"><Label>Formula code</Label><Input value={code} onChange={(event) => setCode(event.target.value)} className="rounded-2xl bg-white" /></div>
          <div className="space-y-2"><Label>Category</Label><button type="button" onClick={() => setMaterialQueryOpen(true)} className="mobile-card w-full p-4 text-left text-sm font-bold">{category}</button></div>
          <div className="space-y-2"><Label>Version</Label><Input value={version} onChange={(event) => setVersion(event.target.value)} className="rounded-2xl bg-white" /></div>
          <div className="space-y-2"><Label>Status</Label><MobileSegmentedControl options={FORMULA_STATUSES} value={status} onChange={setStatus} /></div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[110px] rounded-2xl bg-white" /></div>
        </div>
      </MobileBottomSheet>
      <MobileSearchableSelector open={selectorOpen} onOpenChange={setSelectorOpen} title="Add Material" description="Search and add to composition." options={rawMaterials} onSelect={addMaterial} getLabel={(material) => material.name} getMeta={(material) => material.cas_number || material.category} />
      <MobileSearchableSelector open={materialQueryOpen} onOpenChange={setMaterialQueryOpen} title="Formula Category" options={[{ id: 'perfume', name: 'perfume', code: 'Default category' }]} onSelect={(option) => setCategory(option.id)} getLabel={(option) => option.name} getMeta={(option) => option.code} />
    </MobileAuthenticatedLayout>
  );
};

export default MobileCreateFormulaPage;
