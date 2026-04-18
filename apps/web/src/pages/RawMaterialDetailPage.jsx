
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import DetailPageLayout from '@/components/DetailPageLayout.jsx';
import DetailPageHeader from '@/components/DetailPageHeader.jsx';
import DetailSection from '@/components/DetailSection.jsx';
import DetailField from '@/components/DetailField.jsx';
import DetailFieldGroup from '@/components/DetailFieldGroup.jsx';
import DetailMetadata from '@/components/DetailMetadata.jsx';
import EditRawMaterialModal from '@/components/EditRawMaterialModal.jsx';
import ConfirmDialog from '@/components/ConfirmDialog.jsx';
import UsageHistoryTable from '@/components/UsageHistoryTable.jsx';
import { formatQuantity, formatPercentage, formatNullable, formatStatus } from '@/utils/formatting.js';
import { formatPricePerUnit, formatPrice } from '@/utils/pricingUtils.js';
import pb from '@/lib/pocketbaseClient';

const RawMaterialDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { deleteMaterial } = useRawMaterials();
  const [material, setMaterial] = useState(null);
  const [usageRecords, setUsageRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadMaterial();
    loadUsageHistory();
  }, [id]);

  const loadMaterial = async () => {
    setLoading(true);
    try {
      const data = await pb.collection('raw_materials').getOne(id, { $autoCancel: false });
      setMaterial(data);
    } catch (error) {
      toast.error('Failed to load material details');
      navigate('/raw-materials');
    } finally {
      setLoading(false);
    }
  };

  const loadUsageHistory = async () => {
    setUsageLoading(true);
    try {
      const records = await pb.collection('batch_usage_records').getList(1, 50, {
        filter: `raw_material_id = "${id}"`,
        sort: '-created_at',
        expand: 'batch_id,raw_material_id',
        $autoCancel: false
      });
      setUsageRecords(records.items);
    } catch (error) {
      console.error('Failed to load usage history:', error);
      toast.error('Failed to load usage history');
    } finally {
      setUsageLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMaterial(id);
      toast.success('Material deleted successfully');
      navigate('/raw-materials');
    } catch (error) {
      toast.error('Failed to delete material');
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

  if (!material) {
    return null;
  }

  const isLowStock = material.low_stock_threshold 
    ? material.stock_quantity < material.low_stock_threshold
    : material.stock_quantity < material.minimum_stock;

  const stockStatus = isLowStock ? 'Low stock' : 'In stock';

  // Calculate total quantity used
  const totalQuantityUsed = usageRecords.reduce((sum, record) => {
    return sum + (record.quantity_deducted || 0);
  }, 0);

  return (
    <>
      <Helmet>
        <title>{`${material.name} - Material Details`}</title>
        <meta name="description" content={`Detailed view of ${material.name} raw material with stock and properties.`} />
      </Helmet>
      
      <DetailPageLayout>
        <DetailPageHeader
          title={material.name}
          subtitle={formatNullable(material.description, '')}
          badge={
            <Badge variant="outline" className="capitalize text-xs">
              {formatStatus(material.type)}
            </Badge>
          }
          onBack={() => navigate('/raw-materials')}
          backLabel="Back to materials"
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
            <DetailFieldGroup columns={4}>
              <DetailField label="Name" value={material.name} />
              <DetailField label="Type" value={formatStatus(material.type)} />
              <DetailField label="Category" value={formatStatus(material.category)} />
              <DetailField 
                label="Unit price" 
                value={formatPricePerUnit(material.cost_per_unit)} 
              />
            </DetailFieldGroup>
          </DetailSection>

          <DetailSection title="Stock information">
            {isLowStock && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-destructive text-sm">Low stock alert</div>
                  <div className="text-xs text-muted-foreground">
                    Current stock is below the threshold. Consider reordering.
                  </div>
                </div>
              </div>
            )}
            <DetailFieldGroup columns={4}>
              <DetailField 
                label="Current stock" 
                value={`${formatQuantity(material.stock_quantity)} ${material.unit}`} 
              />
              <DetailField 
                label="Minimum stock" 
                value={`${formatQuantity(material.minimum_stock)} ${material.unit}`} 
              />
              <DetailField 
                label="Low stock threshold" 
                value={material.low_stock_threshold ? `${formatQuantity(material.low_stock_threshold)} ${material.unit}` : 'N/A'} 
              />
              <DetailField 
                label="Stock status" 
                value={
                  <Badge variant={isLowStock ? 'destructive' : 'default'} className="text-xs">
                    {stockStatus}
                  </Badge>
                } 
              />
            </DetailFieldGroup>
            <div className="mt-3">
              <DetailField 
                label="Supplier" 
                value={formatNullable(material.supplier_name)} 
              />
            </div>
          </DetailSection>

          <DetailSection title="Properties">
            <DetailFieldGroup columns={3}>
              <DetailField 
                label="Scent family" 
                value={formatNullable(material.scent_family)} 
              />
              <DetailField 
                label="Note type" 
                value={formatNullable(material.note_type)} 
              />
              <DetailField 
                label="Default dilution" 
                value={material.default_dilution_percent ? formatPercentage(material.default_dilution_percent) : 'N/A'} 
              />
            </DetailFieldGroup>
          </DetailSection>

          {material.notes && (
            <DetailSection title="Notes">
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{material.notes}</p>
            </DetailSection>
          )}

          <DetailSection title="Usage history">
            {usageRecords.length > 0 && (
              <div className="mb-4 p-3 bg-muted/30 rounded-lg border">
                <div className="text-sm">
                  <span className="text-muted-foreground">Total quantity used across all batches:</span>
                  <span className="ml-2 font-mono font-semibold">
                    {formatQuantity(totalQuantityUsed)} {material.unit}
                  </span>
                  <span className="ml-3 text-muted-foreground">
                    (Total cost: {formatPrice(usageRecords.reduce((sum, r) => sum + (r.cost || 0), 0))})
                  </span>
                </div>
              </div>
            )}
            <UsageHistoryTable usageRecords={usageRecords} isLoading={usageLoading} />
          </DetailSection>

          <DetailSection>
            <DetailMetadata 
              created={material.created} 
              updated={material.updated} 
            />
          </DetailSection>
        </div>
      </DetailPageLayout>

      <EditRawMaterialModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        material={material}
        onSuccess={loadMaterial}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete material"
        description={`Are you sure you want to delete "${material.name}"? This action cannot be undone.`}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
      />
    </>
  );
};

export default RawMaterialDetailPage;
