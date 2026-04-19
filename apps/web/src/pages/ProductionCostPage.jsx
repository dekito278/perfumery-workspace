import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Calculator, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { getFormulas, getFormulaItems } from '@/services/formulasSupabaseService.js';
import { getRawMaterials } from '@/services/rawMaterialsService.js';
import { calculateIngredientCost, formatPrice, formatPricePerUnit } from '@/utils/pricingUtils.js';
import { formatGramAmount, formatPercentage, formatQuantity } from '@/utils/formatting.js';
import { buildFormulaItemReferenceMaps, resolveFormulaItemReference } from '@/utils/legacyFormulaItemSources.js';

const parseNumberInput = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ProductionCostPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [formulas, setFormulas] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [selectedFormulaId, setSelectedFormulaId] = useState('');
  const [selectedSolventId, setSelectedSolventId] = useState('');
  const [formulaProfile, setFormulaProfile] = useState(null);
  const [totalBatchVolume, setTotalBatchVolume] = useState('1000');
  const [formulaPercentage, setFormulaPercentage] = useState('20');
  const [bottleSize, setBottleSize] = useState('30');
  const [bottleCost, setBottleCost] = useState('0');
  const [capCost, setCapCost] = useState('0');
  const [packagingCost, setPackagingCost] = useState('0');
  const [labelCost, setLabelCost] = useState('0');
  const [otherUnitCost, setOtherUnitCost] = useState('0');

  useEffect(() => {
    const loadReferenceData = async () => {
      setLoading(true);
      try {
        const [formulasData, rawMaterialsData] = await Promise.all([
          getFormulas(),
          getRawMaterials(),
        ]);

        setFormulas(formulasData);
        setRawMaterials(rawMaterialsData);

        const firstFormulaId = formulasData[0]?.id || '';
        const firstSolventId = rawMaterialsData.find((material) => material.type === 'solvent')?.id || '';
        setSelectedFormulaId(firstFormulaId);
        setSelectedSolventId(firstSolventId);
      } catch (error) {
        toast.error('Failed to load production costing data');
      } finally {
        setLoading(false);
      }
    };

    loadReferenceData();
  }, []);

  useEffect(() => {
    const loadFormulaProfile = async () => {
      if (!selectedFormulaId) {
        setFormulaProfile(null);
        return;
      }

      try {
        const items = await getFormulaItems(selectedFormulaId);
        const referenceMaps = await buildFormulaItemReferenceMaps(items, rawMaterials);

        const enrichedItems = items.map((item) => {
          const sourceItem = resolveFormulaItemReference(item, referenceMaps);
          const gramAmount = Number(item.grams || 0);
          const unitPrice = Number(sourceItem?.cost_per_unit || 0);

          return {
            ...item,
            name: sourceItem?.name || 'Unknown',
            gram_amount: gramAmount,
            unit_price: unitPrice,
            ingredient_cost: calculateIngredientCost(gramAmount, unitPrice),
          };
        });

        const totalGrams = enrichedItems.reduce((sum, item) => sum + Number(item.gram_amount || 0), 0);
        const totalMaterialCost = enrichedItems.reduce((sum, item) => sum + Number(item.ingredient_cost || 0), 0);

        setFormulaProfile({
          items: enrichedItems,
          totalGrams,
          totalMaterialCost,
          costPerMl: totalGrams > 0 ? totalMaterialCost / totalGrams : 0,
        });
      } catch (error) {
        toast.error('Failed to load formula profile');
        setFormulaProfile(null);
      }
    };

    if (!loading && rawMaterials.length >= 0) {
      loadFormulaProfile();
    }
  }, [selectedFormulaId, rawMaterials, loading]);

  const solventOptions = useMemo(
    () => rawMaterials.filter((material) => material.type === 'solvent'),
    [rawMaterials]
  );

  const selectedFormula = formulas.find((formula) => formula.id === selectedFormulaId) || null;
  const selectedSolvent = solventOptions.find((material) => material.id === selectedSolventId) || null;

  const computed = useMemo(() => {
    const batchVolume = parseNumberInput(totalBatchVolume);
    const concentration = parseNumberInput(formulaPercentage);
    const unitBottleSize = parseNumberInput(bottleSize);
    const perBottleBottleCost = parseNumberInput(bottleCost);
    const perBottleCapCost = parseNumberInput(capCost);
    const perBottlePackagingCost = parseNumberInput(packagingCost);
    const perBottleLabelCost = parseNumberInput(labelCost);
    const perBottleOtherUnitCost = parseNumberInput(otherUnitCost);

    const formulaVolumeNeeded = batchVolume * (concentration / 100);
    const solventVolumeNeeded = Math.max(batchVolume - formulaVolumeNeeded, 0);
    const formulaMaterialCost = (formulaProfile?.costPerMl || 0) * formulaVolumeNeeded;
    const solventMaterialCost = selectedSolvent ? ((Number(selectedSolvent.cost_per_unit || 0) / 10) * solventVolumeNeeded) : 0;
    const totalMaterialCost = formulaMaterialCost + solventMaterialCost;
    const bottleCount = unitBottleSize > 0 ? Math.floor(batchVolume / unitBottleSize) : 0;
    const remainingVolume = unitBottleSize > 0 ? batchVolume - (bottleCount * unitBottleSize) : 0;
    const additionalUnitCost = perBottleBottleCost + perBottleCapCost + perBottlePackagingCost + perBottleLabelCost + perBottleOtherUnitCost;
    const totalAdditionalCost = bottleCount * additionalUnitCost;
    const totalProductionCost = totalMaterialCost + totalAdditionalCost;

    return {
      batchVolume,
      concentration,
      unitBottleSize,
      formulaVolumeNeeded,
      solventVolumeNeeded,
      formulaMaterialCost,
      solventMaterialCost,
      totalMaterialCost,
      bottleCount,
      remainingVolume,
      additionalUnitCost,
      totalAdditionalCost,
      totalProductionCost,
      costPerBottle: bottleCount > 0 ? totalProductionCost / bottleCount : 0,
      materialCostPerBottle: bottleCount > 0 ? totalMaterialCost / bottleCount : 0,
    };
  }, [totalBatchVolume, formulaPercentage, bottleSize, bottleCost, capCost, packagingCost, labelCost, otherUnitCost, formulaProfile, selectedSolvent]);

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Production Costing - Perfumer Studio</title>
        <meta name="description" content="Calculate batch-to-bottle production cost with formula concentrate, solvent, and packaging extras." />
      </Helmet>
      <div className="page-container">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="gap-2 mb-4 h-9"
          >
            <Home className="w-4 h-4" />
            Back to dashboard
          </Button>
        </div>

        <PageHeader
          title="Production Costing"
          description="Hitung hasil batch ke botol jadi tanpa mengganggu formula. Formula tetap fokus ke material, sedangkan biaya botol, cap, packaging, dan label dihitung di sini."
        />

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-xl border bg-card p-5 space-y-5">
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Batch setup</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Formula</Label>
                      <Select value={selectedFormulaId} onValueChange={setSelectedFormulaId}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select formula" />
                        </SelectTrigger>
                        <SelectContent>
                          {formulas.map((formula) => (
                            <SelectItem key={formula.id} value={formula.id}>
                              {formula.name} ({formula.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Solvent</Label>
                      <Select value={selectedSolventId} onValueChange={setSelectedSolventId}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select solvent" />
                        </SelectTrigger>
                        <SelectContent>
                          {solventOptions.map((material) => (
                            <SelectItem key={material.id} value={material.id}>
                              {material.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Total batch (ml)</Label>
                      <Input value={totalBatchVolume} onChange={(event) => setTotalBatchVolume(event.target.value)} type="number" min="0" step="0.01" />
                    </div>
                    <div className="space-y-2">
                      <Label>Formula concentration %</Label>
                      <Input value={formulaPercentage} onChange={(event) => setFormulaPercentage(event.target.value)} type="number" min="0" max="100" step="0.01" />
                    </div>
                    <div className="space-y-2">
                      <Label>Bottle size (ml)</Label>
                      <Input value={bottleSize} onChange={(event) => setBottleSize(event.target.value)} type="number" min="0" step="0.01" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 border-t pt-5">
                  <h2 className="text-lg font-semibold">Per-bottle extras</h2>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Bottle cost</Label>
                      <Input value={bottleCost} onChange={(event) => setBottleCost(event.target.value)} type="number" min="0" step="0.01" />
                    </div>
                    <div className="space-y-2">
                      <Label>Cap cost</Label>
                      <Input value={capCost} onChange={(event) => setCapCost(event.target.value)} type="number" min="0" step="0.01" />
                    </div>
                    <div className="space-y-2">
                      <Label>Packaging cost</Label>
                      <Input value={packagingCost} onChange={(event) => setPackagingCost(event.target.value)} type="number" min="0" step="0.01" />
                    </div>
                    <div className="space-y-2">
                      <Label>Label cost</Label>
                      <Input value={labelCost} onChange={(event) => setLabelCost(event.target.value)} type="number" min="0" step="0.01" />
                    </div>
                    <div className="space-y-2">
                      <Label>Other unit cost</Label>
                      <Input value={otherUnitCost} onChange={(event) => setOtherUnitCost(event.target.value)} type="number" min="0" step="0.01" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" />
                  <h2 className="text-lg font-semibold">Cost summary</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="text-xs text-muted-foreground">Bottles produced</div>
                    <div className="mt-1 text-2xl font-bold">{computed.bottleCount}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="text-xs text-muted-foreground">Remaining volume</div>
                    <div className="mt-1 text-2xl font-bold font-mono">{formatQuantity(computed.remainingVolume)} ml</div>
                  </div>
                  <div className="rounded-lg border bg-primary/10 p-4">
                    <div className="text-xs text-muted-foreground">Material cost per bottle</div>
                    <div className="mt-1 text-2xl font-bold font-mono text-primary">{formatPrice(computed.materialCostPerBottle)}</div>
                  </div>
                  <div className="rounded-lg border bg-accent/10 p-4">
                    <div className="text-xs text-muted-foreground">Total cost per bottle</div>
                    <div className="mt-1 text-2xl font-bold font-mono">{formatPrice(computed.costPerBottle)}</div>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Formula concentrate needed</span>
                    <span className="font-mono">{formatQuantity(computed.formulaVolumeNeeded)} ml</span>
                  </div>
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Solvent needed</span>
                    <span className="font-mono">{formatQuantity(computed.solventVolumeNeeded)} ml</span>
                  </div>
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Formula material cost</span>
                    <span className="font-mono">{formatPrice(computed.formulaMaterialCost)}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Solvent cost</span>
                    <span className="font-mono">{formatPrice(computed.solventMaterialCost)}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">All extras per bottle</span>
                    <span className="font-mono">{formatPrice(computed.additionalUnitCost)}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Total extra cost</span>
                    <span className="font-mono">{formatPrice(computed.totalAdditionalCost)}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-t pt-3 text-sm font-semibold">
                    <span>Total production cost</span>
                    <span className="font-mono text-primary">{formatPrice(computed.totalProductionCost)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <h2 className="text-lg font-semibold">Selected formula profile</h2>
                {selectedFormula && formulaProfile ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <div className="text-xs text-muted-foreground">Formula total amount</div>
                        <div className="mt-1 text-lg font-semibold font-mono">{formatGramAmount(formulaProfile.totalGrams)}</div>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <div className="text-xs text-muted-foreground">Material cost per ml</div>
                        <div className="mt-1 text-lg font-semibold font-mono">{formatPrice(formulaProfile.costPerMl)}</div>
                      </div>
                    </div>
                    <div className="rounded-lg border p-4 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Formula</span>
                        <span className="font-medium">{selectedFormula.name}</span>
                      </div>
                      <div className="mt-2 flex justify-between gap-4">
                        <span className="text-muted-foreground">Code</span>
                        <span className="font-mono">{selectedFormula.code}</span>
                      </div>
                      <div className="mt-2 flex justify-between gap-4">
                        <span className="text-muted-foreground">Material total cost</span>
                        <span className="font-mono">{formatPrice(formulaProfile.totalMaterialCost)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Choose a formula to calculate production cost.</p>
                )}
              </div>

              <div className="rounded-xl border bg-card p-5 space-y-4">
                <h2 className="text-lg font-semibold">How the calculation works</h2>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>Formula cost uses the raw material costs already saved in your formula.</p>
                  <p>Batch material cost = formula concentrate needed + solvent needed.</p>
                  <p>Per-bottle extras are added only in this menu, so formula import and formula editing stay clean.</p>
                  <p>Bottle count is rounded down to full bottles. Sisa volume ditampilkan terpisah supaya mudah dipakai untuk uji coba atau topping.</p>
                </div>
                {selectedSolvent && (
                  <div className="rounded-lg border p-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Solvent price</span>
                      <span className="font-mono">{formatPricePerUnit(selectedSolvent.cost_per_unit, selectedSolvent.unit)}</span>
                    </div>
                    <div className="mt-2 flex justify-between gap-4">
                      <span className="text-muted-foreground">Formula concentration</span>
                      <span className="font-mono">{formatPercentage(computed.concentration)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default ProductionCostPage;
