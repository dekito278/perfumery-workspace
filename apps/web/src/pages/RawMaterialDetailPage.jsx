
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Trash2, AlertTriangle, Link as LinkIcon } from 'lucide-react';
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
import ManualReferenceMatchModal from '@/components/ManualReferenceMatchModal.jsx';
import { formatQuantity, formatPercentage, formatNullable, formatStatus } from '@/utils/formatting.js';
import { calculateIngredientCost, formatPricePerUnit, formatPrice } from '@/utils/pricingUtils.js';
import { getRawMaterialById, getRawMaterialUsageHistory } from '@/services/rawMaterialsService.js';
import { getReferenceProfileByRawMaterialId } from '@/services/materialReferenceService.js';
import { deriveScentFamilyFromCategory } from '@/utils/rawMaterialCategoryMeta.js';

const stripHtml = (value) =>
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toKeywordList = (value) =>
  stripHtml(value)
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 16);

const RawMaterialDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { deleteMaterial } = useRawMaterials();
  const [material, setMaterial] = useState(null);
  const [usageRecords, setUsageRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [referenceLink, setReferenceLink] = useState(null);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadMaterial();
    loadUsageHistory();
    loadReferenceProfile();
  }, [id]);

  const loadMaterial = async () => {
    setLoading(true);
    try {
      const data = await getRawMaterialById(id);
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
      const records = await getRawMaterialUsageHistory(id);
      setUsageRecords(records);
    } catch (error) {
      console.error('Failed to load usage history:', error);
      setUsageRecords([]);
    } finally {
      setUsageLoading(false);
    }
  };

  const loadReferenceProfile = async () => {
    setReferenceLoading(true);
    try {
      const data = await getReferenceProfileByRawMaterialId(id);
      setReferenceLink(data);
    } catch (error) {
      console.error('Failed to load reference profile:', error);
      setReferenceLink(null);
    } finally {
      setReferenceLoading(false);
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
  const scentFamily = material.scent_family || deriveScentFamilyFromCategory(material.category, '');
  const stockThreshold = material.low_stock_threshold || material.minimum_stock || 0;
  const inventoryValue = calculateIngredientCost(material.stock_quantity || 0, material.cost_per_unit || 0);
  const reorderGap = Math.max(stockThreshold - Number(material.stock_quantity || 0), 0);
  const dilutionSolventName = material.expand?.dilution_solvent_id?.name || null;
  const referenceProfile = referenceLink?.reference_profile || null;
  const referenceKeywords = toKeywordList(referenceProfile?.perfume_uses);
  const flavourKeywords = toKeywordList(referenceProfile?.flavour_uses);
  const referenceDescription = stripHtml(referenceProfile?.odour_description || referenceProfile?.brief_description);
  const stabilityNotes = [
    referenceProfile?.stability_heat ? `Heat: ${referenceProfile.stability_heat}` : null,
    referenceProfile?.stability_discolour ? `Discolour: ${referenceProfile.stability_discolour}` : null,
    referenceProfile?.stability_storage ? `Storage: ${referenceProfile.stability_storage}` : null,
    referenceProfile?.stability_antioxidant ? `Antioxidant: ${referenceProfile.stability_antioxidant}` : null,
  ].filter(Boolean);

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
          eyebrow="Raw material"
          title={material.name}
          subtitle={[
            material.vendor ? `Vendor: ${material.vendor}` : null,
            material.category ? formatStatus(material.category) : 'Uncategorized material',
            scentFamily || null,
          ].filter(Boolean).join(' / ')}
          badge={
            <Badge variant="outline" className="capitalize text-xs">
              {formatStatus(material.type)}
            </Badge>
          }
          onBack={() => {
            if (location.state?.from === '/raw-materials') {
              navigate(-1);
              return;
            }
            navigate('/raw-materials');
          }}
          backLabel="Back to materials"
          meta={
            <>
              {referenceProfile ? (
                <div className="detail-page-meta-chip">
                  <span className="detail-page-meta-label">Reference</span>
                  <span className="detail-page-meta-value">{referenceProfile.reference_code}</span>
                </div>
              ) : null}
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Current stock</span>
                <span className="detail-page-meta-value">
                  {formatQuantity(material.stock_quantity)} {material.unit}
                </span>
              </div>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Unit price</span>
                <span className="detail-page-meta-value">{formatPricePerUnit(material.cost_per_unit, material.unit)}</span>
              </div>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Total used</span>
                <span className="detail-page-meta-value">
                  {formatQuantity(totalQuantityUsed)} {material.unit}
                </span>
              </div>
            </>
          }
          actions={
            <>
              <Button variant="outline" onClick={() => setEditModalOpen(true)} className="gap-2 h-9">
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              <Button variant="outline" onClick={() => setMatchModalOpen(true)} className="gap-2 h-9">
                <LinkIcon className="w-4 h-4" />
                {referenceProfile ? 'Update reference' : 'Match reference'}
              </Button>
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="gap-2 h-9">
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </>
          }
        />

        <div className="space-y-5">
          <DetailSection title="Snapshot">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Available stock</div>
                <div className={`text-lg font-semibold font-mono ${isLowStock ? 'text-destructive' : ''}`}>
                  {formatQuantity(material.stock_quantity)} {material.unit}
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Reorder point</div>
                <div className="text-lg font-semibold font-mono">
                  {formatQuantity(stockThreshold)} {material.unit}
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Inventory value</div>
                <div className="text-lg font-semibold font-mono">{formatPrice(inventoryValue)}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Usage recorded</div>
                <div className="text-lg font-semibold font-mono">
                  {formatQuantity(totalQuantityUsed)} {material.unit}
                </div>
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Summary">
            <DetailFieldGroup columns={4}>
              <DetailField label="Name" value={material.name} />
              <DetailField label="Type" value={formatStatus(material.type)} />
              <DetailField label="Category" value={formatStatus(material.category)} />
              <DetailField 
                label="Unit price" 
                value={formatPricePerUnit(material.cost_per_unit, material.unit)} 
              />
            </DetailFieldGroup>
            <div className="mt-3">
              <DetailFieldGroup columns={3}>
                <DetailField label="CAS number" value={formatNullable(material.cas_number)} />
                <DetailField label="IFRA limit" value={material.ifra_limit ? formatPercentage(material.ifra_limit) : 'N/A'} />
                <DetailField label="Inventory value" value={formatPrice(inventoryValue)} />
              </DetailFieldGroup>
            </div>
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
                label="Alert threshold" 
                value={`${formatQuantity(stockThreshold)} ${material.unit}`} 
              />
              <DetailField 
                label="Stock status" 
                value={
                  <Badge variant={isLowStock ? 'destructive' : 'default'} className="text-xs">
                    {stockStatus}
                  </Badge>
                } 
              />
              <DetailField 
                label="Reorder gap" 
                value={isLowStock ? `${formatQuantity(reorderGap)} ${material.unit}` : 'No gap'} 
              />
            </DetailFieldGroup>
            <div className="mt-3 text-sm text-muted-foreground">
              {isLowStock
                ? `Reorder recommendation: add at least ${formatQuantity(reorderGap)} ${material.unit} to get back above the active threshold.`
                : `This material is currently above its reorder threshold by ${formatQuantity(Number(material.stock_quantity || 0) - stockThreshold)} ${material.unit}.`}
            </div>
          </DetailSection>

          <DetailSection title="Classification">
            <DetailFieldGroup columns={3}>
              <DetailField 
                label="Family" 
                value={formatNullable(scentFamily)} 
              />
              <DetailField label="Category system" value="Perfumer's Workbook A-Z" />
              <DetailField label="Type" value={formatStatus(material.type)} />
            </DetailFieldGroup>
          </DetailSection>

          <DetailSection title="Reference profile">
            {referenceLoading ? (
              <div className="grid gap-3 md:grid-cols-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : referenceProfile ? (
              <div className="space-y-5">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setMatchModalOpen(true)} className="gap-2">
                    <LinkIcon className="w-4 h-4" />
                    Change linked profile
                  </Button>
                </div>
                <DetailFieldGroup columns={4}>
                  <DetailField label="Reference code" value={referenceProfile.reference_code} />
                  <DetailField label="ABC code" value={formatNullable(referenceProfile.abc_code)} />
                  <DetailField label="Primary family" value={formatNullable(referenceProfile.abc_primary_family)} />
                  <DetailField label="Secondary family" value={formatNullable(referenceProfile.abc_secondary_family)} />
                </DetailFieldGroup>

                <DetailFieldGroup columns={4}>
                  <DetailField label="Impact" value={referenceProfile.impact !== null ? formatQuantity(referenceProfile.impact) : 'N/A'} />
                  <DetailField label="Life hours" value={referenceProfile.life_hours !== null ? formatQuantity(referenceProfile.life_hours) : 'N/A'} />
                  <DetailField label="Use level max" value={referenceProfile.use_level_max_percent !== null ? formatPercentage(referenceProfile.use_level_max_percent, 2) : 'N/A'} />
                  <DetailField label="IFRA reference limit" value={referenceProfile.ifra_limit_percent !== null ? formatPercentage(referenceProfile.ifra_limit_percent, 2) : 'N/A'} />
                </DetailFieldGroup>

                {referenceDescription ? (
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-xs text-muted-foreground mb-2">Odour description</div>
                    <p className="text-sm leading-6 text-foreground">{referenceDescription}</p>
                  </div>
                ) : null}

                {referenceProfile.odour_facets?.length ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Odour profile</div>
                    <div className="flex flex-wrap gap-2">
                      {referenceProfile.odour_facets.map((facet) => (
                        <Badge key={facet.id} variant="outline" className="rounded-full px-3 py-1 text-xs">
                          {facet.letter} / {facet.family || 'Family'} / {formatQuantity(facet.value)}%
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {(referenceKeywords.length || flavourKeywords.length) ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border bg-card p-4">
                      <div className="text-xs text-muted-foreground mb-2">Perfume uses</div>
                      <div className="flex flex-wrap gap-2">
                        {referenceKeywords.length ? referenceKeywords.map((keyword) => (
                          <Badge key={keyword} variant="secondary" className="rounded-full text-xs">
                            {keyword}
                          </Badge>
                        )) : <span className="text-sm text-muted-foreground">No perfume use notes</span>}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                      <div className="text-xs text-muted-foreground mb-2">Flavour uses</div>
                      <div className="flex flex-wrap gap-2">
                        {flavourKeywords.length ? flavourKeywords.map((keyword) => (
                          <Badge key={keyword} variant="secondary" className="rounded-full text-xs">
                            {keyword}
                          </Badge>
                        )) : <span className="text-sm text-muted-foreground">No flavour use notes</span>}
                      </div>
                    </div>
                  </div>
                ) : null}

                <DetailFieldGroup columns={4}>
                  <DetailField label="Supplier" value={formatNullable(referenceProfile.supplier)} />
                  <DetailField label="Catalog unit" value={formatNullable(referenceProfile.catalog_unit)} />
                  <DetailField label="Catalog price" value={referenceProfile.catalog_price !== null ? formatPrice(referenceProfile.catalog_price) : 'N/A'} />
                  <DetailField label="Function labels" value={formatNullable(referenceProfile.function_labels)} />
                </DetailFieldGroup>

                <DetailFieldGroup columns={4}>
                  <DetailField label="Physical state" value={formatNullable(referenceProfile.physical_state)} />
                  <DetailField label="Molecular formula" value={formatNullable(referenceProfile.mol_formula)} />
                  <DetailField label="Molecular weight" value={referenceProfile.molecular_weight !== null ? formatQuantity(referenceProfile.molecular_weight, 2) : 'N/A'} />
                  <DetailField label="Safety note" value={formatNullable(referenceProfile.safety)} />
                </DetailFieldGroup>

                {stabilityNotes.length || referenceProfile.stability_summary ? (
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-xs text-muted-foreground mb-2">Stability</div>
                    {referenceProfile.stability_summary ? (
                      <p className="text-sm text-foreground mb-3">{referenceProfile.stability_summary}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {stabilityNotes.map((note) => (
                        <Badge key={note} variant="outline" className="rounded-full text-xs">
                          {note}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="text-sm text-muted-foreground">
                  Linked by {referenceLink.match_method || 'manual'}
                  {referenceLink.match_confidence !== null ? ` with ${(referenceLink.match_confidence * 100).toFixed(0)}% confidence` : ''}.
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                <p>
                  This material does not have a workbook reference profile yet. The inventory workflow still works normally, and we can attach a reference profile later during the matching or import phase.
                </p>
                <Button variant="outline" size="sm" onClick={() => setMatchModalOpen(true)} className="mt-4 gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Match reference profile
                </Button>
              </div>
            )}
          </DetailSection>

          {material.is_diluted && (
            <DetailSection title="Dilution setup">
              <DetailFieldGroup columns={3}>
                <DetailField
                  label="Diluted material"
                  value={
                    <Badge variant="outline" className="text-xs">
                      Yes
                    </Badge>
                  }
                />
                <DetailField
                  label="Dilution percentage"
                  value={formatPercentage(material.dilution_percentage || 0)}
                />
                <DetailField
                  label="Dilution solvent"
                  value={formatNullable(dilutionSolventName)}
                />
              </DetailFieldGroup>
              <div className="mt-3 text-sm text-muted-foreground">
                This inventory item is treated as a pre-diluted material and will expand into active material plus solvent usage when formulas or batches consume it.
              </div>
            </DetailSection>
          )}

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
        onSuccess={() => {
          loadMaterial();
          loadUsageHistory();
          loadReferenceProfile();
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete material"
        description={`Are you sure you want to delete "${material.name}"? This action cannot be undone.`}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
      />

      <ManualReferenceMatchModal
        open={matchModalOpen}
        onOpenChange={setMatchModalOpen}
        material={material}
        currentLink={referenceLink}
        onSuccess={async () => {
          await loadReferenceProfile();
          toast.success('Reference profile updated');
        }}
      />
    </>
  );
};

export default RawMaterialDetailPage;

