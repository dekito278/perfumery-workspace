import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calculator, Download, Droplets, FlaskConical, PackageCheck, Save } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { useProductionCostPage } from '@/hooks/useProductionCostPage.js';
import { updateRawMaterial } from '@/services/rawMaterialsService.js';
import { formatCurrency, formatGramAmount, formatPercentage, formatQuantity } from '@/utils/formatting.js';
import { calculateIngredientCost, formatPrice, formatPricePerUnit } from '@/utils/pricingUtils.js';
import { buildFormulaWorkbookExportConfig } from '@/utils/formulaWorkbookExport.js';
import { clampPercentage, parseNumberInput } from '@/utils/productionCosting.js';

const DEFAULT_TARGET_GRAMS = '100';

const MetricTile = ({ label, value, helper, tone = 'neutral' }) => {
  const toneClass = tone === 'amber'
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-[#ece8df] bg-[#f8f7f4] text-[#1f2937]';

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="text-[10px] font-bold uppercase opacity-70">{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
      {helper ? <div className="mt-0.5 text-[10px] font-semibold opacity-75">{helper}</div> : null}
    </div>
  );
};

const CostRow = ({ helper, item, label, onDraftChange, onSave, saving, value }) => (
  <div className="border-b border-[#f0ede7] py-2 last:border-b-0">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-xs font-bold text-[#1f2937]">{label}</div>
        {helper ? <div className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">{helper}</div> : null}
      </div>
      <div className="shrink-0 text-right text-xs font-bold text-[#1f2937]">{value}</div>
    </div>
    <div className="mt-2 grid grid-cols-[1fr_44px] gap-2">
      <Input
        value={item.priceDraft}
        onChange={(event) => onDraftChange(item.item_id, event.target.value)}
        inputMode="decimal"
        type="number"
        min="0"
        step="0.01"
        className="h-9 rounded-xl bg-[#f8f7f4] px-2 text-xs font-bold"
        aria-label={`${label} price per 10 ml`}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onSave(item.item_id, item.priceDraft)}
        disabled={saving}
        className="h-9 rounded-xl bg-white"
        aria-label={`Save ${label} price`}
      >
        <Save className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

const SolventPriceEditor = ({ material, priceDraft, onDraftChange, onSave, saving }) => (
  <div className="grid grid-cols-[1fr_44px] gap-2">
    <Input
      value={priceDraft}
      onChange={(event) => onDraftChange(material?.id || '', event.target.value)}
      inputMode="decimal"
      type="number"
      min="0"
      step="0.01"
      className="h-10 rounded-xl bg-white text-xs font-bold"
      aria-label="Solvent price per 10 ml"
      disabled={!material}
    />
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => onSave(material?.id, priceDraft)}
      disabled={!material || saving}
      className="h-10 rounded-xl bg-white"
      aria-label="Save solvent price"
    >
      <Save className="h-4 w-4" />
    </Button>
  </div>
);

const buildScaledRows = (items = [], targetGrams = 0, totalFormulaGrams = 0, priceOverrides = new Map(), priceDrafts = {}) => {
  if (!items.length || targetGrams <= 0 || totalFormulaGrams <= 0) {
    return [];
  }

  return items.map((item, index) => {
    const formulaGram = Number(item.gram_amount || item.grams || 0);
    const percentage = totalFormulaGrams > 0 ? (formulaGram / totalFormulaGrams) * 100 : 0;
    const batchGram = (targetGrams * percentage) / 100;
    const unitPrice = Number(priceOverrides.get(item.item_id) ?? item.unit_price ?? 0);
    const cost = calculateIngredientCost(batchGram, unitPrice);

    return {
      ...item,
      batchGram,
      cost,
      percentage,
      priceDraft: priceDrafts[item.item_id] ?? String(unitPrice || ''),
      rowKey: item.id || `${item.item_id || 'material'}-${index}`,
      unitPrice,
    };
  });
};

const MobileBatchesPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedFormulaId = searchParams.get('formulaId') || '';
  const [targetGrams, setTargetGrams] = useState(DEFAULT_TARGET_GRAMS);
  const [selectedOnce, setSelectedOnce] = useState(false);
  const [ethanolOnce, setEthanolOnce] = useState(false);
  const [priceDrafts, setPriceDrafts] = useState({});
  const [priceOverrides, setPriceOverrides] = useState(new Map());
  const [savingPriceId, setSavingPriceId] = useState('');
  const {
    bulkComputed,
    bulkInputs,
    formulaProfile,
    formulas,
    loading,
    retailInputs,
    selectedFormula,
    selectedFormulaId,
    selectedSolventId,
    setSelectedFormulaId,
    setSelectedSolventId,
    solventOptions,
    updateRetailInput,
  } = useProductionCostPage();

  useEffect(() => {
    if (!selectedOnce && requestedFormulaId && formulas.some((formula) => formula.id === requestedFormulaId)) {
      setSelectedFormulaId(requestedFormulaId);
      setSelectedOnce(true);
    }
  }, [formulas, requestedFormulaId, selectedOnce, setSelectedFormulaId]);

  useEffect(() => {
    const ethanol = solventOptions.find((material) => /ethanol|etanol/i.test(material.name || ''))
      || solventOptions.find((material) => /alcohol/i.test(material.name || ''));
    if (!ethanolOnce && ethanol && selectedSolventId !== ethanol.id) {
      setSelectedSolventId(ethanol.id);
      setEthanolOnce(true);
    }
  }, [ethanolOnce, selectedSolventId, setSelectedSolventId, solventOptions]);

  const selectedSolvent = solventOptions.find((material) => material.id === selectedSolventId) || null;
  const targetValue = Math.max(parseNumberInput(targetGrams), 0);
  const concentration = clampPercentage(parseNumberInput(retailInputs.formulaPercentage));
  const formulaRatio = concentration / 100;
  const solventPrice = Number(priceOverrides.get(selectedSolventId) ?? selectedSolvent?.cost_per_unit ?? 0);
  const solventPriceDraft = priceDrafts[selectedSolventId] ?? String(solventPrice || '');
  const concentrateRows = useMemo(
    () => buildScaledRows(formulaProfile?.items || [], targetValue, formulaProfile?.totalGrams || 0, priceOverrides, priceDrafts),
    [formulaProfile, priceDrafts, priceOverrides, targetValue]
  );

  const concentrateCost = concentrateRows.reduce((sum, item) => sum + item.cost, 0);
  const concentrateCostPerGram = targetValue > 0 ? concentrateCost / targetValue : 0;
  const dilutionFormulaGrams = targetValue * formulaRatio;
  const dilutionSolventGrams = Math.max(targetValue - dilutionFormulaGrams, 0);
  const dilutionFormulaCost = concentrateCostPerGram * dilutionFormulaGrams;
  const solventCostPerGram = selectedSolvent ? calculateIngredientCost(1, solventPrice) : 0;
  const dilutionSolventCost = solventCostPerGram * dilutionSolventGrams;
  const dilutionTotalCost = dilutionFormulaCost + dilutionSolventCost;
  const dilutionCostPerGram = targetValue > 0 ? dilutionTotalCost / targetValue : 0;
  const bulkLossRatio = Math.max(1 - (clampPercentage(parseNumberInput(bulkInputs.productionLossPercent)) / 100), 0.0001);
  const localBulkMaterialCogsPerGram = ((concentrateCostPerGram * formulaRatio) + (solventCostPerGram * Math.max(1 - formulaRatio, 0))) / bulkLossRatio;
  const localBulkCogsPerLiter = (localBulkMaterialCogsPerGram * 1000)
    + parseNumberInput(bulkInputs.handlingCostPerLiter)
    + parseNumberInput(bulkInputs.bulkOverheadCost);

  const updatePriceDraft = (materialId, value) => {
    if (!materialId) return;
    setPriceDrafts((current) => ({ ...current, [materialId]: value }));
  };

  const saveMaterialPrice = async (materialId, value) => {
    if (!materialId) return;
    const nextPrice = Math.max(parseNumberInput(value), 0);
    setSavingPriceId(materialId);
    try {
      await updateRawMaterial(materialId, { cost_per_unit: nextPrice });
      setPriceOverrides((current) => {
        const next = new Map(current);
        next.set(materialId, nextPrice);
        return next;
      });
      setPriceDrafts((current) => ({ ...current, [materialId]: String(nextPrice || '') }));
      toast.success('Raw material price updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update price');
    } finally {
      setSavingPriceId('');
    }
  };

  const exportFormulaPdf = async () => {
    if (!selectedFormula || !concentrateRows.length) {
      toast.error('Choose a costed formula first');
      return;
    }

    const { exportWorkbookPdf } = await import('@/utils/workbookPdfExport.js');
    exportWorkbookPdf(
      buildFormulaWorkbookExportConfig({
        formula: {
          ...selectedFormula,
          name: `${selectedFormula.name} - ${formatGramAmount(targetValue)} batch`,
        },
        items: concentrateRows.map((item) => ({
          ...item,
          gram_amount: item.batchGram,
          grams: item.batchGram,
          ingredient_cost: item.cost,
          percentage: item.percentage,
          unit_price: item.unitPrice,
        })),
        totalGrams: targetValue,
        totalCost: concentrateCost,
      }),
      `${selectedFormula.code || 'formula'}_${formatQuantity(targetValue, 0)}g_batch.pdf`
    );
    toast.success('Formula PDF exported');
  };

  if (loading) {
    return (
      <MobileAuthenticatedLayout>
        <MobileLoadingState eyebrow="Batch" title="Loading batch calculator..." subtitle="Preparing formulas, solvent, and material pricing." />
      </MobileAuthenticatedLayout>
    );
  }

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>Mobile Batch Calculator - Perfumer Studio</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Batch"
          subtitle="Concentrate and dilution COGS"
          onBack={() => navigate('/mobile/formulas')}
          action={<Calculator className="h-5 w-5 text-amber-700" />}
        />

        {!formulas.length ? (
          <MobileEmptyState icon={FlaskConical} title="No formula available" action="New Formula" onAction={() => navigate('/mobile/formulas/new')} />
        ) : (
          <>
            <section className="mobile-card space-y-3 overflow-hidden p-4">
              <div className="grid gap-3">
                <div className="min-w-0 space-y-2">
                  <Label className="text-xs font-bold text-[#6b7280]">Formula</Label>
                  <Select value={selectedFormulaId} onValueChange={setSelectedFormulaId}>
                    <SelectTrigger className="h-11 min-w-0 overflow-hidden rounded-2xl bg-white text-left text-xs [&>span]:min-w-0 [&>span]:truncate">
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

                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                  <div className="min-w-0 space-y-2">
                    <Label className="text-xs font-bold text-[#6b7280]">Target gram</Label>
                    <Input value={targetGrams} onChange={(event) => setTargetGrams(event.target.value)} inputMode="decimal" type="number" min="0" step="0.01" className="h-11 min-w-0 rounded-2xl bg-white text-xs font-bold" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label className="text-xs font-bold text-[#6b7280]">Dilution %</Label>
                    <Input value={retailInputs.formulaPercentage} onChange={(event) => updateRetailInput('formulaPercentage', event.target.value)} inputMode="decimal" type="number" min="0" max="100" step="0.01" className="h-11 min-w-0 rounded-2xl bg-white text-xs font-bold" />
                  </div>
                </div>

                <div className="min-w-0 space-y-2">
                  <Label className="text-xs font-bold text-[#6b7280]">Solvent</Label>
                  <Select value={selectedSolventId} onValueChange={setSelectedSolventId}>
                    <SelectTrigger className="h-11 min-w-0 overflow-hidden rounded-2xl bg-white text-left text-xs [&>span]:min-w-0 [&>span]:truncate">
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
                <div className="min-w-0 space-y-2">
                  <Label className="text-xs font-bold text-[#6b7280]">Solvent price / 10 ml</Label>
                  <SolventPriceEditor
                    material={selectedSolvent}
                    priceDraft={solventPriceDraft}
                    onDraftChange={updatePriceDraft}
                    onSave={saveMaterialPrice}
                    saving={savingPriceId === selectedSolventId}
                  />
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={exportFormulaPdf} className="h-11 rounded-2xl bg-white text-xs font-bold">
                <Download className="mr-1 h-4 w-4" />
                Formula PDF
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(`/mobile/formulas/${selectedFormulaId}`)} className="h-11 rounded-2xl bg-white text-xs font-bold">
                <FlaskConical className="mr-1 h-4 w-4" />
                Formula
              </Button>
            </div>

            <section className="mobile-soft-card p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
                  <PackageCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase text-amber-700">Full concentrate</div>
                  <h2 className="mt-0.5 truncate text-base font-bold text-[#1f2937]">{selectedFormula?.name || 'Formula'}</h2>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MetricTile label="Batch" value={formatGramAmount(targetValue)} helper={`${concentrateRows.length} materials`} />
                    <MetricTile label="COGS" value={formatPrice(concentrateCost)} helper={`${formatCurrency(concentrateCostPerGram)} / g`} tone="amber" />
                  </div>
                </div>
              </div>
            </section>

            <section className="mobile-card p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">
                  <Droplets className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase text-emerald-700">Dilution</div>
                  <h2 className="mt-0.5 text-base font-bold text-[#1f2937]">{formatPercentage(concentration, 1)} in {selectedSolvent?.name || 'solvent'}</h2>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MetricTile label="Concentrate" value={formatGramAmount(dilutionFormulaGrams)} helper={formatPrice(dilutionFormulaCost)} tone="emerald" />
                    <MetricTile label="Solvent" value={formatGramAmount(dilutionSolventGrams)} helper={formatPrice(dilutionSolventCost)} />
                    <MetricTile label="Total COGS" value={formatPrice(dilutionTotalCost)} helper={`${formatCurrency(dilutionCostPerGram)} / g`} tone="amber" />
                    <MetricTile label="Bulk COGS" value={formatCurrency(localBulkCogsPerLiter || bulkComputed.allInBulkCogsPerLiter)} helper="per liter in website model" />
                  </div>
                </div>
              </div>
            </section>

            <section className="mobile-card overflow-hidden">
              <div className="border-b border-[#ece8df] bg-[#faf9f6] px-4 py-3">
                <h2 className="text-sm font-bold text-[#1f2937]">Raw material breakdown</h2>
                <p className="mt-0.5 text-[11px] font-semibold text-[#6b7280]">Scaled to {formatGramAmount(targetValue)} full concentrate.</p>
              </div>
              <div className="px-4 py-1">
                {concentrateRows.length ? concentrateRows.map((item) => (
                  <CostRow
                    key={item.rowKey}
                    item={item}
                    label={item.name || item.item_name || 'Material'}
                    helper={`${formatQuantity(item.percentage, 2)}% · ${formatGramAmount(item.batchGram)} · ${formatPricePerUnit(item.unitPrice)}`}
                    onDraftChange={updatePriceDraft}
                    onSave={saveMaterialPrice}
                    saving={savingPriceId === item.item_id}
                    value={formatPrice(item.cost)}
                  />
                )) : (
                  <div className="py-4 text-xs font-semibold text-[#6b7280]">Formula has no costable material rows yet.</div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileBatchesPage;
