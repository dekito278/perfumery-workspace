import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Link2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import DeleteConfirmationDialog from '@/components/mobile-ui/DeleteConfirmationDialog.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { getRawMaterialById } from '@/services/rawMaterialsService.js';
import { formatNullable, formatPercentage, formatStatus } from '@/utils/formatting.js';
import {
  GUIDANCE_SOURCE_OPTIONS,
  buildGuidancePatch,
  getGuidanceSourceLabel,
  importGuidanceBySource,
  summarizeImportedGuidance,
} from '@/utils/mobileGuidanceImport.js';
import { enrichMaterialsWithGuidance, getResolvedGuidanceNumber, getResolvedGuidanceValues } from '@/utils/mobileRawMaterialGuidance.js';

const MobileRawMaterialDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { deleteMaterial, updateMaterial } = useRawMaterials();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [guidanceState, setGuidanceState] = useState('empty');
  const [guidanceForm, setGuidanceForm] = useState({ url: '', sourceType: 'perfumersworld' });
  const [guidanceSummary, setGuidanceSummary] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    type: 'material',
    category: '',
    unit: 'g',
    vendor: '',
    cas_number: '',
    workbook_code: '',
    cost_per_unit: '',
    ifra_limit: '',
    reference_impact: '',
    reference_life_hours: '',
    reference_use_level_typical_percent: '',
    reference_use_level_max_percent: '',
    notes: '',
  });

  useEffect(() => {
    let active = true;
    const loadMaterial = async () => {
      setLoading(true);
      try {
        const row = await getRawMaterialById(id);
        const [enrichedRow] = await enrichMaterialsWithGuidance(row ? [row] : []);
        if (active) setMaterial(enrichedRow || row);
      } catch (error) {
        toast.error('Failed to load material');
        navigate('/mobile/raw-materials');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadMaterial();
    return () => { active = false; };
  }, [id, navigate]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMaterial(id);
      toast.success('Material deleted');
      navigate('/mobile/raw-materials');
    } catch (error) {
      toast.error(error.message || 'Failed to delete material');
      setDeleting(false);
    }
  };

  const openEditSheet = () => {
    if (!material) return;
    const resolvedValues = getResolvedGuidanceValues(material);
    setEditForm({
      name: material.name || '',
      type: material.type || 'material',
      category: material.category || '',
      unit: material.unit || 'g',
      vendor: material.vendor || '',
      cas_number: resolvedValues.cas_number || material.cas_number || '',
      workbook_code: resolvedValues.workbook_code || material.workbook_code || '',
      cost_per_unit: material.cost_per_unit ?? '',
      ifra_limit: resolvedValues.ifra_limit ?? material.ifra_limit ?? '',
      reference_impact: resolvedValues.reference_impact ?? material.reference_impact ?? '',
      reference_life_hours: resolvedValues.reference_life_hours ?? material.reference_life_hours ?? '',
      reference_use_level_typical_percent: resolvedValues.reference_use_level_typical_percent ?? material.reference_use_level_typical_percent ?? '',
      reference_use_level_max_percent: resolvedValues.reference_use_level_max_percent ?? material.reference_use_level_max_percent ?? '',
      notes: material.notes || '',
    });
    setEditOpen(true);
  };

  const toNullableNumber = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  };

  const handleSaveEdit = async () => {
    if (!editForm.name.trim()) {
      toast.error('Material name is required');
      return;
    }

    setEditSaving(true);
    try {
      const updated = await updateMaterial(material.id, {
        ...material,
        name: editForm.name.trim(),
        type: editForm.type || 'material',
        category: editForm.category.trim() || null,
        unit: editForm.unit.trim() || 'g',
        vendor: editForm.vendor.trim() || null,
        cas_number: editForm.cas_number.trim() || null,
        workbook_code: editForm.workbook_code.trim() || null,
        cost_per_unit: toNullableNumber(editForm.cost_per_unit) || 0,
        ifra_limit: toNullableNumber(editForm.ifra_limit),
        reference_impact: toNullableNumber(editForm.reference_impact),
        reference_life_hours: toNullableNumber(editForm.reference_life_hours),
        reference_use_level_typical_percent: toNullableNumber(editForm.reference_use_level_typical_percent),
        reference_use_level_max_percent: toNullableNumber(editForm.reference_use_level_max_percent),
        notes: editForm.notes.trim() || null,
      });
      const [enrichedUpdated] = await enrichMaterialsWithGuidance([updated]);
      setMaterial(enrichedUpdated || updated);
      setEditOpen(false);
      toast.success('Material updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update material');
    } finally {
      setEditSaving(false);
    }
  };

  if (loading || !material) {
    return <MobileAuthenticatedLayout><MobileLoadingState eyebrow="Material" title="Loading material..." subtitle="Preparing guidance and reference data." /></MobileAuthenticatedLayout>;
  }

  const resolved = getResolvedGuidanceValues(material);
  const impact = getResolvedGuidanceNumber(material, 'reference_impact');
  const life = getResolvedGuidanceNumber(material, 'reference_life_hours');
  const ready = Boolean(resolved.workbook_code || impact || life || resolved.ifra_limit);
  const handleImportGuidance = async () => {
    if (!/^https?:\/\//i.test(guidanceForm.url.trim())) {
      setGuidanceState('error');
      toast.error('Unable to import guidance');
      return;
    }
    setGuidanceState('loading');
    try {
      const imported = await importGuidanceBySource({ sourceType: guidanceForm.sourceType, url: guidanceForm.url.trim() });
      const updated = await updateMaterial(material.id, buildGuidancePatch({
        material,
        sourceType: guidanceForm.sourceType,
        imported,
      }));
      const [enrichedUpdated] = await enrichMaterialsWithGuidance([updated]);
      setMaterial(enrichedUpdated || updated);
      setGuidanceSummary(summarizeImportedGuidance({ sourceType: guidanceForm.sourceType, imported }));
      setGuidanceState('success');
      setGuidanceOpen(false);
      toast.success(`${getGuidanceSourceLabel(guidanceForm.sourceType)} guidance imported`);
    } catch (error) {
      setGuidanceState('error');
      toast.error(error.message || 'Unable to import guidance');
    }
  };
  const handleRefreshGuidance = async () => {
    try {
      const row = await getRawMaterialById(id);
      const [enrichedRow] = await enrichMaterialsWithGuidance(row ? [row] : []);
      setMaterial(enrichedRow || row);
      toast.success('Material data refreshed');
    } catch (error) {
      toast.error('Failed to refresh material');
    }
  };
  const sections = [
    ['Basic information', [['Type', formatStatus(material.type)], ['Category', formatStatus(material.category)], ['Unit', material.unit || '-']]],
    ['CAS and supplier', [['CAS', formatNullable(resolved.cas_number)], ['Supplier', formatNullable(material.vendor)], ['Workbook', formatNullable(resolved.workbook_code)]]],
    ['Usage recommendation', [['Typical use', resolved.reference_use_level_typical_percent != null ? formatPercentage(resolved.reference_use_level_typical_percent, 2) : '-'], ['Max use', resolved.reference_use_level_max_percent != null ? formatPercentage(resolved.reference_use_level_max_percent, 2) : '-']]],
    ['Safety / audit status', [['IFRA', resolved.ifra_limit != null ? formatPercentage(resolved.ifra_limit, 2) : '-'], ['Impact', impact ?? '-'], ['Life hours', life ?? '-']]],
  ];

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>{material.name} - Mobile Material</title></Helmet>
      <main className="mobile-page space-y-3">
        <MobileTopBar title={material.name} subtitle={resolved.cas_number ? `CAS ${resolved.cas_number}` : undefined} onBack={() => navigate('/mobile/raw-materials')} action={<MobileStatusBadge tone={ready ? 'active' : 'warning'}>{ready ? 'Ready' : 'Audit'}</MobileStatusBadge>} />
        <section className="mobile-card p-2.5">
          <div className="grid grid-cols-4 gap-1.5">
            <Button variant="outline" className="h-12 flex-col gap-0.5 rounded-2xl bg-white px-1 text-[10px]" onClick={openEditSheet}><Pencil className="h-4 w-4" />Edit</Button>
            <Button className="h-12 flex-col gap-0.5 rounded-2xl px-1 text-[10px]" onClick={() => navigate(`/mobile/formulas/new?materialIds=${material.id}`)}><Plus className="h-4 w-4" />Formula</Button>
            <Button variant="outline" className="h-12 flex-col gap-0.5 rounded-2xl bg-white px-1 text-[10px]" onClick={() => setGuidanceOpen(true)}><Link2 className="h-4 w-4" />Import</Button>
            <Button variant="outline" className="h-12 flex-col gap-0.5 rounded-2xl border-rose-200 bg-rose-50 px-1 text-[10px] text-rose-700" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" />Delete</Button>
          </div>
        </section>
        {sections.map(([title, rows]) => (
          <section key={title} className="mobile-card mobile-compact-card p-3">
            <h2 className="text-sm font-bold">{title}</h2>
            <div className="mt-2 grid gap-2">
              {rows.map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[#f8f7f4] p-2">
                  <div className="text-[10px] font-bold uppercase text-[#9ca3af]">{label}</div>
                  <div className="mt-0.5 text-xs font-semibold text-[#1f2937]">{value}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
        <section className="mobile-card mobile-compact-card p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Guidance & Source</h2>
              <p className="mt-0.5 text-[11px] font-semibold text-[#6b7280]">{ready ? 'Imported or reference data available' : 'Not connected'}</p>
            </div>
            <MobileStatusBadge tone={ready ? 'active' : 'warning'} className="h-5 px-2 text-[10px]">{ready ? 'Updated' : 'Needs review'}</MobileStatusBadge>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#f8f7f4] p-2 text-xs font-semibold">Impact {impact ?? '-'}</div>
            <div className="rounded-xl bg-[#f8f7f4] p-2 text-xs font-semibold">Lifetime {life ?? '-'}</div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => setGuidanceOpen(true)} className="h-9 rounded-xl bg-white text-xs"><Link2 className="mr-1 h-3.5 w-3.5" />Import URL</Button>
            <Button type="button" variant="outline" onClick={handleRefreshGuidance} className="h-9 rounded-xl bg-white text-xs"><RefreshCw className="mr-1 h-3.5 w-3.5" />Refresh</Button>
          </div>
        </section>
        {material.notes ? <section className="mobile-card mobile-compact-card p-3"><h2 className="text-sm font-bold">Notes</h2><p className="mt-2 whitespace-pre-wrap text-xs text-[#6b7280]">{material.notes}</p></section> : null}
      </main>
      <DeleteConfirmationDialog open={deleteOpen} onOpenChange={setDeleteOpen} itemName={material.name} onConfirm={handleDelete} loading={deleting} />
      <MobileBottomSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Material"
        description={material.name}
        footer={<Button type="button" onClick={handleSaveEdit} disabled={editSaving} className="h-11 w-full rounded-2xl text-xs">{editSaving ? 'Saving material...' : 'Save Changes'}</Button>}
      >
        <div className="grid gap-3 pb-2">
          {[
            ['name', 'Material name'],
            ['category', 'Category'],
            ['vendor', 'Supplier'],
            ['cas_number', 'CAS number'],
            ['workbook_code', 'Workbook code'],
            ['unit', 'Unit'],
            ['cost_per_unit', 'Unit price'],
            ['ifra_limit', 'IFRA limit %'],
            ['reference_impact', 'Impact'],
            ['reference_life_hours', 'Life hours'],
            ['reference_use_level_typical_percent', 'Typical use %'],
            ['reference_use_level_max_percent', 'Max use %'],
          ].map(([field, label]) => (
            <div key={field} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                value={editForm[field]}
                onChange={(event) => setEditForm((current) => ({ ...current, [field]: event.target.value }))}
                className="h-10 rounded-xl bg-white text-xs"
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <MobileSegmentedControl
              options={[
                { value: 'material', label: 'Material' },
                { value: 'solvent', label: 'Solvent' },
              ]}
              value={editForm.type}
              onChange={(type) => setEditForm((current) => ({ ...current, type }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={editForm.notes}
              onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))}
              className="min-h-[90px] rounded-xl bg-white text-xs"
            />
          </div>
        </div>
      </MobileBottomSheet>
      <MobileBottomSheet
        open={guidanceOpen}
        onOpenChange={setGuidanceOpen}
        title="Import Guidance URL"
        footer={<Button type="button" onClick={handleImportGuidance} disabled={guidanceState === 'loading'} className="h-10 w-full rounded-xl text-xs">{guidanceState === 'loading' ? 'Importing guidance...' : 'Import Guidance'}</Button>}
      >
        <div className="grid gap-3 pb-2">
          <div className="space-y-1"><Label className="text-xs">URL</Label><Input value={guidanceForm.url} onChange={(event) => setGuidanceForm((current) => ({ ...current, url: event.target.value }))} className="h-10 rounded-xl bg-white text-xs" placeholder="https://..." /></div>
          <div className="space-y-1"><Label className="text-xs">Source</Label><MobileSegmentedControl options={GUIDANCE_SOURCE_OPTIONS} value={guidanceForm.sourceType} onChange={(sourceType) => setGuidanceForm((current) => ({ ...current, sourceType }))} /></div>
          {guidanceSummary.length ? <div className="rounded-xl bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">{guidanceSummary.slice(0, 3).join(' · ')}</div> : null}
          {guidanceState === 'error' ? <div className="rounded-xl bg-rose-50 p-2 text-xs font-semibold text-rose-700">URL import failed. Check the address and try again.</div> : null}
          {guidanceState === 'success' ? <div className="rounded-xl bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">Guidance imported and material insights updated.</div> : null}
        </div>
      </MobileBottomSheet>
    </MobileAuthenticatedLayout>
  );
};

export default MobileRawMaterialDetailPage;
