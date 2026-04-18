
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Eye, Pencil, Trash2, Beaker } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAccords } from '@/hooks/useAccords.js';
import PageHeader from '@/components/PageHeader.jsx';
import AddAccordModal from '@/components/AddAccordModal.jsx';
import EditAccordModal from '@/components/EditAccordModal.jsx';
import ProduceAccordModal from '@/components/ProduceAccordModal.jsx';
import DeleteConfirmationDialog from '@/components/DeleteConfirmationDialog.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import NoResultsState from '@/components/NoResultsState.jsx';
import { formatQuantity, formatCurrency } from '@/utils/formatting.js';

const AccordsPage = () => {
  const navigate = useNavigate();
  const { fetchAccords, deleteAccord } = useAccords();
  const [accords, setAccords] = useState([]);
  const [filteredAccords, setFilteredAccords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [produceModalOpen, setProduceModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAccord, setSelectedAccord] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAccords();
  }, []);

  useEffect(() => {
    filterAccords();
  }, [searchQuery, accords]);

  const loadAccords = async () => {
    console.log('=== LOADING ACCORDS ===');
    setLoading(true);
    try {
      const data = await fetchAccords();
      console.log('Accords loaded:', data.length);
      console.log('Accord list refreshed, total accords:', data.length);
      setAccords(data);
    } catch (error) {
      console.error('Failed to load accords:', error);
      toast.error('Failed to load accords');
    } finally {
      setLoading(false);
    }
  };

  const filterAccords = () => {
    if (!searchQuery.trim()) {
      setFilteredAccords(accords);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = accords.filter(accord => 
      accord.name.toLowerCase().includes(query) ||
      (accord.notes && accord.notes.toLowerCase().includes(query))
    );
    setFilteredAccords(filtered);
  };

  const handleAddSuccess = () => {
    console.log('=== ACCORD CREATED - REFRESHING LIST ===');
    loadAccords();
  };

  const handleEditSuccess = () => {
    loadAccords();
  };

  const handleProduceSuccess = () => {
    loadAccords();
  };

  const handleEdit = (accord) => {
    setSelectedAccord(accord);
    setEditModalOpen(true);
  };

  const handleProduce = (accord) => {
    setSelectedAccord(accord);
    setProduceModalOpen(true);
  };

  const handleDeleteClick = (accord) => {
    setSelectedAccord(accord);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAccord) return;

    setDeleting(true);
    try {
      await deleteAccord(selectedAccord.id);
      toast.success('Accord deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedAccord(null);
      loadAccords();
    } catch (error) {
      toast.error('Failed to delete accord');
    } finally {
      setDeleting(false);
    }
  };

  const handleView = (accordId) => {
    navigate(`/accords/${accordId}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Accords - Perfume Lab Manager</title>
        <meta name="description" content="Manage your custom perfume accords and blends." />
      </Helmet>

      <div className="space-y-6">
        <PageHeader
          title="Accords"
          description="Manage your custom accords and blends"
          action={
            <Button onClick={() => setAddModalOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create accord
            </Button>
          }
        />

        {accords.length === 0 ? (
          <EmptyState
            icon={Beaker}
            title="No accords yet"
            description="Create your first custom accord to start building complex fragrance blends."
            action={
              <Button onClick={() => setAddModalOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Create first accord
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search accords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {filteredAccords.length === 0 ? (
              <NoResultsState
                searchQuery={searchQuery}
                onClear={() => setSearchQuery('')}
              />
            ) : (
              <div className="rounded-lg border bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Name</TableHead>
                      <TableHead className="min-w-[120px]">Stock</TableHead>
                      <TableHead className="min-w-[100px]">Unit</TableHead>
                      <TableHead className="min-w-[120px]">Cost/unit</TableHead>
                      <TableHead className="min-w-[200px]">Notes</TableHead>
                      <TableHead className="text-right min-w-[180px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccords.map((accord) => (
                      <TableRow key={accord.id}>
                        <TableCell className="font-medium">{accord.name}</TableCell>
                        <TableCell className="font-mono">
                          {formatQuantity(accord.stock_quantity)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {accord.unit || 'ml'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {accord.cost_per_unit ? formatCurrency(accord.cost_per_unit) : 'N/A'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                          {accord.notes || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(accord.id)}
                              className="gap-2 h-8"
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleProduce(accord)}
                              className="gap-2 h-8"
                            >
                              <Beaker className="w-3 h-3" />
                              Produce
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(accord)}
                              className="gap-2 h-8"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(accord)}
                              className="gap-2 h-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>

      <AddAccordModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={handleAddSuccess}
      />

      {selectedAccord && (
        <>
          <EditAccordModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            accord={selectedAccord}
            onSuccess={handleEditSuccess}
          />

          <ProduceAccordModal
            open={produceModalOpen}
            onOpenChange={setProduceModalOpen}
            accord={selectedAccord}
            onSuccess={handleProduceSuccess}
          />

          <DeleteConfirmationDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onConfirm={handleDeleteConfirm}
            title="Delete accord"
            description={`Are you sure you want to delete "${selectedAccord.name}"? This action cannot be undone.`}
            confirmText={deleting ? 'Deleting...' : 'Delete'}
          />
        </>
      )}
    </>
  );
};

export default AccordsPage;
