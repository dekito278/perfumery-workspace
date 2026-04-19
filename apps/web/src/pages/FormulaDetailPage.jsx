
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import DetailPageLayout from '@/components/DetailPageLayout.jsx';
import DetailPageHeader from '@/components/DetailPageHeader.jsx';
import DetailSection from '@/components/DetailSection.jsx';
import DetailField from '@/components/DetailField.jsx';
import DetailFieldGroup from '@/components/DetailFieldGroup.jsx';
import DetailMetadata from '@/components/DetailMetadata.jsx';
import CreateBatchModal from '@/components/CreateBatchModal.jsx';
import EditFormulaModal from '@/components/EditFormulaModal.jsx';
import DeleteFormulaModal from '@/components/DeleteFormulaModal.jsx';
import BatchStatusBadge from '@/components/BatchStatusBadge.jsx';
import PyramidSummary from '@/components/PyramidSummary.jsx';
import ExportFormulaButton from '@/components/ExportFormulaButton.jsx';
import { calculatePercentages } from '@/utils/formulaCalculations.js';
import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { formatGramAmount, formatPercentage, formatNullable, formatStatus, formatDate, formatQuantity } from '@/utils/formatting.js';
import { formatPrice, formatPricePerUnit, calculateIngredientCost, calculateTotalCost } from '@/utils/pricingUtils.js';
import { calculateDilutionComposition } from '@/utils/calculateDilutionCost.js';
import { deriveScentFamilyFromCategory } from '@/utils/rawMaterialCategoryMeta.js';
import { buildFormulaItemReferenceMaps, resolveFormulaItemReference } from '@/utils/legacyFormulaItemSources.js';
import { getFormulaById } from '@/services/formulasSupabaseService.js';
import { getBatches } from '@/services/batchesSupabaseService.js';
import { getRawMaterialById, getRawMaterials } from '@/services/rawMaterialsService.js';

const FormulaDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getFormulaItems } = useFormulaItems();
  const [formula, setFormula] = useState(null);
  const [items, setItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createBatchModalOpen, setCreateBatchModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    loadFormulaDetails();
  }, [id]);

  const loadFormulaDetails = async () => {
    setLoading(true);
    try {
      const formulaData = await getFormulaById(id);
      setFormula(formulaData);

      const itemsData = await getFormulaItems(id);
      const rawMaterials = await getRawMaterials();
      const referenceMaps = await buildFormulaItemReferenceMaps(itemsData, rawMaterials);

      const enrichedItems = await Promise.all(itemsData.map(async (item) => {
        let itemDetails = resolveFormulaItemReference(item, referenceMaps);
        let isLowStock = false;
        let unitPrice = 0;
        let category = null;
        let componentFamily = null;
        let isDiluted = Boolean(item.dilution_percent && item.dilution_solvent_id);
        let dilutionPercentage = item.dilution_percent || null;
        let dilutionSolventName = null;

        if (item.item_type === 'raw_material' || item.item_type === 'solvent') {
          itemDetails = itemDetails || await getRawMaterialById(item.item_id);
          isLowStock = itemDetails.low_stock_threshold 
            ? itemDetails.stock_quantity < itemDetails.low_stock_threshold
            : itemDetails.stock_quantity < itemDetails.minimum_stock;
          unitPrice = itemDetails.cost_per_unit || 0;
          category = itemDetails.category || null;
          componentFamily = itemDetails.scent_family || deriveScentFamilyFromCategory(itemDetails.category, '') || null;
          if (!isDiluted) {
            isDiluted = itemDetails.is_diluted || false;
            dilutionPercentage = itemDetails.dilution_percentage || null;
          }
          if (item.dilution_solvent_id) {
            const dilutionSolvent = referenceMaps.rawMaterialsMap.get(item.dilution_solvent_id) || await getRawMaterialById(item.dilution_solvent_id);
            dilutionSolventName = dilutionSolvent?.name || null;
          }
        } else if (item.item_type === 'accord') {
          unitPrice = itemDetails?.cost_per_unit || 0;
          category = itemDetails?.category || 'accord';
          componentFamily = 'accord';
        }

        const gramAmount = item.grams || item.percentage || 0;

        return {
          ...item,
          name: itemDetails?.name || 'Unknown',
          unit: itemDetails?.unit || 'g',
          is_low_stock: isLowStock,
          gram_amount: gramAmount,
          unit_price: unitPrice,
          ingredient_cost: calculateIngredientCost(gramAmount, unitPrice),
          category,
          component_family: componentFamily,
          scent_family: componentFamily,
          is_diluted: isDiluted,
          dilution_percentage: dilutionPercentage,
          dilution_solvent_name: dilutionSolventName
        };
      }));

      const totalGrams = calculateTotalAmount(enrichedItems);
      const itemsWithPercentages = totalGrams > 0 ? calculatePercentages(enrichedItems, totalGrams) : enrichedItems;
      setItems(itemsWithPercentages);

      const batchesData = await getBatches();
      setBatches(batchesData.filter((batch) => batch.formula_id === id).slice(0, 5));
    } catch (error) {
      toast.error('Failed to load formula details');
      navigate('/formulas');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    const { printWorkbookPdf } = await import('@/utils/workbookPdfExport.js');
    printWorkbookPdf({
      typeLabel: 'Formula Sheet',
      title: formula.name,
      subtitle: `Code ${formula.code}`,
      summaryEntries: [
        { label: 'Code', value: formula.code },
        { label: 'By', value: formatNullable(formula.author_name) },
        { label: 'Status', value: formatStatus(formula.status || 'draft') },
        { label: 'Version', value: formatNullable(formula.version) },
        { label: 'Total amount', value: formatGramAmount(totalGrams) },
        { label: 'Material cost', value: formatPrice(totalCost) },
        { label: 'Created', value: formatDate(formula.created) },
        { label: 'Category', value: formatNullable(formula.category) },
      ],
      tableTitle: 'Composition',
      columns: [
        { key: 'material', label: 'Material', width: 54 },
        { key: 'type', label: 'Type', width: 22 },
        { key: 'amount', label: 'Amount', width: 24, align: 'right' },
        { key: 'percentage', label: '%', width: 18, align: 'right' },
        { key: 'dilution', label: 'Dilution', width: 34 },
        { key: 'unitPrice', label: 'Unit price', width: 26, align: 'right' },
        { key: 'cost', label: 'Cost', width: 18, align: 'right' },
      ],
      rows: items.map((item) => ({
        material: item.name,
        type: formatStatus(item.item_type),
        amount: formatGramAmount(item.gram_amount),
        percentage: formatPercentage(item.percentage),
        dilution: item.dilution_percentage ? `${item.dilution_percentage}%${item.dilution_solvent_name ? ` in ${item.dilution_solvent_name}` : ''}` : '-',
        unitPrice: formatPricePerUnit(item.unit_price, item.unit),
        cost: formatPrice(item.ingredient_cost ?? calculateIngredientCost(item.gram_amount, item.unit_price)),
      })),
      footerRows: [
        {
          material: 'TOTAL',
          type: '',
          amount: formatGramAmount(totalGrams),
          percentage: '100%',
          dilution: '',
          unitPrice: '',
          cost: formatPrice(totalCost),
        },
      ],
      notes: formula.notes || '',
    });
  };

  if (loading) {
    return (
      <DetailPageLayout>
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-64 w-full" />
      </DetailPageLayout>
    );
  }

  if (!formula) {
    return null;
  }

  const totalGrams = calculateTotalAmount(items);
  const totalPercentage = items.reduce((sum, item) => sum + (item.percentage || 0), 0);
  const totalCost = calculateTotalCost(items);
  const lowStockCount = items.filter((item) => item.is_low_stock).length;
  const dilutedItemCount = items.filter((item) => item.is_diluted && item.dilution_percentage).length;

  return (
    <>
      <Helmet>
        <title>{`${formula.name} - Formula Details`}</title>
        <meta name="description" content={`Detailed view of ${formula.name} formula with gram-based composition and cost breakdown.`} />
      </Helmet>
      
      <DetailPageLayout>
        <DetailPageHeader
          eyebrow="Formula"
          title={formula.name}
          subtitle={[
            `Code ${formula.code}`,
            formula.category ? formatStatus(formula.category) : null,
            formula.version ? `Version ${formula.version}` : null,
          ].filter(Boolean).join(' / ')}
          badge={
            formula.status && (
              <Badge variant="outline" className="capitalize text-xs">
                {formatStatus(formula.status)}
              </Badge>
            )
          }
          onBack={() => navigate('/formulas')}
          backLabel="Back to formulas"
          meta={
            <>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Formula size</span>
                <span className="detail-page-meta-value">{formatGramAmount(totalGrams)}</span>
              </div>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Material cost</span>
                <span className="detail-page-meta-value">{formatPrice(totalCost)}</span>
              </div>
              <div className="detail-page-meta-chip">
                <span className="detail-page-meta-label">Related batches</span>
                <span className="detail-page-meta-value">{batches.length}</span>
              </div>
            </>
          }
          actions={
            <>
              <Button onClick={() => setCreateBatchModalOpen(true)} className="gap-2 h-9">
                <Plus className="w-4 h-4" />
                Create batch
              </Button>
              <Button variant="outline" onClick={() => setEditModalOpen(true)} className="gap-2 h-9">
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              <ExportFormulaButton formula={formula} items={items} />
              <Button variant="outline" onClick={handlePrint} className="gap-2 h-9">
                <Printer className="w-4 h-4" />
                Print
              </Button>
              <Button variant="destructive" onClick={() => setIsDeleteModalOpen(true)} className="gap-2 h-9">
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </>
          }
        />

        <div className="space-y-5 print-full-width">
          <DetailSection title="Snapshot">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Total items</div>
                <div className="text-lg font-semibold">{items.length}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Low stock ingredients</div>
                <div className={`text-lg font-semibold ${lowStockCount > 0 ? 'text-destructive' : ''}`}>{lowStockCount}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Diluted ingredients</div>
                <div className="text-lg font-semibold">{dilutedItemCount}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Recent batches</div>
                <div className="text-lg font-semibold">{batches.length}</div>
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Summary">
            <DetailFieldGroup columns={4}>
              <DetailField label="Code" value={formula.code} />
              <DetailField label="By" value={formatNullable(formula.author_name)} />
              <DetailField label="Status" value={formatStatus(formula.status || 'draft')} />
              <DetailField label="Material cost" value={formatPrice(totalCost)} />
              <DetailField label="Category" value={formatNullable(formula.category)} />
              <DetailField label="Version" value={formatNullable(formula.version)} />
            </DetailFieldGroup>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <DetailField 
                label="Total amount" 
                value={formatGramAmount(totalGrams)} 
              />
              <DetailField 
                label="Created" 
                value={formatDate(formula.created)} 
              />
            </div>
          </DetailSection>

          <DetailSection title="Composition profile">
            <PyramidSummary items={items} />
          </DetailSection>

          <DetailSection title="Composition">
            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Material name</TableHead>
                    <TableHead className="min-w-[100px]">Item type</TableHead>
                    <TableHead className="text-right min-w-[100px]">Amount</TableHead>
                    <TableHead className="text-right min-w-[100px]">Percentage</TableHead>
                    <TableHead className="text-right min-w-[140px]">Unit price</TableHead>
                    <TableHead className="text-right min-w-[100px]">Cost</TableHead>
                    <TableHead className="text-right min-w-[100px]">Stock status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const ingredientCost = item.ingredient_cost ?? calculateIngredientCost(item.gram_amount, item.unit_price);
                    const isDiluted = item.is_diluted && item.dilution_percentage;
                    const composition = isDiluted 
                      ? calculateDilutionComposition(item.gram_amount, item.dilution_percentage)
                      : null;

                    return (
                      <React.Fragment key={index}>
                        <TableRow>
                          <TableCell>
                            {item.item_type === 'raw_material' || item.item_type === 'solvent' ? (
                              <button
                                onClick={() => navigate(`/raw-material/${item.item_id}`)}
                                className="font-medium text-primary hover:underline text-sm"
                              >
                                {item.name}
                                {isDiluted && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    ({item.dilution_percentage}%{item.dilution_solvent_name ? ` in ${item.dilution_solvent_name}` : ''})
                                  </span>
                                )}
                              </button>
                            ) : (
                              <div className="font-medium text-sm">
                                {item.name}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              {formatStatus(item.item_type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatGramAmount(item.gram_amount)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatPercentage(item.percentage)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatPricePerUnit(item.unit_price, item.unit)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatPrice(ingredientCost)}
                          </TableCell>
                          <TableCell className="text-right">
                            {(item.item_type === 'raw_material' || item.item_type === 'solvent') && (
                              <Badge variant={item.is_low_stock ? 'destructive' : 'default'} className="text-xs">
                                {item.is_low_stock ? 'Low stock' : 'In stock'}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                        {isDiluted && composition && (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={7} className="py-2 px-4">
                              <div className="text-xs text-muted-foreground">
                                Active: {formatGramAmount(composition.activeAmount)} + Solvent: {formatGramAmount(composition.solventAmount)}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell colSpan={2} className="text-sm">Total</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatGramAmount(totalGrams)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatPercentage(totalPercentage)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-mono text-sm text-primary">
                      {formatPrice(totalCost)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/10 p-4">
              <div className="text-xs text-muted-foreground">Formula material cost</div>
              <div className="mt-1 text-lg font-bold font-mono text-primary">{formatPrice(totalCost)}</div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Percentages are calculated from gram amounts. Formula detail stays focused on raw materials and solvent-related costs only.
            </p>
          </DetailSection>

          {batches.length > 0 && (
            <DetailSection title="Related batches">
              <div className="rounded-lg border bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Batch code</TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="text-right min-w-[100px]">Quantity</TableHead>
                      <TableHead className="text-right min-w-[120px]">Production date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell>
                          <button
                            onClick={() => navigate(`/batches/${batch.id}`)}
                            className="font-medium font-mono text-primary hover:underline text-sm"
                          >
                            {batch.batch_code}
                          </button>
                        </TableCell>
                        <TableCell>
                          <BatchStatusBadge status={batch.status} />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatQuantity(batch.target_quantity)} {batch.unit || 'ml'}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatDate(batch.production_date)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </DetailSection>
          )}

          {formula.notes && (
            <DetailSection title="Notes">
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{formula.notes}</p>
            </DetailSection>
          )}

          <DetailSection>
            <DetailMetadata 
              created={formula.created} 
              updated={formula.updated}
              additionalFields={formula.batch_date ? [
                { label: 'Batch date', value: formatDate(formula.batch_date) }
              ] : []}
            />
          </DetailSection>
        </div>
      </DetailPageLayout>

      <CreateBatchModal
        open={createBatchModalOpen}
        onOpenChange={setCreateBatchModalOpen}
        preSelectedFormulaId={id}
        onSuccess={() => {
          toast.success('Batch created successfully');
          navigate('/batches');
        }}
      />

      <EditFormulaModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        formula={formula}
        onSuccess={loadFormulaDetails}
      />

      <DeleteFormulaModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        formulaId={id}
        formulaName={formula?.name}
        onDeleteSuccess={() => navigate('/formulas')}
      />
    </>
  );
};

export default FormulaDetailPage;

