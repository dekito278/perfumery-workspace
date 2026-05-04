import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FolderTree, Package, Plus, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSearchBar from '@/components/mobile-ui/MobileSearchBar.jsx';
import MobileFilterChips from '@/components/mobile-ui/MobileFilterChips.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileLoadingSkeleton from '@/components/mobile-ui/MobileLoadingSkeleton.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import PaginationOrLoadMore from '@/components/mobile-ui/PaginationOrLoadMore.jsx';
import RawMaterialCardMobile from '@/components/mobile/RawMaterialCardMobile.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { MOBILE_PAGE_SIZE } from '@/pages/mobile/mobilePageUtils.js';
import {
  GUIDANCE_SOURCE_OPTIONS,
  buildGuidancePatch,
  getGuidanceSourceLabel,
  importGuidanceBySource,
  summarizeImportedGuidance,
} from '@/utils/mobileGuidanceImport.js';
import { enrichMaterialsWithGuidance, getResolvedGuidanceNumber, getResolvedGuidanceValues } from '@/utils/mobileRawMaterialGuidance.js';

const normalizePeerKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

const buildGuidanceScore = (material) => {
  const resolved = getResolvedGuidanceValues(material);
  return [
    resolved.reference_impact,
    resolved.reference_life_hours,
    resolved.reference_abc_primary_family,
    resolved.ifra_limit,
    resolved.workbook_code,
  ].filter(Boolean).length;
};

const hydrateGuidanceFromPeerMaterials = (materials = []) => {
  const peerMap = new Map();
  materials.forEach((material) => {
    const resolved = getResolvedGuidanceValues(material);
    const keys = [
      normalizePeerKey(resolved.cas_number || material.cas_number),
      normalizePeerKey(material.name).replace(/undiliuted/g, 'undiluted').replace(/undilute/g, 'undiluted'),
    ].filter(Boolean);

    keys.forEach((key) => {
      const currentBest = peerMap.get(key);
      if (!currentBest || buildGuidanceScore(material) > buildGuidanceScore(currentBest)) {
        peerMap.set(key, material);
      }
    });
  });

  return materials.map((material) => {
    const resolved = getResolvedGuidanceValues(material);
    if (resolved.reference_impact && resolved.reference_life_hours) {
      return material;
    }

    const keys = [
      normalizePeerKey(resolved.cas_number || material.cas_number),
      normalizePeerKey(material.name).replace(/undiliuted/g, 'undiluted').replace(/undilute/g, 'undiluted'),
    ].filter(Boolean);
    const peer = keys.map((key) => peerMap.get(key)).find((entry) => entry && entry.id !== material.id && buildGuidanceScore(entry) > buildGuidanceScore(material));
    if (!peer) {
      return material;
    }

    const peerResolved = getResolvedGuidanceValues(peer);
    return {
      ...material,
      guidance_resolved_values: {
        ...(material.guidance_resolved_values || {}),
        workbook_code: resolved.workbook_code || peerResolved.workbook_code,
        reference_abc_primary_family: resolved.reference_abc_primary_family || peerResolved.reference_abc_primary_family,
        reference_impact: resolved.reference_impact || peerResolved.reference_impact,
        reference_life_hours: resolved.reference_life_hours || peerResolved.reference_life_hours,
        reference_use_level_typical_percent: resolved.reference_use_level_typical_percent || peerResolved.reference_use_level_typical_percent,
        reference_use_level_max_percent: resolved.reference_use_level_max_percent || peerResolved.reference_use_level_max_percent,
        ifra_limit: resolved.ifra_limit || peerResolved.ifra_limit,
        cas_number: resolved.cas_number || peerResolved.cas_number,
      },
      guidance_reference_profile: material.guidance_reference_profile || peer.guidance_reference_profile,
    };
  });
};

const referenceOptions = [
  { value: 'all', label: 'All' },
  { value: 'has_guidance', label: 'Guided' },
  { value: 'unmatched', label: 'Needs Guidance' },
  { value: 'high_impact', label: 'High Impact' },
  { value: 'missing_data', label: 'Missing Data' },
];

const MobileRawMaterialsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const briefId = searchParams.get('briefId') || '';
  const initialAction = searchParams.get('action') || '';
  const { fetchMaterialsPage, addMaterial, updateMaterial } = useRawMaterials();
  const [materials, setMaterials] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [referenceFilter, setReferenceFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE_SIZE);
  const [addOpen, setAddOpen] = useState(initialAction === 'add');
  const [guidanceTarget, setGuidanceTarget] = useState(null);
  const [guidanceState, setGuidanceState] = useState('empty');
  const [guidanceForm, setGuidanceForm] = useState({ url: '', sourceType: 'perfumersworld' });
  const [guidanceSummary, setGuidanceSummary] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ name: '', category: '', cas_number: '', vendor: '', type: 'material', unit: 'g' });

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const result = await fetchMaterialsPage({
        page: 1,
        pageSize: Math.max(visibleCount, 160),
        searchTerm: query,
        typeFilter: 'all',
        categoryFilter: 'all',
        referenceFilter: ['matched', 'unmatched', 'ifra_limited'].includes(referenceFilter) ? referenceFilter : 'all',
      });
      const enrichedItems = hydrateGuidanceFromPeerMaterials(await enrichMaterialsWithGuidance(result.items || []));
      const filteredItems = enrichedItems.filter((material) => {
        const resolved = getResolvedGuidanceValues(material);
        const hasGuidance = Boolean(resolved.workbook_code || resolved.reference_impact || resolved.reference_life_hours || resolved.ifra_limit);
        if (referenceFilter === 'has_guidance') return hasGuidance;
        if (referenceFilter === 'high_impact') return Number(getResolvedGuidanceNumber(material, 'reference_impact') || 0) >= 7;
        if (referenceFilter === 'missing_data') return !resolved.reference_impact || !resolved.reference_life_hours;
        return true;
      });
      setMaterials(filteredItems);
      setTotal(query || ['has_guidance', 'high_impact', 'missing_data'].includes(referenceFilter) ? filteredItems.length : result.total || filteredItems.length);
    } catch (error) {
      toast.error('Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, referenceFilter, visibleCount]);

  useEffect(() => setVisibleCount(MOBILE_PAGE_SIZE), [query, referenceFilter]);

  const openGuidance = (material) => {
    setGuidanceTarget(material);
    setGuidanceState('empty');
    setGuidanceSummary([]);
    setGuidanceForm({ url: '', sourceType: 'perfumersworld' });
  };

  const handleImportGuidance = async () => {
    if (!guidanceTarget) return;
    if (!/^https?:\/\//i.test(guidanceForm.url.trim())) {
      setGuidanceState('error');
      toast.error('Unable to import guidance');
      return;
    }
    setGuidanceState('loading');
    try {
      const imported = await importGuidanceBySource({ sourceType: guidanceForm.sourceType, url: guidanceForm.url.trim() });
      const updated = await updateMaterial(guidanceTarget.id, buildGuidancePatch({
        material: guidanceTarget,
        sourceType: guidanceForm.sourceType,
        imported,
      }));
      setGuidanceSummary(summarizeImportedGuidance({ sourceType: guidanceForm.sourceType, imported }));
      const [enrichedUpdated] = await enrichMaterialsWithGuidance([updated]);
      setMaterials((current) => current.map((material) => material.id === updated.id ? enrichedUpdated : material));
      setGuidanceState('success');
      setGuidanceTarget(enrichedUpdated);
      toast.success(`${getGuidanceSourceLabel(guidanceForm.sourceType)} guidance imported`);
      await loadMaterials();
    } catch (error) {
      setGuidanceState('error');
      toast.error(error.message || 'Unable to import guidance');
    }
  };

  const handleCreateMaterial = async () => {
    if (!newMaterial.name.trim()) {
      toast.error('Material name is required');
      return;
    }
    setCreating(true);
    try {
      await addMaterial({
        ...newMaterial,
        quantity: 0,
        cost_per_unit: 0,
      });
      toast.success('Material added');
      setAddOpen(false);
      setNewMaterial({ name: '', category: '', cas_number: '', vendor: '', type: 'material', unit: 'g' });
      await loadMaterials();
    } catch (error) {
      toast.error(error.message || 'Failed to add material');
    } finally {
      setCreating(false);
    }
  };

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>Mobile Materials - Perfumer Studio</title></Helmet>
        <main className="mobile-page space-y-3">
        <MobileTopBar
          title="Materials"
          subtitle={briefId ? 'Brief linked' : undefined}
          action={<Button type="button" size="icon" onClick={() => setAddOpen(true)} className="h-11 w-11 rounded-2xl"><Plus className="h-5 w-5" /></Button>}
        />
        <div className="mobile-sticky-search">
          <MobileSearchBar value={query} onChange={setQuery} placeholder="Search material, CAS, supplier..." disabled={loading} />
          <MobileFilterChips options={referenceOptions} value={referenceFilter} onChange={setReferenceFilter} className="flex-nowrap overflow-x-auto mobile-segment-scroll" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" className="rounded-2xl bg-white" onClick={() => navigate('/mobile/raw-material-audit')}><SlidersHorizontal className="mr-2 h-4 w-4" />Audit</Button>
            <Button variant="outline" className="rounded-2xl bg-white" onClick={() => navigate('/mobile/categories')}><FolderTree className="mr-2 h-4 w-4" />Categories</Button>
          </div>
        </div>
        {loading && !materials.length ? <MobileLoadingSkeleton count={4} /> : materials.length === 0 ? (
          <MobileEmptyState icon={Package} title="No materials found" action="Add Material" onAction={() => setAddOpen(true)} />
        ) : (
          <>
            <div className="space-y-2">
              {materials.slice(0, visibleCount).map((material) => (
                <RawMaterialCardMobile
                  key={material.id}
                  material={material}
                  onOpen={() => navigate(`/mobile/raw-material/${material.id}`)}
                  onAddToFormula={() => navigate(`/mobile/formulas/new?materialIds=${material.id}`)}
                  onOpenGuidance={() => openGuidance(material)}
                />
              ))}
            </div>
            <PaginationOrLoadMore visibleCount={Math.min(materials.length, visibleCount)} totalCount={total} loading={loading} onLoadMore={() => setVisibleCount((current) => current + MOBILE_PAGE_SIZE)} />
          </>
        )}
      </main>
      <MobileBottomSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Material"
        footer={<Button type="button" onClick={handleCreateMaterial} disabled={creating} className="h-12 w-full rounded-2xl">{creating ? 'Saving...' : 'Save Material'}</Button>}
      >
        <div className="grid gap-4 pb-2">
          {[
            ['name', 'Material name'],
            ['cas_number', 'CAS number'],
            ['category', 'Category'],
            ['vendor', 'Supplier'],
          ].map(([field, label]) => (
            <div key={field} className="space-y-2">
              <Label>{label}</Label>
              <Input value={newMaterial[field]} onChange={(event) => setNewMaterial((current) => ({ ...current, [field]: event.target.value }))} className="rounded-2xl bg-white" />
            </div>
          ))}
        </div>
      </MobileBottomSheet>
      <MobileBottomSheet
        open={Boolean(guidanceTarget)}
        onOpenChange={(open) => !open && setGuidanceTarget(null)}
        title="Import Guidance URL"
        description={guidanceTarget?.name}
        footer={<Button type="button" onClick={handleImportGuidance} disabled={guidanceState === 'loading'} className="h-10 w-full rounded-xl text-xs">{guidanceState === 'loading' ? 'Importing guidance...' : 'Import Guidance'}</Button>}
      >
        <div className="grid gap-3 pb-2">
          <div className="space-y-1"><Label className="text-xs">URL</Label><Input value={guidanceForm.url} onChange={(event) => setGuidanceForm((current) => ({ ...current, url: event.target.value }))} className="h-10 rounded-xl bg-white text-xs" placeholder="https://..." /></div>
          <div className="space-y-1"><Label className="text-xs">Source</Label><MobileSegmentedControl options={GUIDANCE_SOURCE_OPTIONS} value={guidanceForm.sourceType} onChange={(sourceType) => setGuidanceForm((current) => ({ ...current, sourceType }))} /></div>
          {guidanceSummary.length ? <div className="rounded-xl bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">{guidanceSummary.slice(0, 3).join(' · ')}</div> : null}
          {guidanceState === 'error' ? <div className="rounded-xl bg-rose-50 p-2 text-xs font-semibold text-rose-700">Unable to import guidance.</div> : null}
          {guidanceState === 'success' ? <div className="rounded-xl bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">Guidance imported and material insights updated.</div> : null}
        </div>
      </MobileBottomSheet>
    </MobileAuthenticatedLayout>
  );
};

export default MobileRawMaterialsPage;
