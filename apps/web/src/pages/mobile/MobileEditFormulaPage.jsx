import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Save, X } from 'lucide-react';
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
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { calculatePercentages, calculateTotalGrams } from '@/utils/formulaCalculations.js';
import { FORMULA_STATUSES } from '@/utils/constants.js';
import { MOBILE_PAGE_SIZE } from '@/pages/mobile/mobilePageUtils.js';

const tabs = [
  { value: 'current', label: 'Current' },
  { value: 'revised', label: 'Revised' },
  { value: 'changes', label: 'Changes' },
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

const MobileEditFormulaPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getFormulaById, updateFormula, loading } = useFormulas();
  const { getFormulaItems } = useFormulaItems();
  const [tab, setTab] = useState('revised');
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [formula, setFormula] = useState(null);
  const [originalItems, setOriginalItems] = useState([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('perfume');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoadingData(true);
      try {
        const [formulaRow, itemRows, materialRows] = await Promise.all([getFormulaById(id), getFormulaItems(id), getRawMaterialOptions()]);
        if (!active) return;
        setFormula(formulaRow);
        setRawMaterials(materialRows || []);
        setName(formulaRow.name || '');
        setCode(formulaRow.code || '');
        setCategory(formulaRow.category || 'perfume');
        setVersion(formulaRow.version || '');
        setStatus(formulaRow.status || 'draft');
        setNotes(formulaRow.notes || '');
        const formatted = (itemRows || []).filter((item) => item.item_type !== 'accord').map((item) => {
          const material = (materialRows || []).find((entry) => entry.id === item.item_id);
          return createItem(material || { id: item.item_id, type: item.item_type }, item.grams ?? item.percentage ?? 1);
        });
        setOriginalItems(formatted);
        setItems(formatted);
      } catch (error) {
        toast.error('Failed to load formula');
        navigate('/mobile/formulas');
      } finally {
        if (active) setLoadingData(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, [getFormulaById, getFormulaItems, id, navigate]);

  const rawMaterialsById = useMemo(() => new Map(rawMaterials.map((material) => [material.id, material])), [rawMaterials]);
  const totalGrams = useMemo(() => calculateTotalGrams(items), [items]);
  const itemsWithPercentages = useMemo(() => calculatePercentages(items, totalGrams), [items, totalGrams]);
  const unsaved = useMemo(() => JSON.stringify(items) !== JSON.stringify(originalItems) || name !== (formula?.name || '') || code !== (formula?.code || ''), [code, formula, items, name, originalItems]);
  const addedCount = Math.max(items.length - originalItems.length, 0);

  const updateItem = (rowKey, field, value) => setItems((current) => current.map((item) => item.row_key === rowKey ? { ...item, [field]: value } : item));
  const removeItem = (rowKey) => setItems((current) => current.filter((item) => item.row_key !== rowKey));
  const addMaterial = (material) => {
    if (items.some((item) => item.item_id === material.id)) {
      toast.info('Material already in composition');
      return;
    }
    setItems((current) => [...current, createItem(material)]);
    toast.success('Material added');
  };

  const handleSubmit = async () => {
    if (!name.trim() || !code.trim()) {
      toast.error('Name and code are required');
      setMetadataOpen(true);
      return;
    }
    if (!items.length || totalGrams <= 0) {
      toast.error('Composition needs at least one material');
      return;
    }
    try {
      await updateFormula(id, { name, code, category, version: version || null, status, notes: notes || null }, buildItemsForSubmit(itemsWithPercentages));
      toast.success('Revision saved');
      navigate(`/mobile/formulas/${id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to save revision');
    }
  };

  if (loadingData) {
    return <MobileAuthenticatedLayout showFab={false}><main className="mobile-page"><div className="mobile-card p-6 text-sm text-[#6b7280]">Loading editor...</div></main></MobileAuthenticatedLayout>;
  }

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet><title>Edit {name} - Mobile Formula</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title={name || 'Edit Formula'} subtitle={unsaved ? 'Unsaved revision' : 'No unsaved changes'} onBack={() => navigate(`/mobile/formulas/${id}`)} action={<MobileStatusBadge status={status} />} />
        <MobileSegmentedControl options={tabs} value={tab} onChange={setTab} />
        {tab === 'current' ? (
          <section className="space-y-3">
            {originalItems.slice(0, MOBILE_PAGE_SIZE).map((item) => {
              const material = rawMaterialsById.get(item.item_id);
              return <div key={item.row_key} className="mobile-card p-4"><div className="text-sm font-bold">{material?.name || 'Material'}</div><div className="mt-1 text-xs text-[#6b7280]">{item.gram_amount} g</div></div>;
            })}
          </section>
        ) : null}
        {tab === 'revised' ? (
          <section className="space-y-3">
            <div className="mobile-soft-card p-4"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase text-amber-700">Revision total</div><div className="mt-1 text-2xl font-bold">{totalGrams.toFixed(2)} g</div></div><Button className="rounded-2xl" onClick={() => setSelectorOpen(true)}><Plus className="mr-1 h-4 w-4" />Add</Button></div></div>
            {itemsWithPercentages.slice(0, MOBILE_PAGE_SIZE).map((item) => {
              const material = rawMaterialsById.get(item.item_id);
              return (
                <div key={item.row_key} className="mobile-card p-4">
                  <div className="text-sm font-bold">{material?.name || 'Material'}</div>
                  <div className="mt-1 text-xs text-[#6b7280]">{Number(item.percentage || 0).toFixed(1)}%</div>
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                    <Input value={item.gram_amount} inputMode="decimal" onChange={(event) => updateItem(item.row_key, 'gram_amount', event.target.value)} className="rounded-2xl" />
                    <Button variant="outline" className="rounded-2xl bg-white" onClick={() => removeItem(item.row_key)}>Remove</Button>
                  </div>
                </div>
              );
            })}
          </section>
        ) : null}
        {tab === 'changes' ? (
          <section className="mobile-card p-4">
            <h2 className="text-lg font-bold">Revision status</h2>
            <div className="mt-3 grid gap-2">
              <div className="rounded-2xl bg-[#f8f7f4] p-3"><div className="text-xs font-bold uppercase text-[#9ca3af]">Added rows</div><div className="mt-1 font-bold">{addedCount}</div></div>
              <div className="rounded-2xl bg-[#f8f7f4] p-3"><div className="text-xs font-bold uppercase text-[#9ca3af]">Current vs revised</div><div className="mt-1 font-bold">{originalItems.length} → {items.length}</div></div>
              <div className="rounded-2xl bg-[#f8f7f4] p-3"><div className="text-xs font-bold uppercase text-[#9ca3af]">Unsaved</div><div className="mt-1 font-bold">{unsaved ? 'Yes' : 'No'}</div></div>
            </div>
          </section>
        ) : null}
        {tab === 'pace' ? <PaceAnalysisCard score={totalGrams > 0 ? Math.min(94, 56 + items.length * 6) : 24} recommendations={['Save revision after reviewing material balance']} /> : null}
        {tab === 'preview' ? <section className="mobile-card p-4"><h2 className="text-lg font-bold">Preview</h2>{itemsWithPercentages.slice(0, MOBILE_PAGE_SIZE).map((item) => <div key={item.row_key} className="mt-2 rounded-2xl bg-[#f8f7f4] p-3 text-sm font-medium">{rawMaterialsById.get(item.item_id)?.name || 'Material'} · {Number(item.percentage || 0).toFixed(1)}%</div>)}</section> : null}
        <StickyBottomActionBar>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="rounded-2xl bg-white text-xs" onClick={() => setMetadataOpen(true)}>Metadata</Button>
            <Button variant="outline" className="rounded-2xl bg-white text-xs" onClick={() => navigate(`/mobile/formulas/${id}`)}><X className="mr-1 h-4 w-4" />Cancel</Button>
            <Button className="rounded-2xl text-xs" onClick={handleSubmit} disabled={loading || !unsaved}><Save className="mr-1 h-4 w-4" />Save</Button>
          </div>
        </StickyBottomActionBar>
      </main>
      <MobileBottomSheet open={metadataOpen} onOpenChange={setMetadataOpen} title="Formula Metadata" footer={<Button className="h-12 w-full rounded-2xl" onClick={() => setMetadataOpen(false)}>Save Metadata</Button>}>
        <div className="grid gap-4 pb-2">
          <div className="space-y-2"><Label>Formula name</Label><Input value={name} onChange={(event) => setName(event.target.value)} className="rounded-2xl bg-white" /></div>
          <div className="space-y-2"><Label>Formula code</Label><Input value={code} onChange={(event) => setCode(event.target.value)} className="rounded-2xl bg-white" /></div>
          <div className="space-y-2"><Label>Version</Label><Input value={version} onChange={(event) => setVersion(event.target.value)} className="rounded-2xl bg-white" /></div>
          <div className="space-y-2"><Label>Status</Label><MobileSegmentedControl options={FORMULA_STATUSES} value={status} onChange={setStatus} /></div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[110px] rounded-2xl bg-white" /></div>
        </div>
      </MobileBottomSheet>
      <MobileSearchableSelector open={selectorOpen} onOpenChange={setSelectorOpen} title="Add Material" options={rawMaterials} onSelect={addMaterial} getLabel={(material) => material.name} getMeta={(material) => material.cas_number || material.category} />
    </MobileAuthenticatedLayout>
  );
};

export default MobileEditFormulaPage;
