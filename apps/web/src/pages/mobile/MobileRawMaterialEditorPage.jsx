import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useMobileBackNavigation } from '@/hooks/useMobileBackNavigation.js';
import { triggerMobileHaptic } from '@/hooks/useMobileTouchFeedback.js';

const createEmptyMaterialForm = () => ({
  name: '',
  category: '',
  cas_number: '',
  vendor: '',
  type: 'material',
  unit: 'g',
  stock_quantity: '',
  minimum_stock: '',
  low_stock_threshold: '',
  data_status: 'active',
});

const MaterialField = ({ children, label }) => (
  <div className="space-y-2">
    <Label className="text-xs font-bold text-[#6b7280]">{label}</Label>
    {children}
  </div>
);

const MobileRawMaterialEditorPage = () => {
  const goBack = useMobileBackNavigation('/mobile/raw-materials');
  const { addMaterial } = useRawMaterials();
  const [formState, setFormState] = useState(createEmptyMaterialForm);
  const [saving, setSaving] = useState(false);

  const setField = (field, value) => setFormState((current) => ({ ...current, [field]: value }));

  const handleSave = async () => {
    if (!formState.name.trim()) {
      toast.error('Material name is required');
      return;
    }
    setSaving(true);
    try {
      await addMaterial({
        ...formState,
        stock_quantity: Number(formState.stock_quantity || 0),
        minimum_stock: Number(formState.minimum_stock || 0),
        low_stock_threshold: formState.low_stock_threshold === '' ? null : Number(formState.low_stock_threshold || 0),
        cost_per_unit: 0,
      });
      triggerMobileHaptic('success');
      toast.success('Material added');
      goBack();
    } catch (error) {
      toast.error(error.message || 'Failed to add material');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet><title>New Material - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title="New material" subtitle="Stock and reference setup" onBack={goBack} />
        <section className="mobile-soft-card p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
              <PackagePlus className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Dedicated flow</div>
              <h1 className="text-lg font-bold leading-tight text-[#0b130c]">Create the material record first.</h1>
              <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">
                Add the identity and initial stock threshold here. Guidance URLs and detailed stock edits stay available from the material card/detail.
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
              <Input value={formState.name} onChange={(event) => setField('name', event.target.value)} className="rounded-2xl bg-white" autoFocus />
            </MaterialField>
            <MaterialField label="CAS number">
              <Input value={formState.cas_number} onChange={(event) => setField('cas_number', event.target.value)} className="rounded-2xl bg-white" />
            </MaterialField>
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="Category">
                <Input value={formState.category} onChange={(event) => setField('category', event.target.value)} className="rounded-2xl bg-white" />
              </MaterialField>
              <MaterialField label="Supplier">
                <Input value={formState.vendor} onChange={(event) => setField('vendor', event.target.value)} className="rounded-2xl bg-white" />
              </MaterialField>
            </div>
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase text-[#647260]">Stock setup</div>
            <h2 className="text-base font-bold text-[#0b130c]">Initial inventory guardrails</h2>
          </div>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="Stock on hand">
                <Input type="number" min="0" step="0.001" value={formState.stock_quantity} onChange={(event) => setField('stock_quantity', event.target.value)} className="rounded-2xl bg-white" />
              </MaterialField>
              <MaterialField label="Minimum stock">
                <Input type="number" min="0" step="0.001" value={formState.minimum_stock} onChange={(event) => setField('minimum_stock', event.target.value)} className="rounded-2xl bg-white" />
              </MaterialField>
            </div>
            <MaterialField label="Low stock alert">
              <Input type="number" min="0" step="0.001" value={formState.low_stock_threshold} onChange={(event) => setField('low_stock_threshold', event.target.value)} className="rounded-2xl bg-white" placeholder="Optional" />
            </MaterialField>
          </div>
        </section>
      </main>
      <StickyBottomActionBar fixed reserveSpace aria-label="Material editor actions">
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button type="button" variant="outline" className="rounded-2xl bg-white px-4" onClick={goBack} disabled={saving}>Cancel</Button>
          <Button type="button" className="rounded-2xl" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save material'}</Button>
        </div>
      </StickyBottomActionBar>
    </MobileAuthenticatedLayout>
  );
};

export default MobileRawMaterialEditorPage;
