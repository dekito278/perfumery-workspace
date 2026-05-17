import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Download, Factory, Package2, Plus, Printer, Trash2 } from 'lucide-react';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { useProductionCostPage } from '@/hooks/useProductionCostPage.js';
import { PACKAGING_FIELDS } from '@/utils/productionCosting.js';
import { formatCurrency, formatQuantity } from '@/utils/formatting.js';
import { formatPrice } from '@/utils/pricingUtils.js';
import { normalizeLocalizedDecimalInput } from '@/utils/numberInputs.js';

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

const roundUpToNearest = (value, step = 1000) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.ceil(numeric / step) * step;
};

const getTargetMarginPrice = (cogs, marginPercent, feePercent = 0) => {
  const marginRatio = Math.min(Math.max(Number(marginPercent || 0) / 100, 0), 0.95);
  const feeRatio = Math.min(Math.max(Number(feePercent || 0) / 100, 0), 0.95);
  const denominator = Math.max((1 - feeRatio) * (1 - marginRatio), 0.0001);
  return roundUpToNearest(Number(cogs || 0) / denominator, 1000);
};

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

const CostLine = ({ label, quantity, total, unit }) => (
  <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-[#f0ede7] py-2 last:border-b-0">
    <div className="min-w-0">
      <div className="truncate text-xs font-bold text-[#1f2937]">{label}</div>
      <div className="mt-0.5 truncate text-[10px] font-semibold text-[#6b7280]">{quantity}</div>
    </div>
    <div className="shrink-0 text-right">
      <div className="text-xs font-bold text-[#1f2937]">{formatPrice(total)}</div>
      {unit ? <div className="mt-0.5 text-[10px] font-semibold text-[#9ca3af]">{unit}</div> : null}
    </div>
  </div>
);

const TaskSection = ({ action, children, eyebrow, title, description }) => (
  <section className="mobile-card overflow-hidden">
    <div className="flex items-start justify-between gap-3 border-b border-[#ece8df] bg-[#faf9f6] px-4 py-3">
      <div className="min-w-0">
        {eyebrow ? <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">{eyebrow}</div> : null}
        <h2 className="mt-0.5 text-sm font-bold text-[#1f2937]">{title}</h2>
        {description ? <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-[#6b7280]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
    <div className="p-4">
      {children}
    </div>
  </section>
);

const FieldInput = ({ label, onChange, suffix, value }) => (
  <div className="min-w-0 space-y-1.5">
    <Label className="text-[10px] font-bold uppercase text-[#6b7280]">{label}</Label>
    <div className="relative">
      <Input
        value={value}
        onChange={(event) => onChange(normalizeLocalizedDecimalInput(event.target.value, { autoDecimalAfterLeadingZero: true }))}
        inputMode="decimal"
        type="text"
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

  const retailFeePercent = Number(retailScenarios[0]?.feePercent || 0);
  const activeExportLabel = activeTab === 'retail' ? 'Export costing' : 'Export quote';
  const activePrintLabel = activeTab === 'retail' ? 'Print costing' : 'Print quote';
  const activeExport = activeTab === 'retail' ? handleExportPdf : handleExportQuotationPdf;
  const activePrint = activeTab === 'retail' ? handlePrint : handlePrintQuotation;
  const retailRecommendations = [
    {
      label: 'Healthy direct',
      helper: '60% margin, no fee',
      price: getTargetMarginPrice(retailComputed.costPerBottle, 60, 0),
      margin: 60,
    },
    {
      label: 'Marketplace',
      helper: `60% margin + ${formatQuantity(retailFeePercent, 1)}% fee`,
      price: getTargetMarginPrice(retailComputed.costPerBottle, 60, retailFeePercent),
      margin: 60,
    },
    {
      label: 'Premium',
      helper: '70% margin, no fee',
      price: getTargetMarginPrice(retailComputed.costPerBottle, 70, 0),
      margin: 70,
    },
  ];

  if (loading || (selectedFormulaId && !formulaProfile)) {
    return (
      <MobileAuthenticatedLayout>
        <MobileLoadingState eyebrow="Costing" title="Loading production costing..." subtitle="Preparing formula, solvent, packaging, and quote scenarios." />
      </MobileAuthenticatedLayout>
    );
  }

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>Mobile Production Costing - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Production"
          subtitle="Bottle and bulk costing"
          onBack={() => navigate('/mobile/batches')}
          action={<Factory className="h-5 w-5 text-amber-700" />}
        />

        {profileLoading ? (
          <section className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
            Updating production profile...
          </section>
        ) : null}

        {!formulas.length ? (
          <MobileEmptyState
            icon={Package2}
            title="No formula available"
            description="Production costing needs at least one saved formula so it can calculate concentrate, solvent, packaging, and margin scenarios."
            action="New Formula"
            onAction={() => navigate('/mobile/formulas/new')}
          />
        ) : (
          <>
            <section className="mobile-soft-card p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">Costing task</div>
              <h1 className="mt-1 text-2xl font-bold text-[#0b130c]">
                {activeTab === 'retail' ? 'Set bottle price from actual COGS.' : 'Build a bulk quotation.'}
              </h1>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">
                Pilih formula dan solvent, isi parameter produksi, lalu gunakan hasilnya untuk keputusan harga yang bisa diexport.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MoneyTile label={activeTab === 'retail' ? 'COGS / bottle' : 'Bulk COGS / L'} value={activeTab === 'retail' ? formatPrice(retailComputed.costPerBottle) : formatCurrency(bulkComputed.allInBulkCogsPerLiter)} helper={activeTab === 'retail' ? `${retailComputed.bottleCount} bottles` : `${formatQuantity(bulkComputed.concentration, 1)}% strength`} tone="amber" />
                <MoneyTile label={activeTab === 'retail' ? 'Suggested direct' : 'Best quote'} value={activeTab === 'retail' ? formatPrice(retailRecommendations[0]?.price || retailChampion?.salePrice || 0) : formatPrice(bulkChampion?.sellPrice || 0)} helper={activeTab === 'retail' ? '60% margin' : (bulkChampion ? `${formatQuantity(bulkChampion.margin, 1)}% margin` : 'No quote')} tone="emerald" />
              </div>
            </section>

            <TaskSection
              eyebrow="Step 1"
              title="Choose production context"
              description="Mulai dari formula dan solvent agar semua perhitungan punya sumber yang jelas."
            >
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
              <div className="mt-4">
                <MobileSegmentedControl options={modeOptions} value={activeTab} onChange={setActiveTab} className="mobile-compact-tabs" />
              </div>
              <div className="mt-4 rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] px-3 py-2 text-xs font-semibold text-[#6b7280]">
                {selectedFormula?.name ? (
                  <span><strong className="text-[#1f2937]">{selectedFormula.name}</strong> siap dihitung sebagai {activeTab === 'retail' ? 'produk botol retail' : 'bulk/brand quote'}.</span>
                ) : (
                  <span>Pilih formula untuk mulai menghitung.</span>
                )}
              </div>
            </TaskSection>

            {activeTab === 'retail' ? (
              <>
                <TaskSection
                  eyebrow="Step 2"
                  title="Bottle production inputs"
                  description="Isi volume batch, ukuran botol, konsentrasi formula, dan loss produksi."
                >
                  <div className="grid grid-cols-2 gap-2">
                    <FieldInput label="Batch volume" value={retailInputs.totalBatchVolume} suffix="ml" onChange={(value) => updateRetailInput('totalBatchVolume', value)} />
                    <FieldInput label="Bottle size" value={retailInputs.bottleSize} suffix="ml" onChange={(value) => updateRetailInput('bottleSize', value)} />
                    <FieldInput label="Formula" value={retailInputs.formulaPercentage} suffix="%" onChange={(value) => updateRetailInput('formulaPercentage', value)} />
                    <FieldInput label="Loss" value={retailInputs.productionLossPercent} suffix="%" onChange={(value) => updateRetailInput('productionLossPercent', value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MoneyTile label="Required" value={`${formatQuantity(retailComputed.requiredProductionVolume, 1)} ml`} helper="with production loss" />
                    <MoneyTile label="Bottle output" value={`${retailComputed.bottleCount} bottles`} helper={`${formatQuantity(retailComputed.remainingVolume, 1)} ml remainder`} tone="emerald" />
                    <MoneyTile label="Concentrate" value={`${formatQuantity(retailComputed.formulaVolumeNeeded, 1)} ml`} helper={formatPrice(retailComputed.formulaMaterialCost)} />
                    <MoneyTile label="Solvent" value={`${formatQuantity(retailComputed.solventVolumeNeeded, 1)} ml`} helper={formatPrice(retailComputed.solventMaterialCost)} />
                    <MoneyTile label="Packaging" value={formatPrice(retailComputed.totalPackagingCost + retailComputed.totalBatchOverhead)} helper={`${formatPrice(retailComputed.perBottlePackagingCost)} / bottle`} />
                    <MoneyTile label="Actual COGS" value={formatPrice(retailComputed.costPerBottle)} helper="all-in per bottle" tone="amber" />
                  </div>
                </TaskSection>

                <TaskSection
                  eyebrow="Step 3"
                  title="Actual COGS breakdown"
                  description="Periksa komponen biaya sebelum mengambil keputusan harga."
                >
                  <div className="px-4 py-1">
                    <CostLine label="Formula concentrate" quantity={`${formatQuantity(retailComputed.formulaVolumeNeeded, 1)} ml`} total={retailComputed.formulaMaterialCost} />
                    <CostLine label="Solvent" quantity={`${formatQuantity(retailComputed.solventVolumeNeeded, 1)} ml`} total={retailComputed.solventMaterialCost} />
                    {retailComputed.packagingLineItems.unitItems.map((item) => (
                      <CostLine
                        key={item.key}
                        label={item.label}
                        quantity={`${item.quantity} bottles x ${formatPrice(item.unitCost)}`}
                        total={item.totalCost}
                        unit="/ batch"
                      />
                    ))}
                    {retailComputed.packagingLineItems.batchItems.map((item) => (
                      <CostLine
                        key={item.key}
                        label={item.label}
                        quantity="batch cost"
                        total={item.totalCost}
                        unit="/ batch"
                      />
                    ))}
                    {!retailComputed.packagingLineItems.unitItems.length && !retailComputed.packagingLineItems.batchItems.length ? (
                      <div className="py-3 text-xs font-semibold text-[#6b7280]">Bottle, sticker, box, labor, dan overhead belum diisi.</div>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-[#ece8df] bg-[#faf9f6] p-4">
                    <MoneyTile label="Total batch cost" value={formatPrice(retailComputed.totalProductionCost)} helper={`${retailComputed.bottleCount} bottles`} tone="amber" />
                    <MoneyTile label="COGS / bottle" value={formatPrice(retailComputed.costPerBottle)} helper={`${formatCurrency(retailComputed.cogsPerMl)} / ml`} tone="emerald" />
                  </div>
                </TaskSection>

                <TaskSection
                  eyebrow="Decision"
                  title="Recommended selling price"
                  description="Otomatis dari actual COGS per bottle."
                >
                  <div className="grid gap-2 p-4">
                    {retailRecommendations.map((recommendation) => (
                      <div key={recommendation.label} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-[#ece8df] bg-[#f8f7f4] px-3 py-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#1f2937]">{recommendation.label}</div>
                          <div className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">{recommendation.helper}</div>
                        </div>
                        <div className="text-right text-sm font-bold text-emerald-800">{formatPrice(recommendation.price)}</div>
                      </div>
                    ))}
                  </div>
                </TaskSection>

                <TaskSection
                  eyebrow="Detail"
                  title="Packaging and overhead"
                  description="Isi komponen aktual: botol, cap, sprayer, stiker, box, labor, dan overhead."
                >
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
                </TaskSection>

                <TaskSection
                  eyebrow="What-if"
                  title="Retail scenario"
                  description="Set markup or margin and marketplace fee."
                >
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
                </TaskSection>
              </>
            ) : (
              <>
                <TaskSection
                  eyebrow="Step 2"
                  title="Bulk costing inputs"
                  description="Tetapkan loss produksi, handling, dan overhead per liter sebelum membuat quote."
                >
                  <div className="grid grid-cols-2 gap-2">
                    <FieldInput label="Bulk loss" value={bulkInputs.productionLossPercent} suffix="%" onChange={(value) => updateBulkInput('productionLossPercent', value)} />
                    <FieldInput label="Handling" value={bulkInputs.handlingCostPerLiter} suffix="/L" onChange={(value) => updateBulkInput('handlingCostPerLiter', value)} />
                    <FieldInput label="Overhead" value={bulkInputs.bulkOverheadCost} suffix="/L" onChange={(value) => updateBulkInput('bulkOverheadCost', value)} />
                    <MoneyTile label="Material COGS" value={formatCurrency(bulkComputed.materialCogsPerMl * 1000)} helper="per liter" tone="emerald" />
                  </div>
                </TaskSection>

                <TaskSection
                  eyebrow="Step 3"
                  title="Quote scenarios"
                  description="Buat beberapa volume quote untuk membandingkan margin dan total price."
                  action={<Button type="button" size="icon" onClick={addBulkScenario} className="h-10 w-10 shrink-0 rounded-xl bg-amber-500 text-white" aria-label="Add bulk quote"><Plus className="h-4 w-4" /></Button>}
                >
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
                </TaskSection>
              </>
            )}
            <StickyBottomActionBar fixed reserveSpace aria-label="Production costing actions">
              <div className="grid grid-cols-[auto_1fr] gap-2">
                <Button type="button" variant="outline" onClick={activePrint} className="h-12 rounded-2xl bg-white px-4 text-xs font-bold">
                  <Printer className="mr-2 h-4 w-4" />
                  {activePrintLabel}
                </Button>
                <Button type="button" onClick={activeExport} className="h-12 rounded-2xl gap-2 text-xs font-bold">
                  <Download className="h-4 w-4" />
                  {activeExportLabel}
                </Button>
              </div>
            </StickyBottomActionBar>
          </>
        )}
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileProductionCostingPage;

