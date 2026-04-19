
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pencil, Trash2, Printer, ExternalLink, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useBatches } from '@/hooks/useBatches.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import {
  calculateBatchComposition,
  calculateBatchCost,
  completeBatchWithStockDeduction,
  getBatchById,
  getBatchUsageRecords,
  validateBatchStockDeduction,
} from '@/services/batchesSupabaseService.js';
import DetailPageLayout from '@/components/DetailPageLayout.jsx';
import DetailPageHeader from '@/components/DetailPageHeader.jsx';
import DetailSection from '@/components/DetailSection.jsx';
import DetailField from '@/components/DetailField.jsx';
import DetailFieldGroup from '@/components/DetailFieldGroup.jsx';
import DetailMetadata from '@/components/DetailMetadata.jsx';
import BatchStatusBadge from '@/components/BatchStatusBadge.jsx';
import EditBatchModal from '@/components/EditBatchModal.jsx';
import ConfirmDialog from '@/components/ConfirmDialog.jsx';
import { formatQuantity, formatPercentage, formatStatus, formatDate } from '@/utils/formatting.js';
import { formatPrice, formatPricePerUnit } from '@/utils/pricingUtils.js';
import { getFormulaById } from '@/services/formulasSupabaseService.js';
import { getRawMaterialById } from '@/services/rawMaterialsService.js';

const BatchDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { deleteBatch } = useBatches();
  const { getFormulaItems } = useFormulaItems();
  const [batch, setBatch] = useState(null);
  const [formula, setFormula] = useState(null);
  const [solvent, setSolvent] = useState(null);
  const [expandedComposition, setExpandedComposition] = useState([]);
  const [usageRecords, setUsageRecords] = useState([]);
  const [costBreakdown, setCostBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [deductionSummary, setDeductionSummary] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    loadBatchDetails();
  }, [id]);

  const loadBatchDetails = async () => {
    setLoading(true);
    try {
      const batchData = await getBatchById(id);
      setBatch(batchData);

      const formulaData = await getFormulaById(batchData.formula_id);
      setFormula(formulaData);

      let solventData = null;
      if (batchData.solvent_id) {
        solventData = await getRawMaterialById(batchData.solvent_id);
        setSolvent(solventData);
      } else {
        setSolvent(null);
      }

      const itemsData = await getFormulaItems(batchData.formula_id);
      const usageData = await getBatchUsageRecords(batchData.id);
      setUsageRecords(usageData);

      // Calculate expanded composition (includes dilution expansion)
      const compositionData = await calculateBatchComposition(batchData, itemsData, solventData);
      setExpandedComposition(compositionData);

      // Calculate cost breakdown
      const costData = calculateBatchCost(compositionData, batchData.target_quantity);
      setCostBreakdown(costData);

    } catch (error) {
      console.error('Failed to load batch details:', error);
      toast.error('Failed to load batch details');
      navigate('/batches');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (batch.status !== 'draft') {
      toast.error('Only draft batches can be deleted');
      return;
    }
    
    setDeleting(true);
    try {
      await deleteBatch(id);
      toast.success('Batch deleted successfully');
      navigate('/batches');
    } catch (error) {
      toast.error('Failed to delete batch');
      setDeleting(false);
    }
  };

  const handleOpenCompleteDialog = async () => {
    setValidating(true);
    setCompleteDialogOpen(true);
    try {
      const validation = await validateBatchStockDeduction(batch);
      setDeductionSummary(validation);
    } catch (error) {
      toast.error(error.message || 'Failed to validate stock deduction');
      setCompleteDialogOpen(false);
    } finally {
      setValidating(false);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const result = await completeBatchWithStockDeduction(id);
      toast.success('Batch completed and stock deducted');
      setCompleteDialogOpen(false);
      await loadBatchDetails();
    } catch (error) {
      toast.error(error.message || 'Failed to complete batch');
    } finally {
      setCompleting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalMaterialsUsed = useMemo(
    () => expandedComposition.reduce((sum, item) => sum + Number(item.required_quantity || 0), 0),
    [expandedComposition]
  );
  const totalUsageCost = useMemo(
    () => usageRecords.reduce((sum, record) => sum + Number(record.cost || 0), 0),
    [usageRecords]
  );

  if (loading) {
    return (
      <DetailPageLayout>
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-64 w-full" />
      </DetailPageLayout>
    );
  }

  if (!batch || !formula) {
    return null;
  }

  const canComplete = batch.status !== 'completed' && !batch.is_stock_deducted;

  // Group composition by type
  const formulaIngredients = expandedComposition.filter(item => item.type === 'formula_ingredient');
  const dilutionSolvents = expandedComposition.filter(item => item.type === 'dilution_solvent');
  const mainBatchSolvents = expandedComposition.filter(item => item.type === 'main_batch_solvent');

  return (
    <>
      <Helmet>
        <title>{`${batch.batch_code} - Batch Details`}</title>
        <meta name="description" content={`Detailed view of batch ${batch.batch_code} with expanded material composition, dilution breakdown, and cost analysis.`} />
      </Helmet>
      
      <DetailPageLayout>
        <DetailPageHeader
          title={batch.batch_code}
          badge={<BatchStatusBadge status={batch.status} showIcon />}
          onBack={() => navigate('/batches')}
          backLabel="Back to batches"
          actions={
            <>
              {canComplete && (
                <Button 
                  onClick={handleOpenCompleteDialog} 
                  className="gap-2 h-9"
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete batch
                </Button>
              )}
              {batch.status === 'draft' && (
                <Button variant="outline" onClick={() => setEditModalOpen(true)} className="gap-2 h-9">
                  <Pencil className="w-4 h-4" />
                  Edit
                </Button>
              )}
              <Button variant="outline" onClick={handlePrint} className="gap-2 h-9">
                <Printer className="w-4 h-4" />
                Print
              </Button>
              {batch.status === 'draft' && (
                <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="gap-2 h-9">
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              )}
            </>
          }
        />

        <div className="space-y-5 print-full-width">
          <DetailSection title="Summary">
            <DetailFieldGroup columns={3}>
              <DetailField label="Batch code" value={batch.batch_code} />
              <DetailField 
                label="Status" 
                value={<BatchStatusBadge status={batch.status} />} 
              />
              <DetailField 
                label="Production date" 
                value={formatDate(batch.production_date)} 
              />
            </DetailFieldGroup>
            {batch.is_stock_deducted && (
              <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-xs text-primary font-medium">
                  Stock has already been deducted for this batch.
                </p>
              </div>
            )}
          </DetailSection>

          <DetailSection title="Production snapshot">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Total batch cost</div>
                <div className="text-lg font-semibold font-mono">
                  {costBreakdown ? formatPrice(costBreakdown.total_cost) : '-'}
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">COGS per {batch.unit}</div>
                <div className="text-lg font-semibold font-mono">
                  {costBreakdown ? formatPrice(costBreakdown.cost_per_unit) : '-'}
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Materials involved</div>
                <div className="text-lg font-semibold">{expandedComposition.length}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Total material volume</div>
                <div className="text-lg font-semibold font-mono">
                  {formatQuantity(totalMaterialsUsed)} {batch.unit}
                </div>
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Formula information">
            <div className="p-4 bg-card border rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold mb-1">{formula.name}</h3>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="font-mono">Code: {formula.code}</span>
                    {formula.category && (
                      <span className="capitalize">{formatStatus(formula.category)}</span>
                    )}
                    {formula.status && (
                      <Badge variant="outline" className="capitalize text-xs">
                        {formatStatus(formula.status)}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/formulas/${formula.id}`)}
                  className="gap-2 h-8"
                >
                  View formula
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
              {formula.batch_size && (
                <div className="text-xs text-muted-foreground">
                  Batch size: {formatQuantity(formula.batch_size)} ml
                </div>
              )}
            </div>
          </DetailSection>

          <DetailSection title="Solvent & dilution">
            <DetailFieldGroup columns={2}>
              <DetailField 
                label="Solvent material" 
                value={
                  solvent ? (
                    <button
                      onClick={() => navigate(`/raw-material/${solvent.id}`)}
                      className="text-primary hover:underline font-medium text-sm"
                    >
                      {solvent.name}
                    </button>
                  ) : 'N/A'
                } 
              />
              <DetailField 
                label="Solvent type" 
                value={solvent ? formatStatus(solvent.type) : 'N/A'} 
              />
            </DetailFieldGroup>
            <div className="mt-3 p-4 bg-muted/30 rounded-lg border">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Formula concentration</div>
                  <div className="font-mono font-semibold">{formatPercentage(batch.formula_percentage || 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Solvent percentage</div>
                  <div className="font-mono font-semibold">{formatPercentage(batch.solvent_percentage || 0)}</div>
                </div>
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Quantity breakdown">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="p-3 bg-card border rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Target batch size</div>
                <div className="text-lg font-bold font-mono">{formatQuantity(batch.target_quantity)} {batch.unit}</div>
              </div>
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Formula concentrate needed</div>
                <div className="text-lg font-bold font-mono text-primary">
                  {formatQuantity(batch.formula_quantity_needed || 0)} {batch.unit}
                </div>
              </div>
              <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Solvent needed</div>
                <div className="text-lg font-bold font-mono text-accent">
                  {formatQuantity(batch.solvent_quantity_needed || 0)} {batch.unit}
                </div>
              </div>
              <div className="p-3 bg-muted border rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Produced quantity</div>
                <div className="text-lg font-bold font-mono">{formatQuantity(batch.produced_quantity || 0)} {batch.unit}</div>
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Material requirements & cost breakdown">
            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Material name</TableHead>
                    <TableHead className="min-w-[120px]">Type</TableHead>
                    <TableHead className="text-right min-w-[120px]">Required qty</TableHead>
                    <TableHead className="text-right min-w-[80px]">Unit</TableHead>
                    <TableHead className="text-right min-w-[120px]">Cost per unit</TableHead>
                    <TableHead className="text-right min-w-[100px]">Total cost</TableHead>
                    <TableHead className="min-w-[200px]">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Formula Ingredients Group */}
                  {formulaIngredients.length > 0 && (
                    <>
                      <TableRow className="bg-primary/5">
                        <TableCell colSpan={7} className="font-semibold text-sm">
                          Formula Ingredients
                        </TableCell>
                      </TableRow>
                      {formulaIngredients.map((item, index) => (
                        <TableRow key={`ingredient-${index}`}>
                          <TableCell className="font-medium text-sm">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              Active Material
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatQuantity(item.required_quantity)}
                          </TableCell>
                          <TableCell className="text-right text-sm">{item.unit}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatPricePerUnit(item.cost_per_unit, item.unit)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatPrice(item.total_cost)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.source}</TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}

                  {/* Dilution Solvents Group */}
                  {dilutionSolvents.length > 0 && (
                    <>
                      <TableRow className="bg-accent/5">
                        <TableCell colSpan={7} className="font-semibold text-sm">
                          Dilution Solvents (inside ingredients)
                        </TableCell>
                      </TableRow>
                      {dilutionSolvents.map((item, index) => (
                        <TableRow key={`dilution-${index}`}>
                          <TableCell className="font-medium text-sm">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              Dilution Solvent
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatQuantity(item.required_quantity)}
                          </TableCell>
                          <TableCell className="text-right text-sm">{item.unit}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatPricePerUnit(item.cost_per_unit, item.unit)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatPrice(item.total_cost)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.source}</TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}

                  {/* Main Batch Solvent Group */}
                  {mainBatchSolvents.length > 0 && (
                    <>
                      <TableRow className="bg-secondary/5">
                        <TableCell colSpan={7} className="font-semibold text-sm">
                          Main Batch Solvent
                        </TableCell>
                      </TableRow>
                      {mainBatchSolvents.map((item, index) => (
                        <TableRow key={`solvent-${index}`}>
                          <TableCell className="font-medium text-sm">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              Batch Solvent
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatQuantity(item.required_quantity)}
                          </TableCell>
                          <TableCell className="text-right text-sm">{item.unit}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatPricePerUnit(item.cost_per_unit, item.unit)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatPrice(item.total_cost)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.source}</TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}

                  {/* Cost Breakdown */}
                  {costBreakdown && (
                    <>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={5} className="text-sm font-medium">Formula ingredients</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatPrice(costBreakdown.formula_ingredient_cost)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={5} className="text-sm font-medium">Dilution solvents (inside ingredients)</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatPrice(costBreakdown.dilution_solvent_cost)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={5} className="text-sm font-medium">Main batch solvent</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatPrice(costBreakdown.main_batch_solvent_cost)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      <TableRow className="font-semibold bg-primary/10">
                        <TableCell colSpan={5} className="text-sm">Total batch cost</TableCell>
                        <TableCell className="text-right font-mono text-sm text-primary">
                          {formatPrice(costBreakdown.total_cost)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={5} className="text-sm">Cost per {batch.unit}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatPrice(costBreakdown.cost_per_unit)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Diluted materials are expanded into active material + dilution solvent components. All costs are calculated based on actual material usage.
            </p>
          </DetailSection>

          {batch.is_stock_deducted && (
            <DetailSection title="Stock deduction record">
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-xs text-muted-foreground mb-1">Deduction lines</div>
                  <div className="text-lg font-semibold">{usageRecords.length}</div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-xs text-muted-foreground mb-1">Recorded deduction cost</div>
                  <div className="text-lg font-semibold font-mono">{formatPrice(totalUsageCost)}</div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-xs text-muted-foreground mb-1">Batch stock status</div>
                  <div className="text-lg font-semibold">Deducted</div>
                </div>
              </div>

              {usageRecords.length > 0 ? (
                <div className="rounded-lg border bg-card overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Quantity deducted</TableHead>
                        <TableHead className="text-right">Recorded cost</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium text-sm">{record.material_name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">
                              {record.type?.replaceAll('_', ' ') || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatQuantity(record.quantity_deducted)} {record.material_unit || batch.unit}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatPrice(record.cost || 0)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{record.source || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No stock deduction records found for this batch yet.</p>
              )}
            </DetailSection>
          )}

          <DetailSection title="Notes">
            {batch.notes ? (
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{batch.notes}</p>
            ) : (
              <p className="text-muted-foreground italic text-sm">No notes added</p>
            )}
          </DetailSection>

          <DetailSection>
            <DetailMetadata 
              created={batch.created} 
              updated={batch.updated} 
            />
          </DetailSection>
        </div>
      </DetailPageLayout>

      <EditBatchModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        batch={batch}
        onSuccess={loadBatchDetails}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete batch"
        description={`Are you sure you want to delete batch "${batch.batch_code}"? This action cannot be undone.`}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
      />

      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete batch and deduct stock</DialogTitle>
            <DialogDescription>
              Review the materials that will be deducted from stock
            </DialogDescription>
          </DialogHeader>

          {validating ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : deductionSummary ? (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Total materials</div>
                    <div className="font-semibold">{deductionSummary.summary.total_materials}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Formula ingredients</div>
                    <div className="font-semibold">{deductionSummary.summary.formula_ingredients}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Dilution solvents</div>
                    <div className="font-semibold">{deductionSummary.summary.dilution_solvents}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Main batch solvents</div>
                    <div className="font-semibold">{deductionSummary.summary.main_batch_solvents}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Quantity to deduct</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deductionSummary.deductions.map((deduction, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium text-sm">{deduction.material_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {deduction.type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatQuantity(deduction.amount_to_deduct)} {deduction.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatPrice(deduction.cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={completing || validating}>
              {completing ? 'Completing...' : 'Complete batch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BatchDetailPage;
