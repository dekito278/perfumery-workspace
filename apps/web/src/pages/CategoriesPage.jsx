
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
      toast.error('Failed to load categories');
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
        <title>Categories - Perfumer Studio</title>
        <meta name="description" content="Reference the Perfumer's Workbook A-Z material classification system." />
      </Helmet>
      <div className="page-container">
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="gap-2 h-9"
          >
            <Home className="w-4 h-4" />
            Back to dashboard
          </Button>
        </div>

        <PageHeader
          title="Categories"
          description="Perfumer's Workbook A-Z classification used across raw materials and formula imports"
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No categories yet"
            description="The standard Perfumer's Workbook categories will appear here once loaded."
          />
        ) : (
          <>
            <div className="mb-5 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
              This workspace now uses the standard A-Z Perfumer&apos;s Workbook classification. These categories are seeded automatically and should be treated as the shared reference system.
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
                    {category.standardDefinition?.description || 'Legacy category'}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reference: {category.standardDefinition?.reference || category.color}
                  </p>
                </div>
              </div>
            ))}
            </div>
            {enrichedCategories.length < PERFUMERS_WORLD_CATEGORIES.length && (
              <p className="mt-4 text-xs text-muted-foreground">
                Some standard categories are still being synchronized. Refresh the page if needed.
              </p>
            )}
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default CategoriesPage;
