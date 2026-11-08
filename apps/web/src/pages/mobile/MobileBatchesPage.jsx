import React, { useEffect, useMemo, useState } from 'react';
import { shopToday } from '@/utils/localDay.js';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Calculator, ClipboardCheck, Download, Droplets, Factory, FlaskConical, History, PackageCheck, Save, ScrollText, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { autoTierPriceMessage } from '@/utils/autoTierPrices.js';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import PaginationOrLoadMore from '@/components/mobile-ui/PaginationOrLoadMore.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { useProductionCostPage } from '@/hooks/useProductionCostPage.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import {
  getProductBatchKey,
  PRODUCT_BATCH_CODE_TAG_PREFIX,
  PRODUCT_BATCH_ID_TAG_PREFIX,
  PRODUCT_BATCH_BOTTLE_TAG_PREFIX,
  PRODUCT_BATCH_COGS_TAG_PREFIX,
  PRODUCT_BATCH_DILUTION_TAG_PREFIX,
  PRODUCT_BATCH_LOSS_TAG_PREFIX,
  PRODUCT_BATCH_MOVEMENT_TAG_PREFIX,
  PRODUCT_BATCH_PUBLISHED_AT_TAG_PREFIX,
  PRODUCT_BATCH_SKU_TAG_PREFIX,
  PRODUCT_BATCH_STOCK_TAG_PREFIX,
  PRODUCT_BATCH_TAG_PREFIX,
  PRODUCT_BATCH_TARGET_TAG_PREFIX,
  PRODUCT_BATCH_USABLE_TAG_PREFIX,
  PRODUCT_DRAFT_TAG,
  PRODUCT_FORMULA_TAG_PREFIX,
  saveCustomProduct,
} from '@/services/productCatalogService.js';
import { deductBatchMaterialStock, getBatches, getBatchUsageRecords, saveBatch } from '@/services/batchesService.js';
import { updateFormulaStatus } from '@/services/formulasSupabaseService.js';
import { updateRawMaterial } from '@/services/rawMaterialsService.js';
import { formatCurrency, formatGramAmount, formatPercentage, formatQuantity } from '@/utils/formatting.js';
import { calculateIngredientCost, formatPrice, formatPricePerUnit } from '@/utils/pricingUtils.js';
import { buildFormulaWorkbookExportConfig } from '@/utils/formulaWorkbookExport.js';
import { clampPercentage, parseNumberInput, suggestedBottlePrice } from '@/utils/productionCosting.js';
import { normalizeLocalizedDecimalInput } from '@/utils/numberInputs.js';
import { BATCH_STATUSES } from '@/utils/constants.js';
import FormulaCostBlindSpotNotice from '@/components/FormulaCostBlindSpotNotice.jsx';

const DEFAULT_TARGET_GRAMS = '100';
const BATCH_ROW_PAGE_SIZE = 8;
const targetPresets = ['30', '100', '500', '1000'];
// Display labels only. The values are what the batches table stores and what every check on this page
// compares.
const BATCH_STATUS_LABELS = Object.fromEntries(BATCH_STATUSES.map(({ value, label }) => [value, label]));
const workflowStatuses = BATCH_STATUSES
  .filter((status) => ['planned', 'produced', 'qc', 'ready_for_product', 'converted_to_product'].includes(status.value));

const STOCK_DEDUCTING_STATUSES = new Set(['produced', 'qc', 'ready_for_product', 'converted_to_product']);
const batchSteps = [
  { value: 'setup', label: 'Siapkan' },
  { value: 'produce', label: 'Produksi' },
  { value: 'qc', label: 'QC' },
  { value: 'stock', label: 'Stok' },
  { value: 'review', label: 'Tinjau' },
];
const QC_STATUS_OPTIONS = [
  { value: 'pending', label: 'Menunggu' },
  { value: 'passed', label: 'Lulus' },
  { value: 'needs_adjustment', label: 'Perlu penyesuaian' },
  { value: 'failed', label: 'Gagal' },
];
const qcStatusLabel = (value) => QC_STATUS_OPTIONS.find((option) => option.value === value)?.label;
const buildBatchProductKey = ({ bottleMl, concentration, formulaId, lossPercent = 0, targetMl }) => [
  formulaId || 'formula',
  `${formatQuantity(targetMl, 2)}ml`,
  `${formatQuantity(bottleMl, 2)}ml`,
  `${formatQuantity(concentration, 2)}pct`,
  `${formatQuantity(lossPercent, 2)}loss`,
].join(':').replace(/\s+/g, '');

const buildProductSku = ({ bottleMl, concentration, formula, targetMl }) => {
  const formulaCode = String(formula?.code || formula?.name || 'formula')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18) || 'FORMULA';
  return `SLV-${formulaCode}-${formatQuantity(targetMl, 0)}ML-${formatQuantity(bottleMl, 0)}ML-${formatQuantity(concentration, 0)}P`;
};

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
        onChange={(event) => onDraftChange(item.item_id, normalizeLocalizedDecimalInput(event.target.value))}
        inputMode="decimal"
        type="text"
        min="0"
        step="0.01"
        className="h-9 rounded-xl bg-[#f8f7f4] px-2 text-xs font-bold"
        aria-label={`Harga ${label} per 10 ml`}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onSave(item.item_id, item.priceDraft)}
        disabled={saving}
        className="h-9 rounded-xl bg-white"
        aria-label={`Simpan harga ${label}`}
      >
        <Save className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

const UsageLedgerRow = ({ record }) => (
  <div className="rounded-xl border border-[#ece8df] bg-[#fdfcf9] p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-xs font-bold text-[#1f2937]">
          {record.raw_material_name || record.raw_material_id || 'Bahan'}
        </div>
        <div className="mt-0.5 text-[10px] font-bold uppercase text-[#8b949e]">
          {record.type === 'batch_solvent' ? 'Pelarut' : 'Bahan formula'} / {record.movement || record.source || 'Pemakaian batch'}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs font-bold text-[#1f2937]">{formatQuantity(record.quantity_deducted, 2)} {record.unit || ''}</div>
        <div className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">{formatPrice(record.cost)}</div>
      </div>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-semibold text-[#6b7280]">
      <span>Sebelum {formatQuantity(record.stock_before, 2)}</span>
      <span className="text-right">Sesudah {formatQuantity(record.stock_after, 2)}</span>
    </div>
  </div>
);

const BatchStepHero = ({ activeStep, batchStatus, savedBatch, selectedFormula }) => {
  const copy = {
    setup: {
      eyebrow: 'Persiapan batch',
      title: selectedFormula ? `Siapkan ${selectedFormula.name}` : 'Pilih formula yang mau dibuat batch',
      description: 'Atur formula, ukuran batch, pengenceran, pelarut, dan hitung biaya cepat sebelum produksi.',
    },
    produce: {
      eyebrow: 'Catatan produksi',
      title: savedBatch ? 'Perbarui batch yang tersimpan' : 'Simpan sebagai batch produksi',
      description: 'Kunci data batch, status, dan pemicu pemotongan stok bahan dalam satu langkah.',
    },
    qc: {
      eyebrow: 'Gerbang QC',
      title: 'Loloskan atau tandai perlu penyesuaian',
      description: 'Catat keputusan kualitas batch sebelum membuat stok produk.',
    },
    stock: {
      eyebrow: 'Stok produk',
      title: 'Jadikan batch yang lolos stok produk',
      description: 'Periksa hasil, jumlah botol, HPP, dan harga sebelum membuat draf produk yang tertaut.',
    },
    review: {
      eyebrow: 'Tinjau',
      title: 'Cek riwayat dan rincian bahan',
      description: 'Langkah terakhir untuk ekspor, membuka formula, validasi, dan rincian biaya per bahan.',
    },
  }[activeStep];

  return (
    <section className="mobile-soft-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
          <Factory className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">{copy.eyebrow}</div>
          <h2 className="mt-0.5 text-lg font-bold leading-tight text-editorial-charcoal">{copy.title}</h2>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">{copy.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MobileStatusBadge status={batchStatus} className="h-6 px-2.5 text-[10px]">{BATCH_STATUS_LABELS[batchStatus]}</MobileStatusBadge>
            <span className="rounded-full border border-[#ece8df] bg-white px-2.5 py-1 text-[10px] font-bold text-[#6b7280]">
              {savedBatch?.batch_code || 'Batch belum disimpan'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

const SolventPriceEditor = ({ material, priceDraft, onDraftChange, onSave, saving }) => (
  <div className="grid grid-cols-[1fr_44px] gap-2">
    <Input
    value={priceDraft}
      onChange={(event) => onDraftChange(material?.id || '', normalizeLocalizedDecimalInput(event.target.value))}
      inputMode="decimal"
      type="text"
      min="0"
      step="0.01"
      className="h-10 rounded-xl bg-white text-xs font-bold"
      aria-label="Harga pelarut per 10 ml"
      disabled={!material}
    />
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => onSave(material?.id, priceDraft)}
      disabled={!material || saving}
      className="h-10 rounded-xl bg-white"
      aria-label="Simpan harga pelarut"
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
  const { id: requestedBatchFormulaId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const requestedFormulaId = requestedBatchFormulaId || searchParams.get('formulaId') || '';
  const [targetGrams, setTargetGrams] = useState(DEFAULT_TARGET_GRAMS);
  const [selectedOnce, setSelectedOnce] = useState(false);
  const [ethanolOnce, setEthanolOnce] = useState(false);
  const [priceDrafts, setPriceDrafts] = useState({});
  const [priceOverrides, setPriceOverrides] = useState(new Map());
  const [visibleRows, setVisibleRows] = useState(BATCH_ROW_PAGE_SIZE);
  const [savingPriceId, setSavingPriceId] = useState('');
  const [bottleSizeMl, setBottleSizeMl] = useState('30');
  const [productLossPercent, setProductLossPercent] = useState('0');
  const [productPrice, setProductPrice] = useState('');
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [publishingProduct, setPublishingProduct] = useState(false);
  const [batchStatus, setBatchStatus] = useState('planned');
  const [batchStep, setBatchStep] = useState('setup');
  const [savingBatch, setSavingBatch] = useState(false);
  const [savedBatch, setSavedBatch] = useState(null);
  const [batchHistory, setBatchHistory] = useState([]);
  const [usageRecords, setUsageRecords] = useState([]);
  const [qcStatus, setQcStatus] = useState('pending');
  const [qcNotes, setQcNotes] = useState('');
  const catalogProducts = useCatalogProducts({ editableOnly: true });
  const {
    bulkComputed,
    bulkInputs,
    formulaProfile,
    profileError,
    formulas,
    loading,
    profileLoading,
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

  useEffect(() => {
    setVisibleRows(BATCH_ROW_PAGE_SIZE);
  }, [selectedFormulaId, targetGrams]);

  useEffect(() => {
    // Both halves of this were fixed on the desktop page in audit round 8 and never carried over here.
    // Switching formulas quickly could let the earlier request resolve last, leaving savedBatch pointing
    // at another formula's batch — which the save path then updates by id, and which the stock deduction
    // acts on by id too.
    let cancelled = false;
    const loadBatchHistory = async () => {
      if (!selectedFormulaId) {
        setBatchHistory([]);
        setSavedBatch(null);
        setUsageRecords([]);
        setQcStatus('pending');
        setQcNotes('');
        return;
      }

      const rows = await getBatches({ formulaId: selectedFormulaId });
      if (cancelled) return;
      setBatchHistory(rows);
      const latest = rows[0] || null;
      setSavedBatch(latest);
      setUsageRecords([]);
      setQcStatus(latest?.qc_status || 'pending');
      setQcNotes(latest?.qc_notes || '');
      setBatchStatus(latest?.status || 'planned');
      // Saving updates THIS batch by id, so the form has to show its parameters. Keeping the page
      // defaults meant that simply opening a formula armed a save that would rewrite the last batch's
      // volume, ratio, bottle size, loss and price with values nobody typed.
      if (latest) {
        if (latest.target_quantity) setTargetGrams(String(latest.target_quantity));
        if (latest.bottle_ml) setBottleSizeMl(String(latest.bottle_ml));
        if (latest.loss_percent !== null && latest.loss_percent !== undefined) setProductLossPercent(String(latest.loss_percent));
        if (latest.solvent_id) setSelectedSolventId(latest.solvent_id);
        if (latest.selling_price) setProductPrice(String(latest.selling_price));
        if (latest.formula_percentage) updateRetailInput('formulaPercentage', String(latest.formula_percentage));
      }
    };

    loadBatchHistory().catch((error) => {
      if (cancelled) return;
      // Without this the whole effect rejected unhandled and every setter above was skipped, so the
      // previously selected formula's batch stayed on screen — and armed — under the new formula.
      console.error('Failed to load batch history:', error);
      setBatchHistory([]);
      setSavedBatch(null);
      setUsageRecords([]);
      toast.error('Riwayat batch gagal dimuat. Pilih ulang formulanya sebelum menyimpan.');
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFormulaId]);

  useEffect(() => {
    let cancelled = false;

    const loadUsageRecords = async () => {
      if (!savedBatch?.id || String(savedBatch.id).startsWith('local-batch-')) {
        setUsageRecords([]);
        return;
      }

      try {
        const rows = await getBatchUsageRecords(savedBatch.id);
        if (!cancelled) {
          setUsageRecords(rows);
        }
      } catch {
        if (!cancelled) {
          setUsageRecords([]);
        }
      }
    };

    loadUsageRecords();

    return () => {
      cancelled = true;
    };
  }, [savedBatch?.id]);

  useEffect(() => {
    if (!savedBatch?.id) return;
    setQcStatus(savedBatch.qc_status || 'pending');
    setQcNotes(savedBatch.qc_notes || '');
  }, [savedBatch?.id, savedBatch?.qc_notes, savedBatch?.qc_status]);

  const selectedSolvent = solventOptions.find((material) => material.id === selectedSolventId) || null;
  const targetValue = Math.max(parseNumberInput(targetGrams), 0);
  const concentration = clampPercentage(parseNumberInput(retailInputs.formulaPercentage));
  const formulaRatio = concentration / 100;
  const solventPrice = Number(priceOverrides.get(selectedSolventId) ?? selectedSolvent?.cost_per_unit ?? 0);
  const solventPriceDraft = priceDrafts[selectedSolventId] ?? String(solventPrice || '');
  // Scale the weighing rows to the CONCENTRATE, not the finished batch — see BatchProductionPage for the
  // full reasoning. These same rows are exported as the bench PDF, so the printed sheet was 1/ratio too
  // large on every line (audit round 8).
  const concentrateBaseGrams = targetValue * formulaRatio;
  const concentrateRows = useMemo(
    () => buildScaledRows(formulaProfile?.items || [], concentrateBaseGrams, formulaProfile?.totalGrams || 0, priceOverrides, priceDrafts),
    [formulaProfile, priceDrafts, priceOverrides, concentrateBaseGrams]
  );

  const concentrateCost = concentrateRows.reduce((sum, item) => sum + item.cost, 0);
  const pricedRows = concentrateRows.filter((item) => Number(item.unitPrice || 0) > 0).length;
  const visibleConcentrateRows = concentrateRows.slice(0, visibleRows);
  const concentrateCostPerGram = concentrateBaseGrams > 0 ? concentrateCost / concentrateBaseGrams : 0;
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
  const bottleSizeValue = Math.max(parseNumberInput(bottleSizeMl), 0);
  const productLossValue = clampPercentage(parseNumberInput(productLossPercent));
  const usableBatchVolume = targetValue * Math.max(1 - (productLossValue / 100), 0);
  const productBottleCount = bottleSizeValue > 0 ? Math.floor(usableBatchVolume / bottleSizeValue) : 0;
  const remainingBatchVolume = bottleSizeValue > 0 ? Math.max(usableBatchVolume - (productBottleCount * bottleSizeValue), 0) : 0;
  const productCogsPerBottle = productBottleCount > 0 ? dilutionTotalCost / productBottleCount : 0;
  const productPriceValue = parseNumberInput(productPrice);
  const productPriceSuggestion = suggestedBottlePrice(productCogsPerBottle);
  const productPriceNumber = productPriceValue > 0 ? productPriceValue : productPriceSuggestion;
  const productMarginPerBottle = productPriceNumber - productCogsPerBottle;
  const productMarginPercent = productPriceNumber > 0 ? (productMarginPerBottle / productPriceNumber) * 100 : 0;
  const productSku = selectedFormula ? buildProductSku({
    bottleMl: bottleSizeValue,
    concentration,
    formula: selectedFormula,
    targetMl: targetValue,
  }) : '';
  const batchProductKey = selectedFormula ? buildBatchProductKey({
    bottleMl: bottleSizeValue,
    concentration,
    formulaId: selectedFormula.id,
    lossPercent: productLossValue,
    targetMl: targetValue,
  }) : '';
  // Match the batch, not a hash of the current form inputs: tweaking loss/target/bottle size changed the
  // hash, so the guard stopped seeing the product this batch had already published and minted a second
  // one with a full bottle count (audit round 7). The parameter hash stays as a fallback for batches
  // published before product_id was stored on the batch row.
  const publishedProduct = (savedBatch?.product_id
    ? catalogProducts.find((product) => product.id === savedBatch.product_id)
    : null)
    || (batchProductKey
      ? catalogProducts.find((product) => getProductBatchKey(product) === batchProductKey)
      : null);

  const buildBatchPayload = (status = batchStatus, overrides = {}) => ({
    ...(savedBatch || {}),
    ...overrides,
    formula: selectedFormula,
    formula_id: selectedFormula?.id,
    solvent_id: selectedSolventId || null,
    target_quantity: targetValue,
    produced_quantity: targetValue,
    production_date: shopToday(),
    unit: 'ml',
    formula_percentage: concentration,
    solvent_percentage: Math.max(100 - concentration, 0),
    formula_quantity_needed: dilutionFormulaGrams,
    solvent_quantity_needed: dilutionSolventGrams,
    bottle_ml: bottleSizeValue,
    loss_percent: productLossValue,
    usable_quantity: usableBatchVolume,
    bottle_count: productBottleCount,
    cogs_per_bottle: Math.round(productCogsPerBottle),
    selling_price: productPriceNumber,
    sku: productSku,
    status,
    qc_status: qcStatus,
    qc_notes: qcNotes.trim(),
    qc_checked_at: qcStatus === 'pending' ? null : (savedBatch?.qc_checked_at || new Date().toISOString()),
    qc_reviewer: selectedFormula?.author_name || '',
    notes: `Formula ${selectedFormula?.name || ''} converted through owner batch flow.`,
  });

  const refreshBatchHistory = async () => {
    if (!selectedFormulaId) return;
    const rows = await getBatches({ formulaId: selectedFormulaId });
    setBatchHistory(rows);
  };

  const saveProductionBatch = async (nextStatus = batchStatus, overrides = {}) => {
    if (!selectedFormula || targetValue <= 0 || concentration <= 0) {
      toast.error('Isi dulu: formula, ukuran batch, dan pengenceran');
      return null;
    }

    if (!selectedSolventId) {
      toast.error('Pilih pelarut sebelum menyimpan batch');
      return null;
    }

    setSavingBatch(true);
    try {
      let batch = await saveBatch(buildBatchPayload(nextStatus, overrides));
      let usageRecords = [];

      if (STOCK_DEDUCTING_STATUSES.has(nextStatus) && !batch.is_stock_deducted) {
        usageRecords = await deductBatchMaterialStock(batch.id);
        batch = { ...batch, is_stock_deducted: true, usage_records: usageRecords };
        setUsageRecords(usageRecords);
      }

      setSavedBatch(batch);
      setBatchStatus(batch.status || nextStatus);
      await refreshBatchHistory();

      if (selectedFormula.status === 'draft' || selectedFormula.status === 'approved') {
        await updateFormulaStatus(selectedFormula.id, 'ready_for_batch');
      }

      toast.success(usageRecords.length ? 'Batch disimpan dan stok bahan dipotong' : 'Batch disimpan');
      return batch;
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan batch');
      return null;
    } finally {
      setSavingBatch(false);
    }
  };

  const ensureBatchRecord = async (nextStatus = batchStatus) => {
    if (savedBatch?.id && savedBatch.status === nextStatus) {
      if (STOCK_DEDUCTING_STATUSES.has(nextStatus) && !savedBatch.is_stock_deducted) {
        const usageRecords = await deductBatchMaterialStock(savedBatch.id);
        const nextBatch = { ...savedBatch, is_stock_deducted: true, usage_records: usageRecords };
        setSavedBatch(nextBatch);
        setUsageRecords(usageRecords);
        await refreshBatchHistory();
        return nextBatch;
      }

      return savedBatch;
    }

    return saveProductionBatch(nextStatus);
  };

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
      toast.success('Harga bahan baku diperbarui');
    } catch (error) {
      toast.error(error.message || 'Gagal memperbarui harga');
    } finally {
      setSavingPriceId('');
    }
  };

  const openPublishConfirmation = () => {
    if (!selectedFormula || productBottleCount <= 0) {
      toast.error('Isi dulu: formula, ukuran batch, dan ukuran botol');
      return;
    }

    if (productPriceNumber <= 0) {
      toast.error('Isi harga jual sebelum membuat draf stok produk');
      return;
    }

    if (qcStatus !== 'passed') {
      toast.error('QC harus lulus sebelum membuat draf stok produk');
      return;
    }

    if (publishedProduct) {
      toast.info('Batch ini sudah pernah dijadikan produk. Buka produknya untuk mengubah stok, foto, dan deskripsi.');
      navigate(`/mobile/studio/products/${encodeURIComponent(publishedProduct.id)}/edit`);
      return;
    }

    setPublishConfirmOpen(true);
  };

  const publishBatchAsProduct = async () => {
    if (!selectedFormula || productBottleCount <= 0) {
      toast.error('Isi dulu: formula, ukuran batch, dan ukuran botol');
      return;
    }

    if (productPriceNumber <= 0) {
      toast.error('Isi harga jual sebelum membuat draf stok produk');
      return;
    }

    if (qcStatus !== 'passed') {
      toast.error('QC harus lulus sebelum membuat draf stok produk');
      return;
    }

    if (publishedProduct) {
      toast.info('Batch ini sudah pernah dijadikan produk. Buka produknya untuk mengubah stok, foto, dan deskripsi.');
      navigate(`/mobile/studio/products/${encodeURIComponent(publishedProduct.id)}/edit`);
      return;
    }

    const priceNumber = productPriceNumber;
    setPublishingProduct(true);
    try {
      const batch = await ensureBatchRecord('ready_for_product');
      if (!batch) {
        return;
      }

      const materialNames = concentrateRows
        .map((item) => item.name || item.item_name)
        .filter(Boolean);
      const publishedAt = new Date().toISOString();
      const product = await saveCustomProduct({
        name: selectedFormula.name,
        category: selectedFormula.category || 'Studio Batch',
        priceNumber,
        size: `${formatQuantity(bottleSizeValue, 0)} ml`,
        notes: selectedFormula.notes || materialNames.slice(0, 5).join(', ') || 'Studio batch perfume',
        topNotes: materialNames.slice(0, 3),
        heartNotes: materialNames.slice(3, 6),
        baseNotes: materialNames.slice(6, 9),
        description: `Published from ${selectedFormula.name} batch. ${formatQuantity(targetValue, 0)} ml produced with ${formatQuantity(productLossValue, 1)}% loss into ${productBottleCount} bottles.`,
        concentration: `${formatPercentage(concentration, 1)} perfume`,
        stock: productBottleCount,
        variants: [{
          id: `${formatQuantity(bottleSizeValue, 0)}-ml`,
          size: `${formatQuantity(bottleSizeValue, 0)} ml`,
          priceNumber,
          stock: productBottleCount,
        }],
        tags: [
          PRODUCT_DRAFT_TAG,
          'Studio batch',
          `${PRODUCT_BATCH_TAG_PREFIX} ${batchProductKey}`,
          `${PRODUCT_BATCH_ID_TAG_PREFIX} ${batch.id}`,
          `${PRODUCT_BATCH_CODE_TAG_PREFIX} ${batch.batch_code}`,
          `${PRODUCT_FORMULA_TAG_PREFIX} ${selectedFormula.id}`,
          `${PRODUCT_BATCH_TARGET_TAG_PREFIX} ${targetValue}`,
          `${PRODUCT_BATCH_BOTTLE_TAG_PREFIX} ${bottleSizeValue}`,
          `${PRODUCT_BATCH_DILUTION_TAG_PREFIX} ${concentration}`,
          `${PRODUCT_BATCH_LOSS_TAG_PREFIX} ${productLossValue}`,
          `${PRODUCT_BATCH_USABLE_TAG_PREFIX} ${usableBatchVolume}`,
          `${PRODUCT_BATCH_COGS_TAG_PREFIX} ${Math.round(productCogsPerBottle)}`,
          `${PRODUCT_BATCH_STOCK_TAG_PREFIX} ${productBottleCount}`,
          `${PRODUCT_BATCH_SKU_TAG_PREFIX} ${productSku}`,
          `${PRODUCT_BATCH_MOVEMENT_TAG_PREFIX} Batch converted to inventory`,
          `${PRODUCT_BATCH_PUBLISHED_AT_TAG_PREFIX} ${publishedAt}`,
          selectedFormula.category || 'Perfume',
        ],
        featured: false,
      });
      await saveBatch(buildBatchPayload('converted_to_product', {
        id: batch.id,
        batch_code: batch.batch_code,
        product_id: product.id,
      }));
      await updateFormulaStatus(selectedFormula.id, 'published_product');
      toast.success(`${productBottleCount} botol dibuat sebagai draf produk`);
      // Same as the desktop batch screen and both product forms: an automatic price that failed to
      // write is said out loud, not left for someone to notice in the catalogue.
      const tierMessage = autoTierPriceMessage(product.autoTierPrices);
      if (tierMessage) toast[tierMessage.level](tierMessage.text);
      setPublishConfirmOpen(false);
      navigate('/mobile/studio/products');
    } catch (error) {
      toast.error(error.message || 'Gagal membuat draf produk');
    } finally {
      setPublishingProduct(false);
    }
  };

  const exportFormulaPdf = async () => {
    if (!selectedFormula || !concentrateRows.length) {
      toast.error('Pilih formula yang biayanya sudah terhitung');
      return;
    }

    try {
      const { exportWorkbookPdf } = await import('@/utils/workbookPdfExport.js');
      exportWorkbookPdf(
        buildFormulaWorkbookExportConfig({
          formula: {
            ...selectedFormula,
            name: `${selectedFormula.name} - konsentrat ${formatGramAmount(concentrateBaseGrams)} untuk batch ${formatGramAmount(targetValue)}`,
          },
          items: concentrateRows.map((item) => ({
            ...item,
            gram_amount: item.batchGram,
            grams: item.batchGram,
            ingredient_cost: item.cost,
            percentage: item.percentage,
            unit_price: item.unitPrice,
          })),
          totalGrams: concentrateBaseGrams,
          totalCost: concentrateCost,
        }),
        `${selectedFormula.code || 'formula'}_${formatQuantity(targetValue, 0)}g_batch.pdf`
      );
      toast.success('PDF formula diekspor');
    } catch (error) {
      toast.error(error.message || 'Gagal mengekspor PDF formula');
    }
  };

  const goToNextStep = () => {
    const currentIndex = batchSteps.findIndex((step) => step.value === batchStep);
    const nextStep = batchSteps[Math.min(currentIndex + 1, batchSteps.length - 1)]?.value || 'review';
    setBatchStep(nextStep);
  };

  const goToPreviousStep = () => {
    const currentIndex = batchSteps.findIndex((step) => step.value === batchStep);
    const previousStep = batchSteps[Math.max(currentIndex - 1, 0)]?.value || 'setup';
    setBatchStep(previousStep);
  };

  const handleBatchPrimaryAction = async () => {
    if (batchStep === 'setup') {
      if (!selectedFormula || targetValue <= 0 || concentration <= 0 || !selectedSolventId) {
        toast.error('Isi dulu: formula, target, pengenceran, dan pelarut');
        return;
      }
      goToNextStep();
      return;
    }

    if (batchStep === 'produce') {
      const batch = await saveProductionBatch(batchStatus);
      if (batch) setBatchStep('qc');
      return;
    }

    if (batchStep === 'qc') {
      const batch = await saveProductionBatch(qcStatus === 'passed' ? 'ready_for_product' : 'qc');
      if (batch) setBatchStep(qcStatus === 'passed' ? 'stock' : 'review');
      return;
    }

    if (batchStep === 'stock') {
      if (publishedProduct) {
        navigate(`/mobile/studio/products/${encodeURIComponent(publishedProduct.id)}/edit`);
        return;
      }
      openPublishConfirmation();
      return;
    }

    exportFormulaPdf();
  };

  const primaryActionLabel = {
    setup: 'Lanjut ke produksi',
    produce: savingBatch ? 'Menyimpan batch...' : savedBatch ? 'Perbarui batch' : 'Simpan batch',
    qc: savingBatch ? 'Menyimpan QC...' : 'Simpan hasil QC',
    stock: publishedProduct ? 'Ubah produk tertaut' : publishingProduct ? 'Membuat draf...' : 'Buat draf stok produk',
    review: 'Ekspor PDF formula',
  }[batchStep];

  if (loading || (selectedFormulaId && !formulaProfile)) {
    return (
      <MobileAuthenticatedLayout>
        <MobileLoadingState eyebrow="Batch" title="Memuat kalkulator batch..." subtitle="Menyiapkan formula, pelarut, dan harga bahan." />
      </MobileAuthenticatedLayout>
    );
  }

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>Kalkulator Batch Mobile - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Batch"
          subtitle="HPP konsentrat dan pengenceran"
          onBack={() => navigate('/mobile/formulas')}
          action={<Calculator className="h-5 w-5 text-amber-700" />}
        />

        {profileLoading ? (
          <section className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
            Memperbarui profil batch...
          </section>
        ) : null}

        {!formulas.length ? (
          <MobileEmptyState
            icon={FlaskConical}
            title="Belum ada formula"
            description="Buat atau impor formula dulu. Setelah itu kalkulator batch ini membuka pengaturan konsentrat, pengenceran, QC, dan stok produk."
            action="Formula baru"
            onAction={() => navigate('/mobile/formulas/new')}
          />
        ) : (
          <>
            <BatchStepHero activeStep={batchStep} batchStatus={batchStatus} savedBatch={savedBatch} selectedFormula={selectedFormula} />
            <MobileSegmentedControl options={batchSteps} value={batchStep} onChange={setBatchStep} className="mobile-compact-tabs" />

            {batchStep === 'setup' ? <section className="mobile-card space-y-3 overflow-hidden p-4">
              <div className="grid gap-3">
                <div className="min-w-0 space-y-2">
                  <Label className="text-xs font-bold text-[#6b7280]">Formula</Label>
                  <Select value={selectedFormulaId} onValueChange={setSelectedFormulaId}>
                    <SelectTrigger className="h-11 min-w-0 overflow-hidden rounded-2xl bg-white text-left text-xs [&>span]:min-w-0 [&>span]:truncate">
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

                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                  <div className="min-w-0 space-y-2">
                    <Label className="text-xs font-bold text-[#6b7280]">Target gram</Label>
                    <Input value={targetGrams} onChange={(event) => setTargetGrams(normalizeLocalizedDecimalInput(event.target.value, { autoDecimalAfterLeadingZero: true }))} inputMode="decimal" type="text" className="h-11 min-w-0 rounded-2xl bg-white text-xs font-bold" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label className="text-xs font-bold text-[#6b7280]">Pengenceran %</Label>
                    <Input value={retailInputs.formulaPercentage} onChange={(event) => updateRetailInput('formulaPercentage', normalizeLocalizedDecimalInput(event.target.value, { autoDecimalAfterLeadingZero: true }))} inputMode="decimal" type="text" className="h-11 min-w-0 rounded-2xl bg-white text-xs font-bold" />
                  </div>
                </div>

                <div className="min-w-0 space-y-2">
                  <Label className="text-xs font-bold text-[#6b7280]">Pelarut</Label>
                  <Select value={selectedSolventId} onValueChange={setSelectedSolventId}>
                    <SelectTrigger className="h-11 min-w-0 overflow-hidden rounded-2xl bg-white text-left text-xs [&>span]:min-w-0 [&>span]:truncate">
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
                <div className="min-w-0 space-y-2">
                  <Label className="text-xs font-bold text-[#6b7280]">Harga pelarut / 10 ml</Label>
                  <SolventPriceEditor
                    material={selectedSolvent}
                    priceDraft={solventPriceDraft}
                    onDraftChange={updatePriceDraft}
                    onSave={saveMaterialPrice}
                    saving={savingPriceId === selectedSolventId}
                  />
                </div>
              </div>
            </section> : null}

            {batchStep === 'produce' ? <section className="mobile-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-amber-700">Alur produksi pemilik</div>
                  <h2 className="mt-1 text-base font-bold text-[#1f2937]">Simpan sebagai batch produksi</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                    Formula yang sudah oke disimpan sebagai batch dulu, baru batch yang siap diubah jadi draf stok produk.
                  </p>
                </div>
                <MobileStatusBadge status={batchStatus} className="shrink-0">{BATCH_STATUS_LABELS[batchStatus]}</MobileStatusBadge>
              </div>
              <div className="mt-3">
                <MobileSegmentedControl options={workflowStatuses} value={batchStatus} onChange={setBatchStatus} className="mobile-compact-tabs" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MetricTile label="Kode batch" value={savedBatch?.batch_code || 'Belum disimpan'} helper={savedBatch ? 'catatan produksi' : 'dibuat saat disimpan'} />
                <MetricTile label="Riwayat" value={`${batchHistory.length} batch`} helper="untuk formula ini" tone={batchHistory.length ? 'emerald' : 'neutral'} />
                <MetricTile
                  label="Stok"
                  value={savedBatch?.is_stock_deducted ? 'Dipotong' : 'Menunggu'}
                  helper={STOCK_DEDUCTING_STATUSES.has(batchStatus) ? 'catatan pemakaian' : 'setelah diproduksi'}
                  tone={savedBatch?.is_stock_deducted ? 'emerald' : 'neutral'}
                />
              </div>
            </section> : null}

            {batchStep === 'qc' ? <section className="mobile-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-amber-700">Gerbang QC</div>
                  <h2 className="mt-1 text-base font-bold text-[#1f2937]">Loloskan sebelum jadi stok produk</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                    Draf stok produk baru bisa dibuat setelah QC lulus.
                  </p>
                </div>
                <MobileStatusBadge
                  status={qcStatus === 'passed' ? 'approved' : qcStatus}
                  tone={qcStatus === 'passed' ? 'approved' : qcStatus === 'failed' ? 'danger' : qcStatus === 'needs_adjustment' ? 'warning' : 'planned'}
                  className="shrink-0"
                >
                  {qcStatusLabel(qcStatus)}
                </MobileStatusBadge>
              </div>
              <div className="mt-3 grid gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Status QC</Label>
                  <select
                    value={qcStatus}
                    onChange={(event) => setQcStatus(event.target.value)}
                    className="h-11 w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 text-xs font-bold outline-none focus:border-amber-300"
                  >
                    {QC_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Catatan QC</Label>
                  <textarea
                    value={qcNotes}
                    onChange={(event) => setQcNotes(event.target.value)}
                    rows={3}
                    placeholder="Maserasi, kejernihan, keseimbangan aroma, catatan penyesuaian..."
                    className="w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 text-xs font-semibold outline-none focus:border-amber-300"
                  />
                </div>
              </div>
            </section> : null}

            {batchStep === 'qc' || batchStep === 'review' ? <section className="mobile-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-amber-700">Catatan pemakaian bahan</div>
                  <h2 className="mt-1 text-base font-bold text-[#1f2937]">Pergerakan stok untuk batch ini</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                    Baris yang sudah dipotong dikunci oleh catatan batch, jadi stok bahan hanya terpotong sekali.
                  </p>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-editorial-ivory text-editorial-charcoal">
                  <ScrollText className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MetricTile label="Baris" value={`${usageRecords.length}`} helper="catatan pemakaian" tone={usageRecords.length ? 'emerald' : 'neutral'} />
                <MetricTile
                  label="Biaya pemakaian"
                  value={formatPrice(usageRecords.reduce((sum, record) => sum + Number(record.cost || 0), 0))}
                  helper="bahan saja"
                  tone={usageRecords.length ? 'amber' : 'neutral'}
                />
              </div>
              <div className="mt-3 grid gap-2">
                {usageRecords.length ? usageRecords.map((record) => (
                  <UsageLedgerRow key={record.id || `${record.raw_material_id}-${record.type}`} record={record} />
                )) : (
                  <div className="rounded-2xl border border-dashed border-[#e5e7eb] bg-white px-3 py-4 text-center">
                    <div className="text-xs font-bold text-[#1f2937]">Belum ada stok bahan yang dipotong</div>
                    <p className="mt-1 text-[11px] font-semibold text-[#6b7280]">Pindahkan batch ke Diproduksi, QC, atau Siap produk untuk menulis catatan pemakaian.</p>
                  </div>
                )}
              </div>
            </section> : null}

            {batchStep === 'review' ? <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={exportFormulaPdf} className="h-11 rounded-2xl bg-white text-xs font-bold">
                <Download className="mr-1 h-4 w-4" />
                PDF formula
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(`/mobile/formulas/${selectedFormulaId}`)} className="h-11 rounded-2xl bg-white text-xs font-bold">
                <FlaskConical className="mr-1 h-4 w-4" />
                Formula
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/mobile/production-costing')} className="h-11 rounded-2xl bg-white text-xs font-bold">
                <Factory className="mr-1 h-4 w-4" />
                Hitung biaya
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(`/mobile/validation?formulaId=${selectedFormulaId}`)} className="h-11 rounded-2xl bg-white text-xs font-bold">
                <ClipboardCheck className="mr-1 h-4 w-4" />
                Validasi
              </Button>
            </div> : null}

            {batchStep === 'setup' ? <section className="mobile-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-[#1f2937]">Ukuran batch cepat</h2>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-[#6b7280]">Ketuk ukuran uji coba atau produksi yang biasa dipakai.</p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">{pricedRows}/{concentrateRows.length} berharga</span>
              </div>
              <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {targetPresets.map((preset) => {
                  const active = String(targetValue) === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTargetGrams(preset)}
                      className={`h-10 min-w-[72px] rounded-xl border px-3 text-xs font-bold ${active ? 'border-amber-300 bg-amber-100 text-amber-800' : 'border-[#ece8df] bg-white text-[#1f2937]'}`}
                    >
                      {preset}g
                    </button>
                  );
                })}
              </div>
            </section> : null}

            {batchStep === 'setup' || batchStep === 'review' ? <section className="mobile-soft-card p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
                  <PackageCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase text-amber-700">Konsentrat penuh</div>
                  <h2 className="mt-0.5 truncate text-base font-bold text-[#1f2937]">{selectedFormula?.name || 'Formula'}</h2>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {/* The weight this card's COGS is actually about. It used to show targetValue — the
                        FINISHED batch — beside the cost of the concentrate alone, so at 20% dilution the
                        tile said 100 g over Rp 174.627 while the per-gram beside it said Rp 8.731. Divide
                        the two and you get Rp 1.746: the same card disagreeing with itself by 1/ratio.
                        The batch it belongs to is named in the helper, where it cannot be mistaken for
                        the quantity being priced. */}
                    <MetricTile
                      label="Timbang"
                      value={formatGramAmount(concentrateBaseGrams)}
                      helper={`${concentrateRows.length} bahan · batch ${formatGramAmount(targetValue)}`}
                    />
                    <MetricTile label="HPP" value={formatPrice(concentrateCost)} helper={`${formatCurrency(concentrateCostPerGram)} / g`} tone="amber" />
                  </div>
                  {profileError ? (
                    <div role="alert" className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs font-semibold leading-relaxed text-rose-700">
                      Biaya bahan formula gagal dimuat — HPP &amp; harga saran di bawah TIDAK memperhitungkan biaya juice (dihitung Rp 0), dan angka itu ikut TERSIMPAN ke catatan batch. Pilih ulang formula sebelum menyimpan.
                    </div>
                  ) : null}
                                    <FormulaCostBlindSpotNotice readiness={formulaProfile?.readiness} className="mt-3" />

                </div>
              </div>
            </section> : null}

            {batchStep === 'setup' || batchStep === 'review' ? <section className="mobile-card p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">
                  <Droplets className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase text-emerald-700">Pengenceran</div>
                  <h2 className="mt-0.5 text-base font-bold text-[#1f2937]">{formatPercentage(concentration, 1)} dalam {selectedSolvent?.name || 'pelarut'}</h2>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MetricTile label="Konsentrat" value={formatGramAmount(dilutionFormulaGrams)} helper={formatPrice(dilutionFormulaCost)} tone="emerald" />
                    <MetricTile label="Pelarut" value={formatGramAmount(dilutionSolventGrams)} helper={formatPrice(dilutionSolventCost)} />
                    <MetricTile label="Total HPP" value={formatPrice(dilutionTotalCost)} helper={`${formatCurrency(dilutionCostPerGram)} / g`} tone="amber" />
                    <MetricTile label="HPP curah" value={formatCurrency(localBulkCogsPerLiter || bulkComputed.allInBulkCogsPerLiter)} helper="per liter, model website" />
                  </div>
                </div>
              </div>
            </section> : null}

            {batchStep === 'stock' ? <section className="mobile-card p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
                  <ShoppingBag className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase text-amber-700">Jadikan produk</div>
                  <h2 className="mt-0.5 text-base font-bold text-[#1f2937]">{publishedProduct ? 'Batch ini sudah punya stok produk' : 'Jadikan batch ini stok'}</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                    {publishedProduct
                      ? `${publishedProduct.name} tertaut ke formula, ukuran batch, ukuran botol, pengenceran, dan susut ini.`
                      : `${formatQuantity(usableBatchVolume, 0)} ml terpakai / botol ${formatQuantity(bottleSizeValue || 0, 0)} ml = ${productBottleCount} botol${remainingBatchVolume > 0 ? `, sisa ${formatQuantity(remainingBatchVolume, 1)} ml` : ''}.`}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="min-w-0 space-y-2">
                      <Label className="text-xs font-bold text-[#6b7280]">Botol ml</Label>
                      <Input value={bottleSizeMl} onChange={(event) => setBottleSizeMl(normalizeLocalizedDecimalInput(event.target.value, { autoDecimalAfterLeadingZero: true }))} inputMode="decimal" type="text" className="h-11 rounded-2xl bg-white text-xs font-bold" />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label className="text-xs font-bold text-[#6b7280]">Susut %</Label>
                      <Input value={productLossPercent} onChange={(event) => setProductLossPercent(normalizeLocalizedDecimalInput(event.target.value, { autoDecimalAfterLeadingZero: true }))} inputMode="decimal" type="text" className="h-11 rounded-2xl bg-white text-xs font-bold" />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <div className="min-w-0 space-y-2">
                      <Label className="text-xs font-bold text-[#6b7280]">Harga jual</Label>
                      <Input value={productPrice} onChange={(event) => setProductPrice(normalizeLocalizedDecimalInput(event.target.value))} placeholder={formatPrice(productPriceSuggestion)} inputMode="decimal" type="text" className="h-11 rounded-2xl bg-white text-xs font-bold" />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MetricTile label="Stok" value={`${publishedProduct?.stock ?? productBottleCount} botol`} helper={publishedProduct ? 'stok produk tertaut' : 'akan jadi stok produk'} tone="emerald" />
                    <MetricTile label="HPP / botol" value={formatPrice(productCogsPerBottle)} helper="perkiraan bahan" tone="amber" />
                  </div>
                  <Button
                    type="button"
                    onClick={publishedProduct ? () => navigate(`/mobile/studio/products/${encodeURIComponent(publishedProduct.id)}/edit`) : openPublishConfirmation}
                    disabled={publishingProduct || (!publishedProduct && productBottleCount <= 0)}
                    variant="outline"
                    className="mt-3 h-11 w-full rounded-2xl bg-white gap-2 text-xs font-bold"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    {publishedProduct ? 'Buka produk tertaut' : 'Tinjau draf produk'}
                  </Button>
                </div>
              </div>
            </section> : null}

            {batchStep === 'review' ? <section className="mobile-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-[#ece8df] bg-[#faf9f6] px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-[#1f2937]">Riwayat batch</h2>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#6b7280]">Catatan produksi yang tersimpan untuk formula ini.</p>
                </div>
                <History className="h-5 w-5 text-amber-700" />
              </div>
              <div className="divide-y divide-[#f0ede7] px-4">
                {batchHistory.length ? batchHistory.slice(0, 4).map((batch) => (
                  <button
                    key={batch.id}
                    type="button"
                    onClick={() => {
                      setSavedBatch(batch);
                      setBatchStatus(batch.status || 'planned');
                    }}
                    className="grid w-full grid-cols-[1fr_auto] gap-3 py-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-[#1f2937]">{batch.batch_code}</span>
                      <span className="mt-0.5 block text-[10px] font-semibold text-[#6b7280]">
                        {formatQuantity(batch.target_quantity, 0)} ml / botol {formatQuantity(batch.bottle_ml, 0)} ml / stok {batch.bottle_count}
                      </span>
                    </span>
                    <MobileStatusBadge status={batch.status} className="h-5 px-2 text-[10px]">{BATCH_STATUS_LABELS[batch.status]}</MobileStatusBadge>
                  </button>
                )) : (
                  <div className="py-4 text-xs font-semibold text-[#6b7280]">Belum ada batch tersimpan.</div>
                )}
              </div>
            </section> : null}

            {batchStep === 'review' ? <section className="mobile-card overflow-hidden">
              <div className="border-b border-[#ece8df] bg-[#faf9f6] px-4 py-3">
                <h2 className="text-sm font-bold text-[#1f2937]">Rincian bahan baku</h2>
                <p className="mt-0.5 text-[11px] font-semibold text-[#6b7280]">Diskalakan ke konsentrat {formatGramAmount(concentrateBaseGrams)} untuk batch {formatGramAmount(targetValue)}.</p>
              </div>
              <div className="px-4 py-1">
                {concentrateRows.length ? visibleConcentrateRows.map((item) => (
                  <CostRow
                    key={item.rowKey}
                    item={item}
                    label={item.name || item.item_name || 'Bahan'}
                    helper={`${formatQuantity(item.percentage, 2)}% / ${formatGramAmount(item.batchGram)} / ${formatPricePerUnit(item.unitPrice)}`}
                    onDraftChange={updatePriceDraft}
                    onSave={saveMaterialPrice}
                    saving={savingPriceId === item.item_id}
                    value={formatPrice(item.cost)}
                  />
                )) : (
                  <div className="py-4 text-xs font-semibold text-[#6b7280]">Formula belum punya baris bahan yang bisa dihitung biayanya.</div>
                )}
                <PaginationOrLoadMore
                  visibleCount={visibleConcentrateRows.length}
                  totalCount={concentrateRows.length}
                  onLoadMore={() => setVisibleRows((current) => current + BATCH_ROW_PAGE_SIZE)}
                />
              </div>
            </section> : null}
          </>
        )}
      </main>
      {formulas.length ? (
        <StickyBottomActionBar fixed reserveSpace aria-label="Aksi alur batch">
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl bg-white px-4"
              onClick={batchStep === 'setup' ? () => navigate('/mobile/formulas') : goToPreviousStep}
              disabled={savingBatch || publishingProduct}
            >
              {batchStep === 'setup' ? 'Tutup' : 'Kembali'}
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              onClick={handleBatchPrimaryAction}
              disabled={savingBatch || publishingProduct}
            >
              {primaryActionLabel}
            </Button>
          </div>
        </StickyBottomActionBar>
      ) : null}
      <MobileBottomSheet
        open={publishConfirmOpen}
        onOpenChange={setPublishConfirmOpen}
        title="Konfirmasi draf produk"
        description="Periksa stok, hasil, biaya, dan harga sebelum stok produk dibuat."
        footer={(
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white text-xs font-bold" onClick={() => setPublishConfirmOpen(false)}>
              Periksa lagi
            </Button>
            <Button type="button" className="h-11 rounded-2xl text-xs font-bold" onClick={publishBatchAsProduct} disabled={publishingProduct}>
              {publishingProduct ? 'Membuat draf...' : 'Buat draf'}
            </Button>
          </div>
        )}
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3">
            <div className="text-[10px] font-bold uppercase text-[#6b7280]">SKU otomatis</div>
            <div className="mt-1 break-all text-sm font-bold text-[#1f2937]">{productSku || '-'}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricTile label="Batch" value={`${formatQuantity(targetValue, 0)} ml`} helper={`susut ${formatQuantity(productLossValue, 1)}%`} />
            <MetricTile label="Terpakai" value={`${formatQuantity(usableBatchVolume, 0)} ml`} helper={`sisa ${formatQuantity(remainingBatchVolume, 1)} ml`} tone="emerald" />
            <MetricTile label="Stok" value={`${productBottleCount} botol`} helper={`${formatQuantity(bottleSizeValue, 0)} ml per botol`} tone="emerald" />
            <MetricTile label="HPP / botol" value={formatPrice(productCogsPerBottle)} helper="biaya batch dibagi per botol" tone="amber" />
            <MetricTile label="Harga jual" value={formatPrice(productPriceNumber)} helper={productPriceValue > 0 ? 'harga manual' : 'harga saran'} />
            <MetricTile label="Margin" value={formatPrice(productMarginPerBottle)} helper={`${formatQuantity(productMarginPercent, 1)}%`} tone={productMarginPerBottle >= 0 ? 'emerald' : 'amber'} />
          </div>
          <p className="text-[11px] font-semibold leading-relaxed text-[#6b7280]">
            Produk dibuat sebagai draf yang tersembunyi dari katalog pembeli sampai diaktifkan di Studio → Produk.
          </p>
        </div>
      </MobileBottomSheet>
    </MobileAuthenticatedLayout>
  );
};

export default MobileBatchesPage;

