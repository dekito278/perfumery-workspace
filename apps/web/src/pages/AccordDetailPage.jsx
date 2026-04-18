
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAccords } from '@/hooks/useAccords.js';
import DetailPageLayout from '@/components/DetailPageLayout.jsx';
import DetailPageHeader from '@/components/DetailPageHeader.jsx';
import DetailSection from '@/components/DetailSection.jsx';
import DetailField from '@/components/DetailField.jsx';
import DetailFieldGroup from '@/components/DetailFieldGroup.jsx';
import DetailMetadata from '@/components/DetailMetadata.jsx';
import EditAccordModal from '@/components/EditAccordModal.jsx';
import ConfirmDialog from '@/components/ConfirmDialog.jsx';
import { calculateAccordPercentages } from '@/utils/calculateAccordPercentages.js';
import { formatQuantity, formatNullable, formatStatus, formatGramAmount, formatPercentage } from '@/utils/formatting.js';
import { formatPrice, formatPricePerUnit, calculateIngredientCost, calculateTotalCost } from '@/utils/pricingUtils.js';
import { getAccordById, getAccordItems } from '@/services/accordsSupabaseService.js';
import { getRawMaterials } from '@/services/rawMaterialsService.js';

const AccordDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { deleteAccord } = useAccords();
  const [accord, setAccord] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAccord();
  }, [id]);

  const loadAccord = async () => {
    setLoading(true);
    try {
      const accordData = await getAccordById(id);
      setAccord(accordData);

      const [itemsData, rawMaterials] = await Promise.all([
        getAccordItems(id),
        getRawMaterials(),
      ]);
      const rawMaterialsMap = new Map(rawMaterials.map((material) => [material.id, material]));

      const itemsWithGrams = itemsData.map(item => ({
        ...item,
        gram_amount: item.percentage
      }));

      const itemsWithCalculatedPercentages = calculateAccordPercentages(itemsWithGrams);

      const enrichedItems = itemsWithCalculatedPercentages.map((item) => {
        const material = rawMaterialsMap.get(item.raw_material_id);
        if (!material) {
          return {
            ...item,
            material_name: 'Unknown material',
            material_type: null,
            material_unit: null,
            material_stock: 0,
            is_low_stock: false,
            unit_price: 0,
          };
        }

        const isLowStock = material.low_stock_threshold 
          ? material.stock_quantity < material.low_stock_threshold
          : material.stock_quantity < material.minimum_stock;

        return {
          ...item,
          material_name: material.name,
          material_type: material.type,
          material_unit: material.unit,
          material_stock: material.stock_quantity,
          is_low_stock: isLowStock,
          unit_price: material.cost_per_unit || 0
        };
      });

      setItems(enrichedItems);
    } catch (error) {
      toast.error('Failed to load accord details');
      navigate('/accords');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccord(id);
      toast.success('Accord deleted successfully');
      navigate('/accords');
    } catch (error) {
      toast.error('Failed to delete accord');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <DetailPageLayout>
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-64 w-full" />
      </DetailPageLayout>
    );
  }

  if (!accord) {
    return null;
  }

  const totalGrams = items.reduce((sum, item) => sum + parseFloat(item.gram_amount || 0), 0);
  const totalPercentage = items.reduce((sum, item) => sum + item.percentage, 0);
  const totalCost = calculateTotalCost(items);

  return (
    <>
      <Helmet>
        <title>{`${accord.name} - Accord Details`}</title>
        <meta name="description" content={`Detailed view of ${accord.name} accord with composition and cost breakdown.`} />
      </Helmet>
      
      <DetailPageLayout>
        <DetailPageHeader
          title={accord.name}
          subtitle={formatNullable(accord.description, '')}
          onBack={() => navigate('/accords')}
          backLabel="Back to accords"
          actions={
            <>
              <Button variant="outline" onClick={() => setEditModalOpen(true)} className="gap-2 h-9">
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="gap-2 h-9">
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </>
          }
        />

        <div className="space-y-5">
          <DetailSection title="Summary">
            <DetailFieldGroup columns={3}>
              <DetailField label="Name" value={accord.name} />
              <DetailField 
                label="Stock quantity" 
                value={`${formatQuantity(accord.stock_quantity)} ${accord.unit || 'ml'}`} 
              />
              <DetailField 
                label="Unit price" 
                value={formatPricePerUnit(accord.cost_per_unit || 0)} 
              />
            </DetailFieldGroup>
          </DetailSection>

          <DetailSection title="Composition">
            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Material name</TableHead>
                    <TableHead className="min-w-[100px]">Type</TableHead>
                    <TableHead className="text-right min-w-[100px]">Amount</TableHead>
                    <TableHead className="text-right min-w-[100px]">Percentage</TableHead>
                    <TableHead className="text-right min-w-[140px]">Unit price</TableHead>
                    <TableHead className="text-right min-w-[100px]">Cost</TableHead>
                    <TableHead className="text-right min-w-[100px]">Stock status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const ingredientCost = calculateIngredientCost(item.gram_amount, item.unit_price);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <button
                            onClick={() => navigate(`/raw-material/${item.raw_material_id}`)}
                            className="font-medium text-primary hover:underline text-sm"
                          >
                            {item.material_name}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {formatStatus(item.material_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatGramAmount(item.gram_amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatPercentage(item.percentage)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatPricePerUnit(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatPrice(ingredientCost)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={item.is_low_stock ? 'destructive' : 'default'} className="text-xs">
                            {item.is_low_stock ? 'Low stock' : 'In stock'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell colSpan={2} className="text-sm">Total</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatGramAmount(totalGrams)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatPercentage(totalPercentage)}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-mono text-sm text-primary">
                      {formatPrice(totalCost)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Total accord cost:</span>
                <span className="text-lg font-bold font-mono text-primary">{formatPrice(totalCost)}</span>
              </div>
            </div>
          </DetailSection>

          {accord.notes && (
            <DetailSection title="Notes">
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{accord.notes}</p>
            </DetailSection>
          )}

          <DetailSection>
            <DetailMetadata 
              created={accord.created} 
              updated={accord.updated} 
            />
          </DetailSection>
        </div>
      </DetailPageLayout>

      <EditAccordModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        accord={accord}
        onSuccess={loadAccord}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete accord"
        description={`Are you sure you want to delete "${accord.name}"? This will also delete all accord items. This action cannot be undone.`}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
      />
    </>
  );
};

export default AccordDetailPage;
