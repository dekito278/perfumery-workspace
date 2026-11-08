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
import FormulaCostBlindSpotNotice from '@/components/FormulaCostBlindSpotNotice.jsx';

const modeOptions = [
  { value: 'retail', label: 'Botol' },
  { value: 'bulk', label: 'Curah' },
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
      {unit ? <div className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">{unit}</div> : null}
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
      {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#6b7280]">{suffix}</span> : null}
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
    profileError,
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
  const activeExportLabel = activeTab === 'retail' ? 'Ekspor hitung biaya' : 'Ekspor penawaran';
  const activePrintLabel = activeTab === 'retail' ? 'Cetak hitung biaya' : 'Cetak penawaran';
  const activeExport = activeTab === 'retail' ? handleExportPdf : handleExportQuotationPdf;
  const activePrint = activeTab === 'retail' ? handlePrint : handlePrintQuotation;
  const retailRecommendations = [
    {
      label: 'Jual langsung (sehat)',
      helper: 'margin 60%, tanpa biaya kanal',
      price: getTargetMarginPrice(retailComputed.costPerBottle, 60, 0),
      margin: 60,
    },
    {
      label: 'Marketplace',
      helper: `margin 60% + biaya kanal ${formatQuantity(retailFeePercent, 1)}%`,
      price: getTargetMarginPrice(retailComputed.costPerBottle, 60, retailFeePercent),
      margin: 60,
    },
    {
      label: 'Premium',
      helper: 'margin 70%, tanpa biaya kanal',
      price: getTargetMarginPrice(retailComputed.costPerBottle, 70, 0),
      margin: 70,
    },
  ];

  if (loading || (selectedFormulaId && !formulaProfile)) {
    return (
      <MobileAuthenticatedLayout>
        <MobileLoadingState eyebrow="Hitung biaya" title="Memuat hitung biaya produksi..." subtitle="Menyiapkan formula, pelarut, kemasan, dan skenario penawaran." />
      </MobileAuthenticatedLayout>
    );
  }

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>Biaya Produksi Mobile - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Produksi"
          subtitle="Hitung biaya botol dan curah"
          onBack={() => navigate('/mobile/batches')}
          action={<Factory className="h-5 w-5 text-amber-700" />}
        />

        {profileLoading ? (
          <section className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
            Memperbarui profil produksi...
          </section>
        ) : null}

        {!formulas.length ? (
          <MobileEmptyState
            icon={Package2}
            title="Belum ada formula"
            description="Hitung biaya produksi butuh minimal satu formula tersimpan untuk menghitung konsentrat, pelarut, kemasan, dan skenario margin."
            action="Formula baru"
            onAction={() => navigate('/mobile/formulas/new')}
          />
        ) : (
          <>
            <section className="mobile-soft-card p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">Tugas hitung biaya</div>
              <h1 className="mt-1 text-2xl font-bold text-editorial-charcoal">
                {activeTab === 'retail' ? 'Tetapkan harga botol dari HPP aktual.' : 'Susun penawaran curah.'}
              </h1>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">
                Pilih formula dan pelarut, isi parameter produksi, lalu pakai hasilnya untuk keputusan harga yang bisa diekspor.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MoneyTile label={activeTab === 'retail' ? 'HPP / botol' : 'HPP curah / L'} value={activeTab === 'retail' ? formatPrice(retailComputed.costPerBottle) : formatCurrency(bulkComputed.allInBulkCogsPerLiter)} helper={activeTab === 'retail' ? `${retailComputed.bottleCount} botol` : `kekuatan ${formatQuantity(bulkComputed.concentration, 1)}%`} tone="amber" />
                <MoneyTile label={activeTab === 'retail' ? 'Saran jual langsung' : 'Penawaran terbaik'} value={activeTab === 'retail' ? formatPrice(retailRecommendations[0]?.price || retailChampion?.salePrice || 0) : formatPrice(bulkChampion?.sellPrice || 0)} helper={activeTab === 'retail' ? 'margin 60%' : (bulkChampion ? `margin ${formatQuantity(bulkChampion.margin, 1)}%` : 'Belum ada penawaran')} tone="emerald" />
              </div>
            </section>

            <TaskSection
              eyebrow="Langkah 1"
              title="Pilih dasar produksi"
              description="Mulai dari formula dan pelarut agar semua perhitungan punya sumber yang jelas."
            >
              <div className="grid gap-3">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-[#6b7280]">Formula</Label>
                  <Select value={selectedFormulaId} onValueChange={setSelectedFormulaId}>
                    <SelectTrigger className="h-10 min-w-0 overflow-hidden rounded-xl bg-white text-left text-xs [&>span]:min-w-0 [&>span]:truncate">
                      <SelectValue placeholder="Pilih formula" />
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
                  <Label className="text-[10px] font-bold uppercase text-[#6b7280]">Pelarut</Label>
                  <Select value={selectedSolventId} onValueChange={setSelectedSolventId}>
                    <SelectTrigger className="h-10 min-w-0 overflow-hidden rounded-xl bg-white text-left text-xs [&>span]:min-w-0 [&>span]:truncate">
                      <SelectValue placeholder="Pilih pelarut" />
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
                  <span><strong className="text-[#1f2937]">{selectedFormula.name}</strong> siap dihitung sebagai {activeTab === 'retail' ? 'produk botol retail' : 'penawaran curah/brand'}.</span>
                ) : (
                  <span>Pilih formula untuk mulai menghitung.</span>
                )}
              </div>
            </TaskSection>

            {activeTab === 'retail' ? (
              <>
                <TaskSection
                  eyebrow="Langkah 2"
                  title="Isian produksi botol"
                  description="Isi volume batch, ukuran botol, konsentrasi formula, dan susut produksi."
                >
                  <div className="grid grid-cols-2 gap-2">
                    <FieldInput label="Volume batch" value={retailInputs.totalBatchVolume} suffix="ml" onChange={(value) => updateRetailInput('totalBatchVolume', value)} />
                    <FieldInput label="Ukuran botol" value={retailInputs.bottleSize} suffix="ml" onChange={(value) => updateRetailInput('bottleSize', value)} />
                    <FieldInput label="Formula" value={retailInputs.formulaPercentage} suffix="%" onChange={(value) => updateRetailInput('formulaPercentage', value)} />
                    <FieldInput label="Susut" value={retailInputs.productionLossPercent} suffix="%" onChange={(value) => updateRetailInput('productionLossPercent', value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MoneyTile label="Dibutuhkan" value={`${formatQuantity(retailComputed.requiredProductionVolume, 1)} ml`} helper="termasuk susut produksi" />
                    <MoneyTile label="Hasil botol" value={`${retailComputed.bottleCount} botol`} helper={`sisa ${formatQuantity(retailComputed.remainingVolume, 1)} ml`} tone="emerald" />
                    <MoneyTile label="Konsentrat" value={`${formatQuantity(retailComputed.formulaVolumeNeeded, 1)} ml`} helper={formatPrice(retailComputed.formulaMaterialCost)} />
                    <MoneyTile label="Pelarut" value={`${formatQuantity(retailComputed.solventVolumeNeeded, 1)} ml`} helper={formatPrice(retailComputed.solventMaterialCost)} />
                    <MoneyTile label="Kemasan" value={formatPrice(retailComputed.totalPackagingCost + retailComputed.totalBatchOverhead)} helper={`${formatPrice(retailComputed.perBottlePackagingCost)} / botol`} />
                    <MoneyTile label="HPP aktual" value={formatPrice(retailComputed.costPerBottle)} helper="semua biaya per botol" tone="amber" />
                  </div>
                </TaskSection>

                <TaskSection
                  eyebrow="Langkah 3"
                  title="Rincian HPP aktual"
                  description="Periksa komponen biaya sebelum mengambil keputusan harga."
                >
                  <div className="px-4 py-1">
                    <CostLine label="Konsentrat formula" quantity={`${formatQuantity(retailComputed.formulaVolumeNeeded, 1)} ml`} total={retailComputed.formulaMaterialCost} />
                    <CostLine label="Pelarut" quantity={`${formatQuantity(retailComputed.solventVolumeNeeded, 1)} ml`} total={retailComputed.solventMaterialCost} />
                    {retailComputed.packagingLineItems.unitItems.map((item) => (
                      <CostLine
                        key={item.key}
                        label={item.label}
                        quantity={`${item.quantity} botol x ${formatPrice(item.unitCost)}`}
                        total={item.totalCost}
                        unit="/ batch"
                      />
                    ))}
                    {retailComputed.packagingLineItems.batchItems.map((item) => (
                      <CostLine
                        key={item.key}
                        label={item.label}
                        quantity="biaya batch"
                        total={item.totalCost}
                        unit="/ batch"
                      />
                    ))}
                    {!retailComputed.packagingLineItems.unitItems.length && !retailComputed.packagingLineItems.batchItems.length ? (
                      <div className="py-3 text-xs font-semibold text-[#6b7280]">Botol, stiker, box, tenaga kerja, dan overhead belum diisi.</div>
                    ) : null}
                  </div>
                  {/* The desktop page has warned about this since the profile loader was written; this
                      one never did, while reading the SAME hook. When the cost profile fails to load,
                      material cost falls back to Rp 0 — so the COGS and the per-ml figure directly
                      below are too low, and they are exactly the numbers a price gets set from. */}
                  {profileError ? (
                    <div role="alert" className="mx-4 mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold leading-relaxed text-rose-700">
                      Biaya bahan formula gagal dimuat — angka HPP &amp; harga di bawah TIDAK memperhitungkan biaya juice (dihitung Rp 0). Pilih ulang formula sebelum memakai angka ini.
                    </div>
                  ) : null}
                  <FormulaCostBlindSpotNotice readiness={formulaProfile?.readiness} className="mx-4 mb-4" />
                  <div className="grid grid-cols-2 gap-2 border-t border-[#ece8df] bg-[#faf9f6] p-4">
                    <MoneyTile label="Total biaya batch" value={formatPrice(retailComputed.totalProductionCost)} helper={`${retailComputed.bottleCount} botol`} tone="amber" />
                    <MoneyTile label="HPP / botol" value={formatPrice(retailComputed.costPerBottle)} helper={`${formatCurrency(retailComputed.cogsPerMl)} / ml`} tone="emerald" />
                  </div>
                </TaskSection>

                <TaskSection
                  eyebrow="Keputusan"
                  title="Saran harga jual"
                  description="Otomatis dari HPP aktual per botol."
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
                  title="Kemasan dan overhead"
                  description="Isi komponen aktual: botol, cap, sprayer, stiker, box, tenaga kerja, dan overhead."
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
                  eyebrow="Simulasi"
                  title="Skenario retail"
                  description="Atur markup atau margin dan biaya marketplace."
                >
                  <div className="space-y-3 p-4">
                    {retailScenarios.map((scenario) => {
                      const result = retailComputed.scenarioResults.find((item) => item.id === scenario.id);
                      return (
                        <article key={scenario.id} className="rounded-xl border border-[#ece8df] bg-[#f8f7f4] p-3">
                          <div className="grid grid-cols-2 gap-2">
                            <FieldInput label="Persen" value={scenario.percent} suffix="%" onChange={(value) => updateRetailScenario(scenario.id, 'percent', value)} />
                            <FieldInput label="Biaya kanal" value={scenario.feePercent} suffix="%" onChange={(value) => updateRetailScenario(scenario.id, 'feePercent', value)} />
                          </div>
                          <div className="mt-2">
                            <MobileSegmentedControl options={modeTypeOptions} value={scenario.mode} onChange={(value) => updateRetailScenario(scenario.id, 'mode', value)} className="mobile-compact-tabs" />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <MoneyTile label="Harga jual" value={formatPrice(result?.salePrice || 0)} />
                            <MoneyTile label="Laba" value={formatPrice(result?.profitPerBottle || 0)} helper={`margin ${formatQuantity(result?.profitMargin || 0, 1)}%`} tone="emerald" />
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
                  eyebrow="Langkah 2"
                  title="Isian biaya curah"
                  description="Tetapkan susut produksi, penanganan, dan overhead per liter sebelum membuat penawaran."
                >
                  <div className="grid grid-cols-2 gap-2">
                    <FieldInput label="Susut curah" value={bulkInputs.productionLossPercent} suffix="%" onChange={(value) => updateBulkInput('productionLossPercent', value)} />
                    <FieldInput label="Penanganan" value={bulkInputs.handlingCostPerLiter} suffix="/L" onChange={(value) => updateBulkInput('handlingCostPerLiter', value)} />
                    <FieldInput label="Overhead" value={bulkInputs.bulkOverheadCost} suffix="/L" onChange={(value) => updateBulkInput('bulkOverheadCost', value)} />
                    <MoneyTile label="HPP bahan" value={formatCurrency(bulkComputed.materialCogsPerMl * 1000)} helper="per liter" tone="emerald" />
                  </div>
                </TaskSection>

                <TaskSection
                  eyebrow="Langkah 3"
                  title="Skenario penawaran"
                  description="Buat beberapa volume penawaran untuk membandingkan margin dan total harga."
                  action={<Button type="button" size="icon" onClick={addBulkScenario} className="h-10 w-10 shrink-0 rounded-xl bg-amber-500 text-white" aria-label="Tambah penawaran curah"><Plus className="h-4 w-4" /></Button>}
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
                              placeholder="Nama penawaran"
                              className="h-10 min-w-0 rounded-xl bg-white text-xs font-bold"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              onClick={() => removeBulkScenario(scenario.id)}
                              disabled={bulkScenarios.length <= 1}
                              className="h-10 w-10 shrink-0 rounded-xl bg-white text-rose-600"
                              aria-label="Hapus penawaran curah"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_88px] gap-2">
                            <FieldInput label="Volume" value={scenario.volumeValue} onChange={(value) => updateBulkScenario(scenario.id, 'volumeValue', value)} />
                            <div className="min-w-0 space-y-1.5">
                              <Label className="text-[10px] font-bold uppercase text-[#6b7280]">Satuan</Label>
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
                            <FieldInput label="Persen" value={scenario.percent} suffix="%" onChange={(value) => updateBulkScenario(scenario.id, 'percent', value)} />
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
                            <MoneyTile label="Total HPP" value={formatPrice(result?.totalCogs || 0)} helper={`${formatQuantity(result?.volumeMl || 0, 0)} ml`} />
                            <MoneyTile label="Harga penawaran" value={formatPrice(result?.sellPrice || 0)} helper={`margin ${formatQuantity(result?.margin || 0, 1)}%`} tone="emerald" />
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </TaskSection>
              </>
            )}
            <StickyBottomActionBar fixed reserveSpace aria-label="Aksi hitung biaya produksi">
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

