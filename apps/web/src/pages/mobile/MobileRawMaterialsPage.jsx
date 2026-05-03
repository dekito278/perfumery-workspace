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
import MobileLoadingSkeleton from '@/components/mobile-ui/MobileLoadingSkeleton.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import PaginationOrLoadMore from '@/components/mobile-ui/PaginationOrLoadMore.jsx';
import RawMaterialCardMobile from '@/components/mobile/RawMaterialCardMobile.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useBriefMaterialShortlists } from '@/hooks/useBriefMaterialShortlists.js';
import { MOBILE_PAGE_SIZE } from '@/pages/mobile/mobilePageUtils.js';

const referenceOptions = [
  { value: 'all', label: 'All' },
  { value: 'matched', label: 'Matched' },
  { value: 'unmatched', label: 'Unmatched' },
  { value: 'ifra_limited', label: 'IFRA' },
  { value: 'has_guidance', label: 'Guidance' },
];

const MobileRawMaterialsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const briefId = searchParams.get('briefId') || '';
  const initialAction = searchParams.get('action') || '';
  const { fetchMaterialsPage, addMaterial } = useRawMaterials();
  const { upsertBriefMaterialShortlist } = useBriefMaterialShortlists();
  const [materials, setMaterials] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [referenceFilter, setReferenceFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE_SIZE);
  const [addOpen, setAddOpen] = useState(initialAction === 'add');
  const [creating, setCreating] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ name: '', category: '', cas_number: '', vendor: '', type: 'material', unit: 'g' });

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const result = await fetchMaterialsPage({
        page: 1,
        pageSize: visibleCount,
        searchTerm: query,
        typeFilter: 'all',
        categoryFilter: 'all',
        referenceFilter,
      });
      setMaterials(result.items || []);
      setTotal(result.total || 0);
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

  const handleAddToShortlist = async (material) => {
    if (!briefId) {
      toast.info('Open materials from a brief to shortlist candidates');
      return;
    }
    try {
      await upsertBriefMaterialShortlist(briefId, [{ raw_material_id: material.id, role: 'candidate' }]);
      toast.success('Material added to shortlist');
    } catch (error) {
      toast.error(error.message || 'Failed to add shortlist item');
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
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Materials"
          subtitle={briefId ? 'Shortlist mode' : 'Raw material library'}
          action={<Button type="button" size="icon" onClick={() => setAddOpen(true)} className="h-11 w-11 rounded-2xl"><Plus className="h-5 w-5" /></Button>}
        />
        <div className="mobile-sticky-search">
          <MobileSearchBar value={query} onChange={setQuery} placeholder="Search material, CAS, supplier..." disabled={loading} />
          <MobileFilterChips options={referenceOptions} value={referenceFilter} onChange={setReferenceFilter} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" className="rounded-2xl bg-white" onClick={() => navigate('/mobile/raw-material-audit')}><SlidersHorizontal className="mr-2 h-4 w-4" />Audit</Button>
            <Button variant="outline" className="rounded-2xl bg-white" onClick={() => navigate('/mobile/categories')}><FolderTree className="mr-2 h-4 w-4" />Categories</Button>
          </div>
        </div>
        {loading && !materials.length ? <MobileLoadingSkeleton count={4} /> : materials.length === 0 ? (
          <MobileEmptyState icon={Package} title="No materials found" description="Try another search or add a new material." action="Add Material" onAction={() => setAddOpen(true)} />
        ) : (
          <>
            <div className="space-y-3">
              {materials.slice(0, visibleCount).map((material) => (
                <RawMaterialCardMobile
                  key={material.id}
                  material={material}
                  onOpen={() => navigate(`/mobile/raw-material/${material.id}`)}
                  onAddToFormula={() => navigate(`/mobile/formulas/new?materialIds=${material.id}`)}
                  onAddToShortlist={() => handleAddToShortlist(material)}
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
        description="Compact mobile material entry."
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
    </MobileAuthenticatedLayout>
  );
};

export default MobileRawMaterialsPage;
