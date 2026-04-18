
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Home, Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import CategoryForm from '@/components/CategoryForm.jsx';
import ConfirmDialog from '@/components/ConfirmDialog.jsx';
import pb from '@/lib/pocketbaseClient';

const CategoriesPage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await pb.collection('raw_material_categories').getFullList({
        sort: 'name',
        $autoCancel: false
      });
      setCategories(data);
    } catch (error) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (data) => {
    setSaving(true);
    try {
      await pb.collection('raw_material_categories').create(data, { $autoCancel: false });
      toast.success('Category created successfully');
      setAddModalOpen(false);
      loadCategories();
    } catch (error) {
      toast.error('Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (data) => {
    setSaving(true);
    try {
      await pb.collection('raw_material_categories').update(selectedCategory.id, data, { $autoCancel: false });
      toast.success('Category updated successfully');
      setEditModalOpen(false);
      setSelectedCategory(null);
      loadCategories();
    } catch (error) {
      toast.error('Failed to update category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await pb.collection('raw_material_categories').delete(selectedCategory.id, { $autoCancel: false });
      toast.success('Category deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedCategory(null);
      loadCategories();
    } catch (error) {
      toast.error('Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Categories - Perfumer Studio</title>
        <meta name="description" content="Manage raw material categories with custom colors." />
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
          description="Manage raw material categories with custom colors"
          action="Add category"
          actionIcon={Plus}
          onAction={() => setAddModalOpen(true)}
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No categories yet"
            description="Create your first category to organize raw materials."
            action="Add category"
            actionIcon={Plus}
            onAction={() => setAddModalOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="p-3 border rounded-lg bg-card flex items-center gap-3 hover:shadow-md transition-shadow"
              >
                <div
                  className="w-10 h-10 rounded border-2 border-border shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{category.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{category.color}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedCategory(category);
                      setEditModalOpen(true);
                    }}
                    className="h-7 w-7 p-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedCategory(category);
                      setDeleteDialogOpen(true);
                    }}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-lg">Add category</DialogTitle>
            <DialogDescription className="text-xs">Create a new raw material category.</DialogDescription>
          </DialogHeader>
          <CategoryForm
            onSave={handleAdd}
            onCancel={() => setAddModalOpen(false)}
            loading={saving}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-lg">Edit category</DialogTitle>
            <DialogDescription className="text-xs">Update category details.</DialogDescription>
          </DialogHeader>
          <CategoryForm
            category={selectedCategory}
            onSave={handleEdit}
            onCancel={() => {
              setEditModalOpen(false);
              setSelectedCategory(null);
            }}
            loading={saving}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete category"
        description={`Are you sure you want to delete "${selectedCategory?.name}"? This action cannot be undone.`}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
      />
    </AuthenticatedLayout>
  );
};

export default CategoriesPage;
