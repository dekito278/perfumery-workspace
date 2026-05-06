import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Download, Factory, Package2, Plus, Printer, Trash2 } from 'lucide-react';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { useProductionCostPage } from '@/hooks/useProductionCostPage.js';
import { PACKAGING_FIELDS } from '@/utils/productionCosting.js';
import { formatCurrency, formatQuantity } from '@/utils/formatting.js';
import { formatPrice } from '@/utils/pricingUtils.js';

const modeOptions = [
  { value: 'retail', label: 'Bottle' },
  { value: 'bulk', label: 'Bulk' },
];

const unitOptions = [
  { value: 'ml', label: 'ml' },
  { value: 'liter', label: 'L' },
  { value: 'gram', label: 'g' },
  { value: 'kg', label: 'kg' },
];

const modeTypeOptions = [
  { value: 'markup', label: 'Markup' },
  { value: 'margin', label: 'Margin' },
];

const MoneyTile = ({ helper, label, value, tone = 'neutral' }) => {
  const toneClass = tone === 'amber'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-[#ece8df] bg-[#f8f7f4] text-[#1f2937]';

  return (
    <div className={`min-w-0 rounded-xl border p-3 ${toneClass}`}>
      <div className="truncate text-[10px] font-bold uppercase opacity-70">{label}</div>
      <div className="mt-1 truncate text-sm font-bold">{value}</div>
      {helper ? <div className="mt-0.5 truncate text-[10px] font-semibold opacity-75">{helper}</div> : null}
    </div>
  );
};

const FieldInput = ({ label, onChange, suffix, value }) => (
  <div className="min-w-0 space-y-1.5">
    <Label className="text-[10px] font-bold uppercase text-[#6b7280]">{label}</Label>
    <div className="relative">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        type="number"
        min="0"
        step="0.01"
        className="h-10 min-w-0 rounded-xl bg-white pr-10 text-xs font-bold"
      />
      {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#9ca3af]">{suffix}</span> : null}
    </div>
  </div>
);

const MobileProductionCostingPage = () => {
  const navigate = useNavigate();
  const {
    activeTab,
    addBulkScenario,
    bulkChampion,
    bulkComputed,
    bulkInputs,
    bulkScenarios,
    formulaProfile,
    formulas,
    handleExportPdf,
    handleExportQuotationPdf,
    handlePrint,
    handlePrintQuotation,
    loading,
    profileLoading,
    retailChampion,
    retailComputed,
    retailInputs,
    retailScenarios,
    selectedFormula,
    selectedFormulaId,
    selectedSolventId,
    setActiveTab,
    setSelectedFormulaId,
    setSelectedSolventId,
    solventOptions,
    updateBulkInput,
    updateBulkScenario,
    updateRetailInput,
    updateRetailScenario,
    removeBulkScenario,
  } = useProductionCostPage();

  if (loading || profileLoading || (selectedFormulaId && !formulaProfile)) {
    return (
      <MobileAuthenticatedLayout>
        <MobileLoadingState eyebrow="Costing" title="Loading production costing..." subtitle="Preparing formula, solvent, packaging, and quote scenarios." />
      </MobileAuthenticatedLayout>
    );
  }

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>Mobile Production Costing - Perfumer Studio</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Production"
          subtitle="Bottle and bulk costing"
          onBack={() => navigate('/mobile/batches')}
          action={<Factory className="h-5 w-5 text-amber-700" />}
        />

        {!formulas.length ? (
          <MobileEmptyState icon={Package2} title="No formula available" action="New Formula" onAction={() => navigate('/mobile/formulas/new')} />
        ) : (
          <>
            <section className="mobile-soft-card space-y-3 p-4">
              <div className="grid grid-cols-2 gap-2">
                <MoneyTile label="Retail COGS" value={formatPrice(retailComputed.costPerBottle)} helper={`${retailComputed.bottleCount} bottles`} tone="amber" />
                <MoneyTile label="Bulk / L" value={formatCurrency(bulkComputed.allInBulkCogsPerLiter)} helper={`${formatQuantity(bulkComputed.concentration, 1)}% strength`} tone="emerald" />
                <MoneyTile label="Best retail" value={formatPrice(retailChampion?.salePrice || 0)} helper={retailChampion ? `${formatQuantity(retailChampion.profitMargin, 1)}% margin` : 'No scenario'} />
                <MoneyTile label="Best bulk" value={formatPrice(bulkChampion?.sellPrice || 0)} helper={bulkChampion ? `${formatQuantity(bulkChampion.margin, 1)}% margin` : 'No quote'} />
              </div>
            </section>

            <section className="mobile-card space-y-3 p-4">
              <div className="grid gap-3">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-[#6b7280]">Formula</Label>
                  <Select value={selectedFormulaId} onValueChange={setSelectedFormulaId}>
                    <SelectTrigger className="h-10 min-w-0 overflow-hidden rounded-xl bg-white text-left text-xs [&>span]:min-w-0 [&>span]:truncate">
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
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-[#6b7280]">Solvent</Label>
                  <Select value={selectedSolventId} onValueChange={setSelectedSolventId}>
                    <SelectTrigger className="h-10 min-w-0 overflow-hidden rounded-xl bg-white text-left text-xs [&>span]:min-w-0 [&>span]:truncate">
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
              <MobileSegmentedControl options={modeOptions} value={activeTab} onChange={setActiveTab} className="mobile-compact-tabs" />
            </section>

            {activeTab === 'retail' ? (
              <>
                <section className="mobile-card space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-[#1f2937]">Bottle costing</h2>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-[#6b7280]">{selectedFormula?.name || 'Formula'}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button type="button" size="icon" variant="outline" onClick={handlePrint} className="h-10 w-10 rounded-xl bg-white" aria-label="Print production costing"><Printer className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" onClick={handleExportPdf} className="h-10 w-10 rounded-xl bg-amber-500 text-white" aria-label="Export production costing PDF"><Download className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldInput label="Batch volume" value={retailInputs.totalBatchVolume} suffix="ml" onChange={(value) => updateRetailInput('totalBatchVolume', value)} />
                    <FieldInput label="Bottle size" value={retailInputs.bottleSize} suffix="ml" onChange={(value) => updateRetailInput('bottleSize', value)} />
                    <FieldInput label="Formula" value={retailInputs.formulaPercentage} suffix="%" onChange={(value) => updateRetailInput('formulaPercentage', value)} />
                    <FieldInput label="Loss" value={retailInputs.productionLossPercent} suffix="%" onChange={(value) => updateRetailInput('productionLossPercent', value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MoneyTile label="Required" value={`${formatQuantity(retailComputed.requiredProductionVolume, 1)} ml`} helper="with production loss" />
                    <MoneyTile label="Concentrate" value={`${formatQuantity(retailComputed.formulaVolumeNeeded, 1)} ml`} helper={formatPrice(retailComputed.formulaMaterialCost)} />
                    <MoneyTile label="Solvent" value={`${formatQuantity(retailComputed.solventVolumeNeeded, 1)} ml`} helper={formatPrice(retailComputed.solventMaterialCost)} />
                    <MoneyTile label="Packaging" value={formatPrice(retailComputed.totalPackagingCost + retailComputed.totalBatchOverhead)} helper={`${formatPrice(retailComputed.perBottlePackagingCost)} / bottle`} />
                  </div>
                </section>

                <section className="mobile-card overflow-hidden">
                  <div className="border-b border-[#ece8df] bg-[#faf9f6] px-4 py-3">
                    <h2 className="text-sm font-bold text-[#1f2937]">Packaging and overhead</h2>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#6b7280]">Per bottle and per batch cost inputs from website costing.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-4">
                    {PACKAGING_FIELDS.map((field) => (
                      <FieldInput
                        key={field.key}
                        label={field.label}
                        value={retailInputs[field.key]}
                        suffix={field.kind === 'unit' ? '/btl' : '/batch'}
                        onChange={(value) => updateRetailInput(field.key, value)}
                      />
                    ))}
                  </div>
                </section>

                <section className="mobile-card overflow-hidden">
                  <div className="border-b border-[#ece8df] bg-[#faf9f6] px-4 py-3">
                    <h2 className="text-sm font-bold text-[#1f2937]">Retail scenario</h2>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#6b7280]">Set markup or margin and marketplace fee.</p>
                  </div>
                  <div className="space-y-3 p-4">
                    {retailScenarios.map((scenario) => {
                      const result = retailComputed.scenarioResults.find((item) => item.id === scenario.id);
                      return (
                        <article key={scenario.id} className="rounded-xl border border-[#ece8df] bg-[#f8f7f4] p-3">
                          <div className="grid grid-cols-2 gap-2">
                            <FieldInput label="Percent" value={scenario.percent} suffix="%" onChange={(value) => updateRetailScenario(scenario.id, 'percent', value)} />
                            <FieldInput label="Channel fee" value={scenario.feePercent} suffix="%" onChange={(value) => updateRetailScenario(scenario.id, 'feePercent', value)} />
                          </div>
                          <div className="mt-2">
                            <MobileSegmentedControl options={modeTypeOptions} value={scenario.mode} onChange={(value) => updateRetailScenario(scenario.id, 'mode', value)} className="mobile-compact-tabs" />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <MoneyTile label="Sell price" value={formatPrice(result?.salePrice || 0)} />
                            <MoneyTile label="Profit" value={formatPrice(result?.profitPerBottle || 0)} helper={`${formatQuantity(result?.profitMargin || 0, 1)}% margin`} tone="emerald" />
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="mobile-card space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-[#1f2937]">Bulk / brand costing</h2>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-[#6b7280]">{selectedFormula?.name || 'Formula'}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button type="button" size="icon" variant="outline" onClick={handlePrintQuotation} className="h-10 w-10 rounded-xl bg-white" aria-label="Print brand quotation"><Printer className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" onClick={handleExportQuotationPdf} className="h-10 w-10 rounded-xl bg-amber-500 text-white" aria-label="Export quotation PDF"><Download className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldInput label="Bulk loss" value={bulkInputs.productionLossPercent} suffix="%" onChange={(value) => updateBulkInput('productionLossPercent', value)} />
                    <FieldInput label="Handling" value={bulkInputs.handlingCostPerLiter} suffix="/L" onChange={(value) => updateBulkInput('handlingCostPerLiter', value)} />
                    <FieldInput label="Overhead" value={bulkInputs.bulkOverheadCost} suffix="/L" onChange={(value) => updateBulkInput('bulkOverheadCost', value)} />
                    <MoneyTile label="Material COGS" value={formatCurrency(bulkComputed.materialCogsPerMl * 1000)} helper="per liter" tone="emerald" />
                  </div>
                </section>

                <section className="mobile-card overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-[#ece8df] bg-[#faf9f6] px-4 py-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-[#1f2937]">Quote scenarios</h2>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-[#6b7280]">Volume-based brand pricing.</p>
                    </div>
                    <Button type="button" size="icon" onClick={addBulkScenario} className="h-10 w-10 shrink-0 rounded-xl bg-amber-500 text-white" aria-label="Add bulk quote"><Plus className="h-4 w-4" /></Button>
                  </div>
                  <div className="space-y-3 p-4">
                    {bulkScenarios.map((scenario) => {
                      const result = bulkComputed.rows.find((row) => row.id === scenario.id);
                      return (
                        <article key={scenario.id} className="rounded-xl border border-[#ece8df] bg-[#f8f7f4] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <Input
                              value={scenario.label}
                              onChange={(event) => updateBulkScenario(scenario.id, 'label', event.target.value)}
                              placeholder="Quote label"
                              className="h-10 min-w-0 rounded-xl bg-white text-xs font-bold"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              onClick={() => removeBulkScenario(scenario.id)}
                              disabled={bulkScenarios.length <= 1}
                              className="h-10 w-10 shrink-0 rounded-xl bg-white text-rose-600"
                              aria-label="Remove bulk quote"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_88px] gap-2">
                            <FieldInput label="Volume" value={scenario.volumeValue} onChange={(value) => updateBulkScenario(scenario.id, 'volumeValue', value)} />
                            <div className="min-w-0 space-y-1.5">
                              <Label className="text-[10px] font-bold uppercase text-[#6b7280]">Unit</Label>
                              <Select value={scenario.volumeUnit} onValueChange={(value) => updateBulkScenario(scenario.id, 'volumeUnit', value)}>
                                <SelectTrigger className="h-10 min-w-0 rounded-xl bg-white text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {unitOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <FieldInput label="Percent" value={scenario.percent} suffix="%" onChange={(value) => updateBulkScenario(scenario.id, 'percent', value)} />
                            <div className="min-w-0 space-y-1.5">
                              <Label className="text-[10px] font-bold uppercase text-[#6b7280]">Mode</Label>
                              <Select value={scenario.mode} onValueChange={(value) => updateBulkScenario(scenario.id, 'mode', value)}>
                                <SelectTrigger className="h-10 min-w-0 rounded-xl bg-white text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {modeTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <MoneyTile label="Total COGS" value={formatPrice(result?.totalCogs || 0)} helper={`${formatQuantity(result?.volumeMl || 0, 0)} ml`} />
                            <MoneyTile label="Quote price" value={formatPrice(result?.sellPrice || 0)} helper={`${formatQuantity(result?.margin || 0, 1)}% margin`} tone="emerald" />
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileProductionCostingPage;
