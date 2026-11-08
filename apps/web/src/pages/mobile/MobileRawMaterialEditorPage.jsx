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
  // Added with the desktop control, not after it. Before either existed the column could not be set from
  // anywhere in the app (#445 asked Dekito to fill 223 of them), and a field that only the desktop could
  // set would be the same gap for anyone working on a phone.
  pyramid_placement: '',
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
    pyramid_placement: material.pyramid_placement || '',
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
  pyramid_placement: formState.pyramid_placement || null,
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
        toast.error('Gagal memuat bahan baku');
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
      toast.error('Nama bahan wajib diisi');
      return;
    }
    setSaving(true);
    try {
      if (isEditing) {
        await updateMaterial(id, buildPayload(formState, material || {}));
        triggerMobileHaptic('success');
        toast.success('Bahan baku diperbarui');
        navigate(`/mobile/raw-material/${id}`);
      } else {
        const created = await addMaterial(buildPayload(formState));
        triggerMobileHaptic('success');
        // The service may match an existing row instead of inserting. Desktop says so; mobile used to
        // report "Material added" and navigate to the OTHER material's page (audit round 8).
        if (created?._creationResolution?.action === 'matched_existing') {
          toast.warning(`${created._creationResolution.message} Bahan baku baru TIDAK dibuat.`);
        } else {
          toast.success('Bahan baku ditambahkan');
        }
        navigate(created?.id ? `/mobile/raw-material/${created.id}` : '/mobile/raw-materials');
      }
    } catch (error) {
      toast.error(error.message || (isEditing ? 'Gagal menyimpan bahan baku' : 'Gagal menambah bahan baku'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MobileAuthenticatedLayout taskMode>
        <Helmet><title>{isEditing ? 'Edit bahan baku' : 'Bahan baku baru'} - Solivagant</title></Helmet>
        <MobileLoadingState eyebrow="Editor bahan baku" title="Memuat bahan baku..." subtitle="Menyiapkan kolom stok dan panduan." />
      </MobileAuthenticatedLayout>
    );
  }

  return (
    <MobileAuthenticatedLayout taskMode>
      <Helmet><title>{isEditing ? `Edit ${formState.name || 'bahan baku'}` : 'Bahan baku baru'} - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title={isEditing ? 'Edit bahan baku' : 'Bahan baku baru'} subtitle={isEditing ? formState.name || 'Data bahan baku' : 'Stok dan data referensi'} onBack={goBack} />
        <section className="mobile-soft-card p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
              {isEditing ? <Pencil className="h-5 w-5" /> : <PackagePlus className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Halaman khusus</div>
              <h1 className="text-lg font-bold leading-tight text-editorial-charcoal">{isEditing ? 'Perbarui data bahan baku dengan teliti.' : 'Buat data bahan bakunya dulu.'}</h1>
              <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">
                {isEditing ? 'Ubahan yang panjang dikerjakan di halaman ini, supaya tombol simpan tidak bergeser saat mengetik.' : 'Isi identitas, stok, dan data referensi di sini. Impor panduan tetap bisa dari halaman detail bahan.'}
              </p>
            </div>
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase text-[#647260]">Identitas</div>
            <h2 className="text-base font-bold text-editorial-charcoal">Data dasar bahan</h2>
          </div>
          <div className="grid gap-4">
            <MaterialField label="Nama bahan">
              <Input value={formState.name} onChange={(event) => setField('name', event.target.value)} className="h-10 rounded-2xl bg-white text-xs" autoFocus={!isEditing} />
            </MaterialField>
            <MaterialField
              label="Posisi piramida"
              helper="Menentukan porsi bahan ini di nada atas / tengah / dasar, juga skor Pembuka, Inti, Jejak akhir, dan Ketahanan yang dihitung dari situ. Otomatis berarti posisinya ditebak dari workbook."
            >
              <MobileSegmentedControl
                // 'auto' rather than '': MobileSegmentedControl drops any option whose value is empty, so
                // an empty-valued Auto button would never render — the placement would be unclearable once
                // set, and an unanswered material would show no selected segment at all.
                options={[
                  { value: 'auto', label: 'Otomatis' },
                  { value: 'top', label: 'Atas' },
                  { value: 'middle', label: 'Tengah' },
                  { value: 'base', label: 'Dasar' },
                ]}
                value={formState.pyramid_placement || 'auto'}
                onChange={(placement) => setField('pyramid_placement', placement === 'auto' ? '' : placement)}
              />
            </MaterialField>
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="Jenis">
                <MobileSegmentedControl
                  options={[
                    { value: 'material', label: 'Bahan' },
                    { value: 'solvent', label: 'Pelarut' },
                  ]}
                  value={formState.type}
                  onChange={(type) => setField('type', type)}
                />
              </MaterialField>
              <MaterialField label="Satuan">
                <Input value={formState.unit} onChange={(event) => setField('unit', event.target.value)} className="h-10 rounded-2xl bg-white text-xs" />
              </MaterialField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="Kategori">
                <Input value={formState.category} onChange={(event) => setField('category', event.target.value)} className="h-10 rounded-2xl bg-white text-xs" />
              </MaterialField>
              <MaterialField label="Supplier">
                <Input value={formState.vendor} onChange={(event) => setField('vendor', event.target.value)} className="h-10 rounded-2xl bg-white text-xs" />
              </MaterialField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="Nomor CAS">
                <Input value={formState.cas_number} onChange={(event) => setField('cas_number', event.target.value)} className="h-10 rounded-2xl bg-white text-xs" />
              </MaterialField>
              <MaterialField label="Kode workbook">
                <Input value={formState.workbook_code} onChange={(event) => setField('workbook_code', event.target.value)} className="h-10 rounded-2xl bg-white text-xs" />
              </MaterialField>
            </div>
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase text-[#647260]">Stok</div>
            <h2 className="text-base font-bold text-editorial-charcoal">Batas persediaan</h2>
          </div>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="Stok tersedia">
                <DecimalInput value={formState.stock_quantity} onChange={(value) => setField('stock_quantity', value)} />
              </MaterialField>
              <MaterialField label="Stok minimum">
                <DecimalInput value={formState.minimum_stock} onChange={(value) => setField('minimum_stock', value)} />
              </MaterialField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="Peringatan stok menipis">
                <DecimalInput value={formState.low_stock_threshold} onChange={(value) => setField('low_stock_threshold', value)} placeholder="Opsional" />
              </MaterialField>
              <MaterialField label={`Harga per 10 ${formState.unit || 'g'}`}>
                <DecimalInput value={formState.cost_per_unit} onChange={(value) => setField('cost_per_unit', value)} />
              </MaterialField>
            </div>
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase text-[#647260]">Panduan referensi</div>
            <h2 className="text-base font-bold text-editorial-charcoal">Keamanan dan takaran pakai</h2>
          </div>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="Batas IFRA %">
                <DecimalInput value={formState.ifra_limit} onChange={(value) => setField('ifra_limit', value)} />
              </MaterialField>
              <MaterialField label="Kekuatan">
                <DecimalInput value={formState.reference_impact} onChange={(value) => setField('reference_impact', value)} />
              </MaterialField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MaterialField label="Ketahanan di strip (jam)">
                <DecimalInput value={formState.reference_life_hours} onChange={(value) => setField('reference_life_hours', value)} />
              </MaterialField>
              <MaterialField label="Takaran umum %">
                <DecimalInput value={formState.reference_use_level_typical_percent} onChange={(value) => setField('reference_use_level_typical_percent', value)} />
              </MaterialField>
            </div>
            <MaterialField label="Takaran maks %">
              <DecimalInput value={formState.reference_use_level_max_percent} onChange={(value) => setField('reference_use_level_max_percent', value)} />
            </MaterialField>
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase text-[#647260]">Tinjauan</div>
            <h2 className="text-base font-bold text-editorial-charcoal">Status kerapian dan catatan</h2>
          </div>
          <div className="grid gap-4">
            <MaterialField label="Status kerapian">
              <Input value={formState.data_status} onChange={(event) => setField('data_status', event.target.value)} className="h-10 rounded-2xl bg-white text-xs" />
            </MaterialField>
            <MaterialField label="Catatan tinjauan">
              <Textarea value={formState.review_notes} onChange={(event) => setField('review_notes', event.target.value)} className="min-h-[76px] rounded-2xl bg-white text-xs" />
            </MaterialField>
            <MaterialField label="Catatan">
              <Textarea value={formState.notes} onChange={(event) => setField('notes', event.target.value)} className="min-h-[96px] rounded-2xl bg-white text-xs" />
            </MaterialField>
          </div>
        </section>
      </main>
      <StickyBottomActionBar fixed reserveSpace aria-label="Aksi editor bahan baku">
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={goBack} disabled={saving}>Batal</Button>
          <Button type="button" className="h-12 rounded-2xl text-xs font-bold" onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : isEditing ? 'Simpan perubahan' : 'Simpan bahan baku'}</Button>
        </div>
      </StickyBottomActionBar>
    </MobileAuthenticatedLayout>
  );
};

export default MobileRawMaterialEditorPage;
