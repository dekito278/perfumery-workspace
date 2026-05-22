import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Tag } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import { getRawMaterialCategories } from '@/services/rawMaterialCategoriesService.js';
import { findPerfumersWorldCategoryByValue, PERFUMERS_WORLD_CATEGORIES } from '@/utils/perfumersWorldCategories.js';
import { runWithTimeout } from '@/utils/asyncTimeout.js';

const fallbackCategories = PERFUMERS_WORLD_CATEGORIES.map((category) => ({
  id: `standard-${category.code}`,
  name: category.label,
  color: category.color,
}));

const MobileCategoriesPage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadCategories = async () => {
      setLoading(true);
      try {
        const rows = await runWithTimeout(getRawMaterialCategories(), fallbackCategories, 8000);
        if (active) setCategories(rows?.length ? rows : fallbackCategories);
      } catch (error) {
        toast.error('Gagal memuat kategori');
        if (active) setCategories(fallbackCategories);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadCategories();
    return () => { active = false; };
  }, []);

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>Kategori Mobile - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title="Kategori" onBack={() => navigate('/mobile/raw-materials')} action={<Tag className="h-6 w-6 text-amber-600" />} />
        {loading ? <MobileLoadingState eyebrow="Material" title="Memuat kategori..." subtitle="Menyiapkan data klasifikasi." className="min-h-[calc(100dvh-260px)]" /> : categories.length === 0 ? (
          <MobileEmptyState icon={Tag} title="Belum ada kategori" description="Kategori akan muncul setelah library material tersedia." />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {categories.map((category) => {
              const definition = findPerfumersWorldCategoryByValue(category.name);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => navigate(`/mobile/raw-materials?category=${encodeURIComponent(category.name)}`)}
                  className="mobile-card min-h-[128px] p-3 text-left"
                >
                  <span className="block h-8 w-8 rounded-xl border border-[#e5e7eb]" style={{ backgroundColor: category.color }} />
                  <span className="mt-2 block text-[10px] font-bold uppercase text-amber-700">{definition?.reference || category.name.slice(0, 1)}</span>
                  <span className="mt-1 block text-sm font-bold text-[#1f2937]">{category.name}</span>
                  {definition?.description ? <span className="mobile-line-clamp-2 mt-1.5 block text-xs text-[#6b7280]">{definition.description}</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileCategoriesPage;

