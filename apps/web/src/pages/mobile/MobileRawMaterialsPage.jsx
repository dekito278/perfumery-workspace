import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, FolderTree, Package, PackageCheck, Plus, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSearchBar from '@/components/mobile-ui/MobileSearchBar.jsx';
import MobileFilterChips from '@/components/mobile-ui/MobileFilterChips.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import { getMobileFromState } from '@/hooks/useMobileBackNavigation.js';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileLoadingSkeleton from '@/components/mobile-ui/MobileLoadingSkeleton.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import MobileStatePanel from '@/components/mobile-ui/MobileStatePanel.jsx';
import MobileInlineNotice from '@/components/mobile-ui/MobileInlineNotice.jsx';
import { triggerMobileHaptic } from '@/hooks/useMobileTouchFeedback.js';
import DeleteConfirmationDialog from '@/components/mobile-ui/DeleteConfirmationDialog.jsx';
import PaginationOrLoadMore from '@/components/mobile-ui/PaginationOrLoadMore.jsx';
import RawMaterialCardMobile from '@/components/mobile/RawMaterialCardMobile.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useBriefMaterialShortlists } from '@/hooks/useBriefMaterialShortlists.js';
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

const cleanupOptions = [
  { value: 'active', label: 'Active' },
  { value: 'needs_cleanup', label: 'Needs Cleanup' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const runWithTimeout = (promise, timeoutMs = 4500, message = 'Request timed out') => Promise.race([
  promise,
  new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(message)), timeoutMs);
  }),
]);

const runMaterialLoadWithTimeout = (promise) => runWithTimeout(
  promise,
  15000,
  'Material loading took too long. Please try again.',
);

const runGuidanceWithTimeout = (promise) => runWithTimeout(
  promise,
  1800,
  'Material guidance timed out',
);

const shouldSkipGuidanceEnrichment = ({ cleanupFilter }) => (
  cleanupFilter === 'needs_cleanup'
  || cleanupFilter === 'archived'
);

const runDeleteWithTimeout = (promise, timeoutMs = 12000) => Promise.race([
  promise,
  new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error('Delete is taking longer than expected. Please try again in a moment.')), timeoutMs);
  }),
]);

const MobileRawMaterialsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const briefId = searchParams.get('briefId') || '';
  const activeBriefId = UUID_PATTERN.test(briefId) ? briefId : '';
  const initialAction = searchParams.get('action') || '';
  const { fetchMaterialsPage, updateMaterial, deleteMaterial } = useRawMaterials();
  const { getBriefs } = useBriefs();
  const { deleteBriefMaterialShortlistItem, getBriefMaterialShortlist, upsertBriefMaterialShortlist } = useBriefMaterialShortlists();
  const loadTokenRef = useRef(0);
  const [materials, setMaterials] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  const [briefContext, setBriefContext] = useState(null);
  const [shortlistItems, setShortlistItems] = useState([]);
  const [shortlistLoading, setShortlistLoading] = useState(false);
  const [savingShortlistId, setSavingShortlistId] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [referenceFilter, setReferenceFilter] = useState('all');
  const [cleanupFilter, setCleanupFilter] = useState('active');
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE_SIZE);
  const [guidanceTarget, setGuidanceTarget] = useState(null);
  const [guidanceState, setGuidanceState] = useState('empty');
  const [guidanceForm, setGuidanceForm] = useState({ url: '', sourceType: 'perfumersworld' });
  const [guidanceSummary, setGuidanceSummary] = useState([]);
  const [stockTarget, setStockTarget] = useState(null);
  const [stockSaving, setStockSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [stockForm, setStockForm] = useState({
    stock_quantity: '',
    minimum_stock: '',
    low_stock_threshold: '',
    cost_per_unit: '',
  });
  const shortlistMaterialIds = useMemo(() => new Set(shortlistItems.map((item) => item.raw_material_id).filter(Boolean)), [shortlistItems]);

  useEffect(() => {
    if (initialAction === 'add') {
      navigate('/mobile/raw-materials/new', { replace: true, state: getMobileFromState(location) });
    }
  }, [initialAction, location, navigate]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timeoutId);
  }, [query]);

  const loadMaterials = useCallback(async () => {
    const loadToken = loadTokenRef.current + 1;
    loadTokenRef.current = loadToken;
    let baseLoaded = false;
    setLoading(true);
    setLoadError('');
    setGuidanceLoading(false);

    const applyMaterialFilters = (items = []) => items.filter((material) => {
      const resolved = getResolvedGuidanceValues(material);
      const hasGuidance = Boolean(resolved.workbook_code || resolved.reference_impact || resolved.reference_life_hours || resolved.ifra_limit);
      const dataStatus = material.data_status || 'active';
      const missingPrice = Number(material.cost_per_unit || 0) <= 0;
      const missingStock = Number(material.stock_quantity || 0) <= 0;
      const needsCleanup = dataStatus === 'needs_review' || !hasGuidance || missingPrice || missingStock;
      if (cleanupFilter === 'active' && dataStatus === 'archived') return false;
      if (cleanupFilter === 'archived') return dataStatus === 'archived';
      if (cleanupFilter === 'needs_cleanup' && !needsCleanup) return false;
      if (referenceFilter === 'has_guidance') return hasGuidance;
      if (referenceFilter === 'high_impact') return Number(getResolvedGuidanceNumber(material, 'reference_impact') || 0) >= 7;
      if (referenceFilter === 'missing_data') {
        return (
          !resolved.reference_abc_primary_family
          || !Number(resolved.reference_impact || 0)
          || !Number(resolved.reference_life_hours || 0)
          || !resolved.cas_number
          || resolved.ifra_limit === null
          || resolved.ifra_limit === undefined
          || resolved.ifra_limit === ''
        );
      }
      return true;
    });

    try {
      const result = await runMaterialLoadWithTimeout(fetchMaterialsPage({
        page: 1,
        pageSize: referenceFilter === 'missing_data'
          ? Math.max(visibleCount, MOBILE_PAGE_SIZE * 6)
          : Math.max(visibleCount, MOBILE_PAGE_SIZE * 2),
        searchTerm: debouncedQuery,
        typeFilter: 'all',
        categoryFilter: 'all',
        referenceFilter: ['matched', 'unmatched', 'ifra_limited', 'missing_data'].includes(referenceFilter) ? referenceFilter : 'all',
        lightweight: true,
      }));
      if (loadToken !== loadTokenRef.current) return;
      const baseItems = result.items || [];
      const baseFilteredItems = applyMaterialFilters(baseItems);
      setMaterials(baseFilteredItems);
      setTotal(debouncedQuery || ['has_guidance', 'high_impact'].includes(referenceFilter) ? baseFilteredItems.length : result.total || baseFilteredItems.length);
      baseLoaded = true;
      setLoading(false);
      if (shouldSkipGuidanceEnrichment({ cleanupFilter })) {
        setGuidanceLoading(false);
        return;
      }

      setGuidanceLoading(true);
      const enrichedItems = hydrateGuidanceFromPeerMaterials(await runGuidanceWithTimeout(enrichMaterialsWithGuidance(baseItems)));
      if (loadToken !== loadTokenRef.current) return;
      const filteredItems = applyMaterialFilters(enrichedItems);
      setMaterials(filteredItems);
      setTotal(debouncedQuery || ['has_guidance', 'high_impact'].includes(referenceFilter) ? filteredItems.length : result.total || filteredItems.length);
    } catch (error) {
      if (loadToken === loadTokenRef.current && !baseLoaded) {
        toast.error(error.message || 'Failed to load materials');
        setLoadError(error.message || 'Materials could not be loaded right now.');
        setLoading(false);
      } else {
        console.warn('Material guidance enrichment delayed:', error);
      }
    } finally {
      if (loadToken === loadTokenRef.current) {
        setLoading(false);
        setGuidanceLoading(false);
      }
    }
  }, [cleanupFilter, debouncedQuery, fetchMaterialsPage, referenceFilter, visibleCount]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  useEffect(() => setVisibleCount(MOBILE_PAGE_SIZE), [debouncedQuery, referenceFilter, cleanupFilter]);

  const refreshShortlist = useCallback(async () => {
    if (!activeBriefId) {
      setBriefContext(null);
      setShortlistItems([]);
      return;
    }

    setShortlistLoading(true);
    try {
      const [briefRows, shortlistRows] = await Promise.all([
        getBriefs(),
        getBriefMaterialShortlist(activeBriefId),
      ]);
      setBriefContext((briefRows || []).find((brief) => brief.id === activeBriefId) || null);
      setShortlistItems(shortlistRows || []);
    } catch (error) {
      toast.error('Failed to load brief picker');
    } finally {
      setShortlistLoading(false);
    }
  }, [activeBriefId, getBriefMaterialShortlist, getBriefs]);

  useEffect(() => {
    refreshShortlist();
  }, [refreshShortlist]);

  const openGuidance = (material) => {
    setGuidanceTarget(material);
    setGuidanceState('empty');
    setGuidanceSummary([]);
    setGuidanceForm({ url: '', sourceType: 'perfumersworld' });
  };

  const openStockEditor = (material) => {
    setStockTarget(material);
    setStockForm({
      stock_quantity: material.stock_quantity ?? '',
      minimum_stock: material.minimum_stock ?? '',
      low_stock_threshold: material.low_stock_threshold ?? '',
      cost_per_unit: material.cost_per_unit ?? '',
    });
  };

  const toNullableNumber = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  };

  const handleSaveStock = async () => {
    if (!stockTarget) return;
    setStockSaving(true);
    try {
      const patch = {
        stock_quantity: toNullableNumber(stockForm.stock_quantity) || 0,
        minimum_stock: toNullableNumber(stockForm.minimum_stock) || 0,
        low_stock_threshold: toNullableNumber(stockForm.low_stock_threshold),
        cost_per_unit: toNullableNumber(stockForm.cost_per_unit) || 0,
      };
      const updated = await updateMaterial(stockTarget.id, patch);
      const [enrichedUpdated] = await enrichMaterialsWithGuidance([updated]);
      const nextMaterial = enrichedUpdated || updated;
      setMaterials((current) => current.map((material) => material.id === stockTarget.id ? nextMaterial : material));
      setStockTarget(nextMaterial);
      triggerMobileHaptic('success');
      toast.success('Stock and price updated');
      setStockTarget(null);
    } catch (error) {
      toast.error(error.message || 'Failed to update stock');
    } finally {
      setStockSaving(false);
    }
  };

  const handleDeleteMaterial = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await runDeleteWithTimeout(deleteMaterial(deleteTarget.id), 30000);
      setMaterials((current) => current.filter((material) => material.id !== deleteTarget.id));
      setDeleteTarget(null);
      triggerMobileHaptic('success');
      toast.success('Material deleted');
      await loadMaterials();
    } catch (error) {
      toast.error(error.message || 'Failed to delete material');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleArchiveMaterial = async (material) => {
    if (!material?.id) return;
    const shouldArchive = material.data_status !== 'archived';
    try {
      const updated = await updateMaterial(material.id, {
        data_status: shouldArchive ? 'archived' : 'active',
        archived_at: shouldArchive ? new Date().toISOString() : null,
      });
      setMaterials((current) => current
        .map((entry) => entry.id === material.id ? { ...entry, ...updated } : entry)
        .filter((entry) => cleanupFilter === 'all' || cleanupFilter === 'archived' || entry.data_status !== 'archived'));
      triggerMobileHaptic('success');
      toast.success(shouldArchive ? 'Material archived' : 'Material restored');
    } catch (error) {
      toast.error(error.message || 'Failed to update material status');
    }
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
      triggerMobileHaptic('success');
      toast.success(`${getGuidanceSourceLabel(guidanceForm.sourceType)} guidance imported`);
      await loadMaterials();
    } catch (error) {
      setGuidanceState('error');
      toast.error(error.message || 'Unable to import guidance');
    }
  };

  const handleToggleBriefMaterial = async (material) => {
    if (!activeBriefId || !material?.id) {
      if (material?.id) {
        navigate(`/mobile/formulas/new?materialIds=${material.id}`);
      }
      return;
    }

    const existingItem = shortlistItems.find((item) => item.raw_material_id === material.id);
    setSavingShortlistId(material.id);
    try {
      if (existingItem) {
        await deleteBriefMaterialShortlistItem(existingItem.id);
        setShortlistItems((current) => current.filter((item) => item.id !== existingItem.id));
        triggerMobileHaptic('success');
        toast.success('Removed from brief shortlist');
      } else {
        const nextItems = await upsertBriefMaterialShortlist(activeBriefId, [{
          raw_material_id: material.id,
          role: 'candidate',
        }]);
        setShortlistItems(nextItems || []);
        triggerMobileHaptic('success');
        toast.success('Added to brief shortlist');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update shortlist');
    } finally {
      setSavingShortlistId('');
    }
  };

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>Mobile Materials - Solivagant</title></Helmet>
        <main className="mobile-page space-y-3">
        <MobileTopBar
          title="Materials"
          subtitle={activeBriefId ? (briefContext?.title || 'Brief picker') : undefined}
          action={<Button type="button" size="icon" onClick={() => navigate('/mobile/raw-materials/new', { state: getMobileFromState(location) })} className="mobile-interactive mobile-add-action mobile-pressable h-11 w-11 rounded-2xl"><Plus className="h-5 w-5" /></Button>}
        />
        {activeBriefId ? (
          <section className="mobile-soft-card p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase text-amber-700">Brief material picker</div>
                <h2 className="mt-0.5 truncate text-sm font-bold text-[#1f2937]">{briefContext?.title || 'Linked brief'}</h2>
                <p className="mt-1 text-[11px] font-semibold text-[#6b7280]">{shortlistItems.length} selected candidates</p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={shortlistLoading}
                onClick={() => navigate(`/mobile/briefs/${activeBriefId}`)}
                className="h-10 shrink-0 rounded-xl bg-white px-3 text-xs font-bold"
              >
                Done
              </Button>
            </div>
          </section>
        ) : null}
        <div className="mobile-material-search-panel">
          <MobileSearchBar value={query} onChange={setQuery} placeholder="Search material, CAS, supplier..." disabled={loading} />
          <MobileFilterChips options={cleanupOptions} value={cleanupFilter} onChange={setCleanupFilter} className="flex-nowrap overflow-x-auto mobile-segment-scroll" />
          <MobileFilterChips options={referenceOptions} value={referenceFilter} onChange={setReferenceFilter} className="flex-nowrap overflow-x-auto mobile-segment-scroll" />
          {guidanceLoading && !loading ? (
            <MobileInlineNotice
              tone="loading"
              title="Guidance sedang disinkronkan"
              description="Material tetap bisa dipakai sambil data referensi diperbarui."
              className="mt-2"
            />
          ) : null}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" className="mobile-interactive mobile-pressable rounded-2xl bg-white" onClick={() => navigate('/mobile/raw-material-audit')}><SlidersHorizontal className="mr-2 h-4 w-4" />Audit</Button>
            <Button variant="outline" className="mobile-interactive mobile-pressable rounded-2xl bg-white" onClick={() => navigate('/mobile/categories')}><FolderTree className="mr-2 h-4 w-4" />Categories</Button>
          </div>
        </div>
        {loading && !materials.length ? <MobileLoadingSkeleton count={4} title="Loading materials..." subtitle="Preparing stock, guidance, and cleanup status." /> : loadError ? (
          <MobileStatePanel
            tone="error"
            title="Couldn’t load materials"
            description={loadError}
            action="Try again"
            onAction={loadMaterials}
          />
        ) : materials.length === 0 ? (
          <MobileEmptyState
            icon={Package}
            title={debouncedQuery || referenceFilter !== 'all' || cleanupFilter !== 'active' ? 'No matching materials' : 'No materials yet'}
            description={debouncedQuery || referenceFilter !== 'all' || cleanupFilter !== 'active'
              ? 'Try another keyword or clear the current material filters.'
              : 'Add your first material to start building stock, guidance, and costing data.'}
            action={debouncedQuery || referenceFilter !== 'all' || cleanupFilter !== 'active' ? 'Clear filters' : 'Add Material'}
            onAction={debouncedQuery || referenceFilter !== 'all' || cleanupFilter !== 'active'
              ? () => {
                setQuery('');
                setReferenceFilter('all');
                setCleanupFilter('active');
              }
              : () => navigate('/mobile/raw-materials/new', { state: getMobileFromState(location) })}
          />
        ) : (
          <>
            <div className="space-y-2">
              {materials.slice(0, visibleCount).map((material) => (
                <RawMaterialCardMobile
                  key={material.id}
                  material={material}
                  onOpen={() => navigate(`/mobile/raw-material/${material.id}`, { state: getMobileFromState(location) })}
                  onAddToFormula={() => activeBriefId ? handleToggleBriefMaterial(material) : openStockEditor(material)}
                  onArchive={() => handleToggleArchiveMaterial(material)}
                  onDelete={() => setDeleteTarget(material)}
                  onOpenGuidance={() => openGuidance(material)}
                  addActionActive={shortlistMaterialIds.has(material.id)}
                  addActionDisabled={savingShortlistId === material.id}
                  addActionIcon={activeBriefId ? (shortlistMaterialIds.has(material.id) ? Check : Plus) : PackageCheck}
                  addActionLabel={activeBriefId ? (shortlistMaterialIds.has(material.id) ? 'Picked' : 'Pick') : 'Stock'}
                />
              ))}
            </div>
            <PaginationOrLoadMore visibleCount={Math.min(materials.length, visibleCount)} totalCount={total} loading={loading} onLoadMore={() => setVisibleCount((current) => current + MOBILE_PAGE_SIZE)} />
          </>
        )}
      </main>
      <DeleteConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemName={deleteTarget?.name || 'material'}
        onConfirm={handleDeleteMaterial}
        loading={deleting}
      />
      <MobileBottomSheet
        open={Boolean(stockTarget)}
        onOpenChange={(open) => !open && setStockTarget(null)}
        title="Edit Stock"
        description={stockTarget?.name}
        footer={<Button type="button" onClick={handleSaveStock} disabled={stockSaving} className="h-12 w-full rounded-2xl">{stockSaving ? 'Saving...' : 'Update Stock & Price'}</Button>}
      >
        <div className="grid gap-4 pb-2">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            Current unit: {stockTarget?.unit || 'g'}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Stock on hand</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={stockForm.stock_quantity}
                onChange={(event) => setStockForm((current) => ({ ...current, stock_quantity: event.target.value }))}
                className="rounded-2xl bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label>Minimum stock</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={stockForm.minimum_stock}
                onChange={(event) => setStockForm((current) => ({ ...current, minimum_stock: event.target.value }))}
                className="rounded-2xl bg-white"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Low stock alert</Label>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={stockForm.low_stock_threshold}
              onChange={(event) => setStockForm((current) => ({ ...current, low_stock_threshold: event.target.value }))}
              className="rounded-2xl bg-white"
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label>Unit price per 10 {stockTarget?.unit || 'g'}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={stockForm.cost_per_unit}
              onChange={(event) => setStockForm((current) => ({ ...current, cost_per_unit: event.target.value }))}
              className="rounded-2xl bg-white"
            />
          </div>
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
          {guidanceSummary.length ? <MobileInlineNotice tone="success" title="Guidance imported" description={guidanceSummary.slice(0, 3).join(' · ')} /> : null}
          {guidanceState === 'error' ? <MobileInlineNotice tone="error" title="Import failed" description="Check the URL and try again." /> : null}
          {guidanceState === 'success' ? <MobileInlineNotice tone="success" title="Insights updated" description="Material guidance is ready to use." /> : null}
        </div>
      </MobileBottomSheet>
    </MobileAuthenticatedLayout>
  );
};

export default MobileRawMaterialsPage;

