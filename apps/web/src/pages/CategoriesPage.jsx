
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, Tag } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import { getRawMaterialCategories } from '@/services/rawMaterialCategoriesService.js';
import { PERFUMERS_WORLD_CATEGORIES, findPerfumersWorldCategoryByValue } from '@/utils/perfumersWorldCategories.js';

const CategoriesPage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await getRawMaterialCategories();
      setCategories(data);
    } catch (error) {
      toast.error('Gagal memuat kategori');
    } finally {
      setLoading(false);
    }
  };

  const enrichedCategories = categories.map((category) => ({
    ...category,
    standardDefinition: findPerfumersWorldCategoryByValue(category.name),
  }));

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Kategori - Solivagant</title>
        <meta name="description" content="Acuan sistem klasifikasi bahan A-Z dari Perfumer's Workbook." />
      </Helmet>
      <div className="page-container">
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/studio')}
            className="gap-2 h-9"
          >
            <Home className="w-4 h-4" />
            Kembali ke dashboard
          </Button>
        </div>

        <PageHeader
          title="Kategori"
          description="Klasifikasi A-Z Perfumer's Workbook yang dipakai di bahan baku dan impor formula"
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="Belum ada kategori"
            description="Kategori standar Perfumer's Workbook akan muncul di sini setelah dimuat."
          />
        ) : (
          <>
            <div className="mb-5 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
              Ruang kerja ini memakai klasifikasi standar A-Z Perfumer&apos;s Workbook. Kategori ini diisi otomatis dan menjadi sistem acuan bersama.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {enrichedCategories.map((category) => (
              <div
                key={category.id}
                className="p-4 border rounded-lg bg-card flex items-start gap-3"
              >
                <div
                  className="w-10 h-10 rounded border-2 border-border shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">{category.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {category.standardDefinition?.description || 'Kategori lama'}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Acuan: {category.standardDefinition?.reference || category.color}
                  </p>
                </div>
              </div>
            ))}
            </div>
            {enrichedCategories.length < PERFUMERS_WORLD_CATEGORIES.length && (
              <p className="mt-4 text-xs text-muted-foreground">
                Sebagian kategori standar masih disinkronkan. Muat ulang halaman bila perlu.
              </p>
            )}
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default CategoriesPage;

