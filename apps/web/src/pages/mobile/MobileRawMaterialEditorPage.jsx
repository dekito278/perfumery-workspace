import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { PackagePlus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useMobileBackNavigation } from '@/hooks/useMobileBackNavigation.js';
import { triggerMobileHaptic } from '@/hooks/useMobileTouchFeedback.js';
import { getRawMaterialById } from '@/services/rawMaterialsService.js';
import { getResolvedGuidanceValues } from '@/utils/mobileRawMaterialGuidance.js';
import { normalizeLocalizedDecimalInput, parseLocalizedNumber } from '@/utils/numberInputs.js';

const createEmptyMaterialForm = () => ({
  name: '',
  type: 'material',
  category: '',
  unit: 'g',
  vendor: '',
  cas_number: '',
  workbook_code: '',
  stock_quantity: '',
  minimum_stock: '',
  low_stock_threshold: '',
  data_status: 'active',
  review_notes: '',
  cost_per_unit: '',
  ifra_limit: '',
  reference_impact: '',
  reference_life_hours: '',
  reference_use_level_typical_percent: '',
  reference_use_level_max_percent: '',
  notes: '',
});

const MaterialField = ({ children, helper, label }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-bold text-[#6b7280]">{label}</Label>
    {children}
    {helper ? <p className="text-[11px] font-medium text-[#8a9099]">{helper}</p> : null}
  </div>
);

const DecimalInput = ({ value, onChange, ...props }) => (
  <Input
    {...props}
    inputMode="decimal"
    value={value}
    onChange={(event) => onChange(normalizeLocalizedDecimalInput(event.target.value))}
    className="h-10 rounded-2xl bg-white text-xs"
  />
);

const toNullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const numericValue = parseLocalizedNumber(value, Number.NaN);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const mapMaterialToForm = (material) => {
  const resolvedValues = getResolvedGuidanceValues(material);
  return {
    name: material.name || '',
    type: material.type || 'material',
    category: material.category || '',
    unit: material.unit || 'g',
    vendor: material.vendor || '',
    cas_number: resolvedValues.cas_number || material.cas_number || '',
    workbook_code: resolvedValues.workbook_code || material.workbook_code || '',
    stock_quantity: material.stock_quantity ?? '',
    minimum_stock: material.minimum_stock ?? '',
    low_stock_threshold: material.low_stock_threshold ?? '',
    data_status: material.data_status || 'active',
    review_notes: material.review_notes || '',
    cost_per_unit: material.cost_per_unit ?? '',
    ifra_limit: resolvedValues.ifra_limit ?? material.ifra_limit ?? '',
    reference_impact: resolvedValues.reference_impact ?? material.reference_impact ?? '',
    reference_life_hours: resolvedValues.reference_life_hours ?? material.reference_life_hours ?? '',
    reference_use_level_typical_percent: resolvedValues.reference_use_level_typical_percent ?? material.reference_use_level_typical_percent ?? '',
    reference_use_level_max_percent: resolvedValues.reference_use_level_max_percent ?? material.reference_use_level_max_percent ?? '',
    notes: material.notes || '',
  };
};

const buildPayload = (formState, material = {}) => ({
  ...material,
  name: formState.name.trim(),
  type: formState.type || 'material',
  category: formState.category.trim() || null,
  unit: formState.unit.trim() || 'g',
  vendor: formState.vendor.trim() || null,
  cas_number: formState.cas_number.trim() || null,
  workbook_code: formState.workbook_code.trim() || null,
  stock_quantity: toNullableNumber(formState.stock_quantity) || 0,
  minimum_stock: toNullableNumber(formState.minimum_stock) || 0,
  low_stock_threshold: toNullableNumber(formState.low_stock_threshold),
  data_status: formState.data_status || 'active',
  review_notes: formState.review_notes.trim() || null,
  cost_per_unit: toNullableNumber(formState.cost_per_unit) || 0,
  ifra_limit: toNullableNumber(formState.ifra_limit),
  reference_impact: toNullableNumber(formState.reference_impact),
  reference_life_hours: toNullableNumber(formState.reference_life_hours),
  reference_use_level_typical_percent: toNullableNumber(formState.reference_use_level_typical_percent),
  reference_use_level_max_percent: toNullableNumber(formState.reference_use_level_max_percent),
  notes: formState.notes.trim() || null,
});

const MobileRawMaterialEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const goBack = useMobileBackNavigation(isEditing ? `/mobile/raw-material/${id}` : '/mobile/raw-materials');
  const { addMaterial, updateMaterial } = useRawMaterials();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(isEditing);
  const [formState, setFormState] = useState(createEmptyMaterialForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return undefined;
    let active = true;
    const loadMaterial = async () => {
      setLoading(true);
      try {
        const row = await getRawMaterialById(id);
        if (!active) return;
        setMaterial(row);
        setFormState(mapMaterialToForm(row));
      } catch (error) {
        toast.error('Failed to load material');
        navigate('/mobile/raw-materials');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadMaterial();
    return () => { active = false; };
  }, [id, isEditing, navigate]);

  const setField = (field, value) => setFormState((current) => ({ ...current, [field]: value }));

  const handleSave = async () => {
    if (!formState.name.trim()) {
      toast.error('Material name is required');
      return;
    }
    setSaving(true);
    try {
      if (isEditing) {
        await updateMaterial(id, buildPayload(formState, material || {}));
        triggerMobileHaptic('success');
        toast.success('Material updated');
        navigate(`/mobile/raw-material/${id}`);
      } else {
        const created = await addMaterial(buildPayload(formState));
        triggerMobileHaptic('success');
        toast.success('Material added');
        navigate(created?.id ? `/mobile/raw-material/${created.id}` : '/mobile/raw-materials');
      }
    } catch (error) {
      toast.error(error.message || (isEditing ? 'Failed to update material' : 'Failed to add material'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MobileAuthenticatedLayout showFab={false}>
        <Helmet><title>{isEditing ? 'Edit Material' : 'New Material'} - Solivagant</title></Helmet>
        <MobileLoadingState eyebrow="Material editor" title="Loading material..." subtitle="Preparing editable stock and guidance fields." />
      </MobileAuthenticatedLayout>
    );
  }

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet><title>{isEditing ? `Edit ${formState.name || 'Material'}` : 'New Material'} - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title={isEditing ? 'Edit material' : 'New material'} subtitle={isEditing ? formState.name || 'Material setup' : 'Stock and reference setup'} onBack={goBack} />
        <section className="mobile-soft-card p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
              {isEditing ? <Pencil className="h-5 w-5" /> : <PackagePlus className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Dedicated flow</div>
              <h1 className="text-lg font-bold leading-tight text-[#0b130c]">{isEditing ? 'Update the material record carefully.' : 'Create the material record first.'}</h1>
              <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">
                {isEditing ? 'Long material edits live on this page so the save action stays stable while typing.' : 'Add identity, stock, and reference fields here. Guidance import stays available from the material detail.'}
              </p>
            </div>
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase text-[#647260]">Identity</div>
            <h2 className="text-base font-bold text-[#0b130c]">Material basics</h2>
          </div>
          <div className="grid gap-4">
            <MaterialField label="Material name">
              <Input value={formState.name} onChange={(event) => setField('name', event.target.value)} className="h-10 rounded-2xl bg-white text-xs" autoFocus={!isEditing} />
            </MaterialField>
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="Type">
                <MobileSegmentedControl
                  options={[
                    { value: 'material', label: 'Material' },
                    { value: 'solvent', label: 'Solvent' },
                  ]}
                  value={formState.type}
                  onChange={(type) => setField('type', type)}
                />
              </MaterialField>
              <MaterialField label="Unit">
                <Input value={formState.unit} onChange={(event) => setField('unit', event.target.value)} className="h-10 rounded-2xl bg-white text-xs" />
              </MaterialField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="Category">
                <Input value={formState.category} onChange={(event) => setField('category', event.target.value)} className="h-10 rounded-2xl bg-white text-xs" />
              </MaterialField>
              <MaterialField label="Supplier">
                <Input value={formState.vendor} onChange={(event) => setField('vendor', event.target.value)} className="h-10 rounded-2xl bg-white text-xs" />
              </MaterialField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="CAS number">
                <Input value={formState.cas_number} onChange={(event) => setField('cas_number', event.target.value)} className="h-10 rounded-2xl bg-white text-xs" />
              </MaterialField>
              <MaterialField label="Workbook code">
                <Input value={formState.workbook_code} onChange={(event) => setField('workbook_code', event.target.value)} className="h-10 rounded-2xl bg-white text-xs" />
              </MaterialField>
            </div>
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase text-[#647260]">Stock setup</div>
            <h2 className="text-base font-bold text-[#0b130c]">Inventory guardrails</h2>
          </div>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="Stock on hand">
                <DecimalInput value={formState.stock_quantity} onChange={(value) => setField('stock_quantity', value)} />
              </MaterialField>
              <MaterialField label="Minimum stock">
                <DecimalInput value={formState.minimum_stock} onChange={(value) => setField('minimum_stock', value)} />
              </MaterialField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="Low stock alert">
                <DecimalInput value={formState.low_stock_threshold} onChange={(value) => setField('low_stock_threshold', value)} placeholder="Optional" />
              </MaterialField>
              <MaterialField label="Unit price">
                <DecimalInput value={formState.cost_per_unit} onChange={(value) => setField('cost_per_unit', value)} />
              </MaterialField>
            </div>
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase text-[#647260]">Reference guidance</div>
            <h2 className="text-base font-bold text-[#0b130c]">Safety and usage hints</h2>
          </div>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="IFRA limit %">
                <DecimalInput value={formState.ifra_limit} onChange={(value) => setField('ifra_limit', value)} />
              </MaterialField>
              <MaterialField label="Impact">
                <DecimalInput value={formState.reference_impact} onChange={(value) => setField('reference_impact', value)} />
              </MaterialField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="Life hours">
                <DecimalInput value={formState.reference_life_hours} onChange={(value) => setField('reference_life_hours', value)} />
              </MaterialField>
              <MaterialField label="Typical use %">
                <DecimalInput value={formState.reference_use_level_typical_percent} onChange={(value) => setField('reference_use_level_typical_percent', value)} />
              </MaterialField>
            </div>
            <MaterialField label="Max use %">
              <DecimalInput value={formState.reference_use_level_max_percent} onChange={(value) => setField('reference_use_level_max_percent', value)} />
            </MaterialField>
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase text-[#647260]">Review</div>
            <h2 className="text-base font-bold text-[#0b130c]">Cleanup status and notes</h2>
          </div>
          <div className="grid gap-4">
            <MaterialField label="Cleanup status">
              <Input value={formState.data_status} onChange={(event) => setField('data_status', event.target.value)} className="h-10 rounded-2xl bg-white text-xs" />
            </MaterialField>
            <MaterialField label="Review note">
              <Textarea value={formState.review_notes} onChange={(event) => setField('review_notes', event.target.value)} className="min-h-[76px] rounded-2xl bg-white text-xs" />
            </MaterialField>
            <MaterialField label="Notes">
              <Textarea value={formState.notes} onChange={(event) => setField('notes', event.target.value)} className="min-h-[96px] rounded-2xl bg-white text-xs" />
            </MaterialField>
          </div>
        </section>
      </main>
      <StickyBottomActionBar fixed reserveSpace aria-label="Material editor actions">
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={goBack} disabled={saving}>Cancel</Button>
          <Button type="button" className="h-12 rounded-2xl text-xs font-bold" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : isEditing ? 'Save changes' : 'Save material'}</Button>
        </div>
      </StickyBottomActionBar>
    </MobileAuthenticatedLayout>
  );
};

export default MobileRawMaterialEditorPage;
