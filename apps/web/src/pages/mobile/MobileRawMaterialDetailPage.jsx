import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Link2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import MobileActionDock from '@/components/mobile-ui/MobileActionDock.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileInlineNotice from '@/components/mobile-ui/MobileInlineNotice.jsx';
import { useMobileBackNavigation } from '@/hooks/useMobileBackNavigation.js';
import DeleteConfirmationDialog from '@/components/mobile-ui/DeleteConfirmationDialog.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
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

const runDeleteWithTimeout = (promise, timeoutMs = 30000) => Promise.race([
  promise,
  new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error('Delete is taking longer than expected. Please try again in a moment.')), timeoutMs);
  }),
]);

const MobileRawMaterialDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const handleBack = useMobileBackNavigation('/mobile/raw-materials');
  const { deleteMaterial, updateMaterial } = useRawMaterials();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [guidanceState, setGuidanceState] = useState('empty');
  const [guidanceForm, setGuidanceForm] = useState({ url: '', sourceType: 'perfumersworld' });
  const [guidanceSummary, setGuidanceSummary] = useState([]);
  const [deleting, setDeleting] = useState(false);
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
      await runDeleteWithTimeout(deleteMaterial(id), 30000);
      toast.success('Material deleted');
      navigate('/mobile/raw-materials');
    } catch (error) {
      toast.error(error.message || 'Failed to delete material');
      setDeleting(false);
    }
  };


  if (loading || !material) {
    return <MobileAuthenticatedLayout><MobileLoadingState eyebrow="Material" title="Loading material..." subtitle="Preparing guidance and reference data." /></MobileAuthenticatedLayout>;
  }

  const resolved = getResolvedGuidanceValues(material);
  const impact = getResolvedGuidanceNumber(material, 'reference_impact');
  const life = getResolvedGuidanceNumber(material, 'reference_life_hours');
  const ready = Boolean(resolved.workbook_code || impact || life || resolved.ifra_limit);
  const stockQuantity = Number(material.stock_quantity || 0);
  const stockThreshold = Number(material.low_stock_threshold ?? material.minimum_stock ?? 0);
  const lowStock = stockThreshold > 0 && stockQuantity <= stockThreshold;
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
    ['Cleanup status', [['Status', formatStatus(material.data_status || 'active')], ['Review note', formatNullable(material.review_notes)], ['Archived', formatNullable(material.archived_at)]]],
    ['Inventory', [['Stock on hand', `${stockQuantity.toLocaleString('id-ID', { maximumFractionDigits: 3 })} ${material.unit || ''}`], ['Minimum stock', `${Number(material.minimum_stock || 0).toLocaleString('id-ID', { maximumFractionDigits: 3 })} ${material.unit || ''}`], ['Low alert', stockThreshold > 0 ? `${stockThreshold.toLocaleString('id-ID', { maximumFractionDigits: 3 })} ${material.unit || ''}` : '-']]],
    ['CAS and supplier', [['CAS', formatNullable(resolved.cas_number)], ['Supplier', formatNullable(material.vendor)], ['Workbook', formatNullable(resolved.workbook_code)]]],
    ['Usage recommendation', [['Typical use', resolved.reference_use_level_typical_percent != null ? formatPercentage(resolved.reference_use_level_typical_percent, 2) : '-'], ['Max use', resolved.reference_use_level_max_percent != null ? formatPercentage(resolved.reference_use_level_max_percent, 2) : '-']]],
    ['Safety / audit status', [['IFRA', resolved.ifra_limit != null ? formatPercentage(resolved.ifra_limit, 2) : '-'], ['Impact', impact ?? '-'], ['Life hours', life ?? '-']]],
  ];

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>{material.name} - Solivagant</title></Helmet>
      <main className="mobile-page space-y-3">
        <MobileTopBar title={material.name} subtitle={resolved.cas_number ? `CAS ${resolved.cas_number}` : undefined} onBack={handleBack} action={<MobileStatusBadge tone={ready ? 'active' : 'warning'}>{ready ? 'Ready' : 'Audit'}</MobileStatusBadge>} />
        {lowStock ? (
          <section className="mobile-card border border-rose-200 bg-rose-50 p-3">
            <div className="text-[10px] font-bold uppercase text-rose-700">Low stock</div>
            <div className="mt-1 text-sm font-bold text-rose-900">
              {stockQuantity.toLocaleString('id-ID', { maximumFractionDigits: 3 })} {material.unit || ''} remaining
            </div>
          </section>
        ) : null}
        <MobileActionDock
          primary={(
            <Button className="mobile-interactive mobile-add-action mobile-pressable h-12 w-full rounded-2xl text-xs font-bold" onClick={() => navigate(`/mobile/formulas/new?materialIds=${material.id}`)}>
              <Plus className="mr-2 h-4 w-4" />
              Use in Formula
            </Button>
          )}
          secondary={[
            <Button key="edit" variant="outline" className="mobile-interactive mobile-pressable h-11 rounded-2xl bg-white text-xs" onClick={() => navigate(`/mobile/raw-material/${material.id}/edit`)}><Pencil className="mr-1 h-4 w-4" />Edit</Button>,
            <Button key="import" variant="outline" className="mobile-interactive mobile-pressable h-11 rounded-2xl bg-white text-xs" onClick={() => setGuidanceOpen(true)}><Link2 className="mr-1 h-4 w-4" />Import</Button>,
          ]}
          destructive={<Button variant="outline" className="mobile-interactive mobile-delete-action h-11 rounded-2xl border-rose-200 bg-rose-50 text-xs text-rose-700" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>}
        />
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
        open={guidanceOpen}
        onOpenChange={setGuidanceOpen}
        title="Import Guidance URL"
        footer={<Button type="button" onClick={handleImportGuidance} disabled={guidanceState === 'loading'} className="h-10 w-full rounded-xl text-xs">{guidanceState === 'loading' ? 'Importing guidance...' : 'Import Guidance'}</Button>}
      >
        <div className="grid gap-3 pb-2">
          <div className="space-y-1"><Label className="text-xs">URL</Label><Input value={guidanceForm.url} onChange={(event) => setGuidanceForm((current) => ({ ...current, url: event.target.value }))} className="h-10 rounded-xl bg-white text-xs" placeholder="https://..." /></div>
          <div className="space-y-1"><Label className="text-xs">Source</Label><MobileSegmentedControl options={GUIDANCE_SOURCE_OPTIONS} value={guidanceForm.sourceType} onChange={(sourceType) => setGuidanceForm((current) => ({ ...current, sourceType }))} /></div>
          {guidanceSummary.length ? <MobileInlineNotice tone="success" title="Guidance imported" description={guidanceSummary.slice(0, 3).join(' · ')} /> : null}
          {guidanceState === 'error' ? <MobileInlineNotice tone="error" title="Import failed" description="Check the URL and try again." /> : null}
          {guidanceState === 'success' ? <MobileInlineNotice tone="success" title="Insights updated" description="Guidance imported and material insights updated." /> : null}
        </div>
      </MobileBottomSheet>
    </MobileAuthenticatedLayout>
  );
};

export default MobileRawMaterialDetailPage;
