import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Calculator, ClipboardCheck, Download, Droplets, Factory, FlaskConical, History, PackageCheck, Save, ScrollText, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import PaginationOrLoadMore from '@/components/mobile-ui/PaginationOrLoadMore.jsx';
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
import { clampPercentage, parseNumberInput } from '@/utils/productionCosting.js';
import { normalizeLocalizedDecimalInput } from '@/utils/numberInputs.js';
import { BATCH_STATUSES } from '@/utils/constants.js';

const DEFAULT_TARGET_GRAMS = '100';
const BATCH_ROW_PAGE_SIZE = 8;
const targetPresets = ['30', '100', '500', '1000'];
const workflowStatuses = BATCH_STATUSES.filter((status) => ['planned', 'produced', 'qc', 'ready_for_product', 'converted_to_product'].includes(status.value));
const STOCK_DEDUCTING_STATUSES = new Set(['produced', 'qc', 'ready_for_product', 'converted_to_product']);
const QC_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'passed', label: 'Passed' },
  { value: 'needs_adjustment', label: 'Needs adjustment' },
  { value: 'failed', label: 'Failed' },
];
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

const UsageLedgerRow = ({ record }) => (
  <div className="rounded-xl border border-[#ece8df] bg-[#fdfcf9] p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-xs font-bold text-[#1f2937]">
          {record.raw_material_name || record.raw_material_id || 'Material'}
        </div>
        <div className="mt-0.5 text-[10px] font-bold uppercase text-[#8b949e]">
          {record.type === 'batch_solvent' ? 'Solvent' : 'Formula material'} / {record.movement || record.source || 'Batch usage'}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs font-bold text-[#1f2937]">{formatQuantity(record.quantity_deducted, 2)} {record.unit || ''}</div>
        <div className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">{formatPrice(record.cost)}</div>
      </div>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-semibold text-[#6b7280]">
      <span>Before {formatQuantity(record.stock_before, 2)}</span>
      <span className="text-right">After {formatQuantity(record.stock_after, 2)}</span>
    </div>
  </div>
);

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
      setBatchHistory(rows);
      setSavedBatch(rows[0] || null);
      setUsageRecords([]);
      setQcStatus(rows[0]?.qc_status || 'pending');
      setQcNotes(rows[0]?.qc_notes || '');
      if (rows[0]?.status) {
        setBatchStatus(rows[0].status);
      } else {
        setBatchStatus('planned');
      }
    };

    loadBatchHistory();
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
  const concentrateRows = useMemo(
    () => buildScaledRows(formulaProfile?.items || [], targetValue, formulaProfile?.totalGrams || 0, priceOverrides, priceDrafts),
    [formulaProfile, priceDrafts, priceOverrides, targetValue]
  );

  const concentrateCost = concentrateRows.reduce((sum, item) => sum + item.cost, 0);
  const pricedRows = concentrateRows.filter((item) => Number(item.unitPrice || 0) > 0).length;
  const visibleConcentrateRows = concentrateRows.slice(0, visibleRows);
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
  const bottleSizeValue = Math.max(parseNumberInput(bottleSizeMl), 0);
  const productLossValue = clampPercentage(parseNumberInput(productLossPercent));
  const usableBatchVolume = targetValue * Math.max(1 - (productLossValue / 100), 0);
  const productBottleCount = bottleSizeValue > 0 ? Math.floor(usableBatchVolume / bottleSizeValue) : 0;
  const remainingBatchVolume = bottleSizeValue > 0 ? Math.max(usableBatchVolume - (productBottleCount * bottleSizeValue), 0) : 0;
  const productCogsPerBottle = productBottleCount > 0 ? dilutionTotalCost / productBottleCount : 0;
  const productPriceValue = parseNumberInput(productPrice);
  const productPriceSuggestion = Math.ceil((productCogsPerBottle * 2) / 1000) * 1000;
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
  const publishedProduct = batchProductKey
    ? catalogProducts.find((product) => getProductBatchKey(product) === batchProductKey)
    : null;

  const buildBatchPayload = (status = batchStatus, overrides = {}) => ({
    ...(savedBatch || {}),
    ...overrides,
    formula: selectedFormula,
    formula_id: selectedFormula?.id,
    solvent_id: selectedSolventId || null,
    target_quantity: targetValue,
    produced_quantity: targetValue,
    production_date: new Date().toISOString().slice(0, 10),
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
      toast.error('Set formula, batch size, and dilution first');
      return null;
    }

    if (!selectedSolventId) {
      toast.error('Choose solvent before saving batch');
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

      toast.success(usageRecords.length ? 'Batch saved and material stock deducted' : 'Batch saved');
      return batch;
    } catch (error) {
      toast.error(error.message || 'Failed to save batch');
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
      toast.success('Raw material price updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update price');
    } finally {
      setSavingPriceId('');
    }
  };

  const openPublishConfirmation = () => {
    if (!selectedFormula || productBottleCount <= 0) {
      toast.error('Set formula, batch size, and bottle size first');
      return;
    }

    if (productPriceNumber <= 0) {
      toast.error('Set a selling price before drafting product stock');
      return;
    }

    if (qcStatus !== 'passed') {
      toast.error('QC must pass before drafting product stock');
      return;
    }

    if (publishedProduct) {
      toast.info('Batch ini sudah pernah dipublish. Buka produk untuk edit stok, foto, dan deskripsi.');
      navigate(`/mobile/studio/products?view=new&edit=${encodeURIComponent(publishedProduct.id)}`);
      return;
    }

    setPublishConfirmOpen(true);
  };

  const publishBatchAsProduct = async () => {
    if (!selectedFormula || productBottleCount <= 0) {
      toast.error('Set formula, batch size, and bottle size first');
      return;
    }

    if (productPriceNumber <= 0) {
      toast.error('Set a selling price before drafting product stock');
      return;
    }

    if (qcStatus !== 'passed') {
      toast.error('QC must pass before drafting product stock');
      return;
    }

    if (publishedProduct) {
      toast.info('Batch ini sudah pernah dipublish. Buka produk untuk edit stok, foto, dan deskripsi.');
      navigate(`/mobile/studio/products?view=new&edit=${encodeURIComponent(publishedProduct.id)}`);
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
      toast.success(`${productBottleCount} bottles drafted in products`);
      setPublishConfirmOpen(false);
      navigate('/mobile/studio/products?view=list');
    } catch (error) {
      toast.error(error.message || 'Failed to publish product');
    } finally {
      setPublishingProduct(false);
    }
  };

  const exportFormulaPdf = async () => {
    if (!selectedFormula || !concentrateRows.length) {
      toast.error('Choose a costed formula first');
      return;
    }

    try {
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
    } catch (error) {
      toast.error(error.message || 'Failed to export formula PDF');
    }
  };

  if (loading || (selectedFormulaId && !formulaProfile)) {
    return (
      <MobileAuthenticatedLayout>
        <MobileLoadingState eyebrow="Batch" title="Loading batch calculator..." subtitle="Preparing formulas, solvent, and material pricing." />
      </MobileAuthenticatedLayout>
    );
  }

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>Mobile Batch Calculator - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Batch"
          subtitle="Concentrate and dilution COGS"
          onBack={() => navigate('/mobile/formulas')}
          action={<Calculator className="h-5 w-5 text-amber-700" />}
        />

        {profileLoading ? (
          <section className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
            Updating batch profile...
          </section>
        ) : null}

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
                    <Input value={targetGrams} onChange={(event) => setTargetGrams(normalizeLocalizedDecimalInput(event.target.value, { autoDecimalAfterLeadingZero: true }))} inputMode="decimal" type="text" className="h-11 min-w-0 rounded-2xl bg-white text-xs font-bold" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label className="text-xs font-bold text-[#6b7280]">Dilution %</Label>
                    <Input value={retailInputs.formulaPercentage} onChange={(event) => updateRetailInput('formulaPercentage', normalizeLocalizedDecimalInput(event.target.value, { autoDecimalAfterLeadingZero: true }))} inputMode="decimal" type="text" className="h-11 min-w-0 rounded-2xl bg-white text-xs font-bold" />
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

            <section className="mobile-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-amber-700">Owner production flow</div>
                  <h2 className="mt-1 text-base font-bold text-[#1f2937]">Save this as a production batch</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                    Formula yang sudah oke disimpan sebagai batch dulu, baru batch yang ready dikonversi menjadi draft product stock.
                  </p>
                </div>
                <MobileStatusBadge status={batchStatus} className="shrink-0" />
              </div>
              <div className="mt-3">
                <MobileSegmentedControl options={workflowStatuses} value={batchStatus} onChange={setBatchStatus} className="mobile-compact-tabs" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MetricTile label="Batch code" value={savedBatch?.batch_code || 'Not saved'} helper={savedBatch ? 'production record' : 'created on save'} />
                <MetricTile label="History" value={`${batchHistory.length} batch`} helper="for this formula" tone={batchHistory.length ? 'emerald' : 'neutral'} />
                <MetricTile
                  label="Stock"
                  value={savedBatch?.is_stock_deducted ? 'Deducted' : 'Pending'}
                  helper={STOCK_DEDUCTING_STATUSES.has(batchStatus) ? 'material ledger' : 'after produced'}
                  tone={savedBatch?.is_stock_deducted ? 'emerald' : 'neutral'}
                />
              </div>
              <Button
                type="button"
                onClick={() => saveProductionBatch(batchStatus)}
                disabled={savingBatch}
                className="mt-3 h-11 w-full rounded-2xl gap-2 text-xs font-bold"
              >
                <Save className="h-4 w-4" />
                {savingBatch ? 'Saving batch...' : savedBatch ? 'Update production batch' : 'Save production batch'}
              </Button>
            </section>

            <section className="mobile-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-amber-700">QC gate</div>
                  <h2 className="mt-1 text-base font-bold text-[#1f2937]">Approve before product stock</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                    Product stock can only be drafted after QC passes.
                  </p>
                </div>
                <MobileStatusBadge
                  status={qcStatus === 'passed' ? 'approved' : qcStatus}
                  tone={qcStatus === 'passed' ? 'approved' : qcStatus === 'failed' ? 'danger' : qcStatus === 'needs_adjustment' ? 'warning' : 'planned'}
                  className="shrink-0"
                />
              </div>
              <div className="mt-3 grid gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">QC status</Label>
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
                  <Label className="text-xs">QC notes</Label>
                  <textarea
                    value={qcNotes}
                    onChange={(event) => setQcNotes(event.target.value)}
                    rows={3}
                    placeholder="Macération, clarity, scent balance, adjustment notes..."
                    className="w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 text-xs font-semibold outline-none focus:border-amber-300"
                  />
                </div>
                <Button
                  type="button"
                  variant={qcStatus === 'passed' ? 'default' : 'outline'}
                  onClick={() => saveProductionBatch(qcStatus === 'passed' ? 'ready_for_product' : 'qc')}
                  disabled={savingBatch}
                  className="h-11 rounded-2xl gap-2 text-xs font-bold"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  {savingBatch ? 'Saving QC...' : 'Save QC gate'}
                </Button>
              </div>
            </section>

            <section className="mobile-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-amber-700">Material usage ledger</div>
                  <h2 className="mt-1 text-base font-bold text-[#1f2937]">Stock movements for this batch</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                    Deducted rows are locked by the batch record so material stock is only cut once.
                  </p>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
                  <ScrollText className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MetricTile label="Rows" value={`${usageRecords.length}`} helper="usage records" tone={usageRecords.length ? 'emerald' : 'neutral'} />
                <MetricTile
                  label="Usage cost"
                  value={formatPrice(usageRecords.reduce((sum, record) => sum + Number(record.cost || 0), 0))}
                  helper="material only"
                  tone={usageRecords.length ? 'amber' : 'neutral'}
                />
              </div>
              <div className="mt-3 grid gap-2">
                {usageRecords.length ? usageRecords.map((record) => (
                  <UsageLedgerRow key={record.id || `${record.raw_material_id}-${record.type}`} record={record} />
                )) : (
                  <div className="rounded-2xl border border-dashed border-[#e5e7eb] bg-white px-3 py-4 text-center">
                    <div className="text-xs font-bold text-[#1f2937]">No material stock deducted yet</div>
                    <p className="mt-1 text-[11px] font-semibold text-[#6b7280]">Move the batch to Produced, QC, or Ready for product to write the usage ledger.</p>
                  </div>
                )}
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
              <Button type="button" variant="outline" onClick={() => navigate('/mobile/production-costing')} className="h-11 rounded-2xl bg-white text-xs font-bold">
                <Factory className="mr-1 h-4 w-4" />
                Costing
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(`/mobile/validation?formulaId=${selectedFormulaId}`)} className="h-11 rounded-2xl bg-white text-xs font-bold">
                <ClipboardCheck className="mr-1 h-4 w-4" />
                Validate
              </Button>
            </div>

            <section className="mobile-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-[#1f2937]">Batch presets</h2>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-[#6b7280]">Tap a common trial or production size.</p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">{pricedRows}/{concentrateRows.length} priced</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {targetPresets.map((preset) => {
                  const active = String(targetValue) === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTargetGrams(preset)}
                      className={`h-10 rounded-xl border text-xs font-bold ${active ? 'border-amber-300 bg-amber-100 text-amber-800' : 'border-[#ece8df] bg-white text-[#1f2937]'}`}
                    >
                      {preset}g
                    </button>
                  );
                })}
              </div>
            </section>

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

            <section className="mobile-card p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
                  <ShoppingBag className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase text-amber-700">Publish to product</div>
                  <h2 className="mt-0.5 text-base font-bold text-[#1f2937]">{publishedProduct ? 'Batch already has product stock' : 'Turn this batch into stock'}</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                    {publishedProduct
                      ? `${publishedProduct.name} is linked to this formula, batch size, bottle size, dilution, and loss.`
                      : `${formatQuantity(usableBatchVolume, 0)} ml usable / ${formatQuantity(bottleSizeValue || 0, 0)} ml bottle = ${productBottleCount} bottles${remainingBatchVolume > 0 ? `, ${formatQuantity(remainingBatchVolume, 1)} ml remainder` : ''}.`}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="min-w-0 space-y-2">
                      <Label className="text-xs font-bold text-[#6b7280]">Bottle ml</Label>
                      <Input value={bottleSizeMl} onChange={(event) => setBottleSizeMl(normalizeLocalizedDecimalInput(event.target.value, { autoDecimalAfterLeadingZero: true }))} inputMode="decimal" type="text" className="h-11 rounded-2xl bg-white text-xs font-bold" />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label className="text-xs font-bold text-[#6b7280]">Loss %</Label>
                      <Input value={productLossPercent} onChange={(event) => setProductLossPercent(normalizeLocalizedDecimalInput(event.target.value, { autoDecimalAfterLeadingZero: true }))} inputMode="decimal" type="text" className="h-11 rounded-2xl bg-white text-xs font-bold" />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <div className="min-w-0 space-y-2">
                      <Label className="text-xs font-bold text-[#6b7280]">Sell price</Label>
                      <Input value={productPrice} onChange={(event) => setProductPrice(normalizeLocalizedDecimalInput(event.target.value))} placeholder={formatPrice(productPriceSuggestion)} inputMode="decimal" type="text" className="h-11 rounded-2xl bg-white text-xs font-bold" />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MetricTile label="Stock" value={`${publishedProduct?.stock ?? productBottleCount} bottles`} helper={publishedProduct ? 'linked product stock' : 'will become product stock'} tone="emerald" />
                    <MetricTile label="COGS / bottle" value={formatPrice(productCogsPerBottle)} helper="material estimate" tone="amber" />
                  </div>
                  <Button
                    type="button"
                    onClick={publishedProduct ? () => navigate(`/mobile/studio/products?view=new&edit=${encodeURIComponent(publishedProduct.id)}`) : openPublishConfirmation}
                    disabled={publishingProduct || (!publishedProduct && productBottleCount <= 0)}
                    className="mt-3 h-11 w-full rounded-2xl gap-2 text-xs font-bold"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    {publishedProduct ? 'Edit linked product' : publishingProduct ? 'Publishing...' : 'Draft product stock'}
                  </Button>
                </div>
              </div>
            </section>

            <section className="mobile-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-[#ece8df] bg-[#faf9f6] px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-[#1f2937]">Batch history</h2>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#6b7280]">Saved production records for this formula.</p>
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
                        {formatQuantity(batch.target_quantity, 0)} ml / {formatQuantity(batch.bottle_ml, 0)} ml bottle / {batch.bottle_count} stock
                      </span>
                    </span>
                    <MobileStatusBadge status={batch.status} className="h-5 px-2 text-[10px]" />
                  </button>
                )) : (
                  <div className="py-4 text-xs font-semibold text-[#6b7280]">No saved batch yet.</div>
                )}
              </div>
            </section>

            <section className="mobile-card overflow-hidden">
              <div className="border-b border-[#ece8df] bg-[#faf9f6] px-4 py-3">
                <h2 className="text-sm font-bold text-[#1f2937]">Raw material breakdown</h2>
                <p className="mt-0.5 text-[11px] font-semibold text-[#6b7280]">Scaled to {formatGramAmount(targetValue)} full concentrate.</p>
              </div>
              <div className="px-4 py-1">
                {concentrateRows.length ? visibleConcentrateRows.map((item) => (
                  <CostRow
                    key={item.rowKey}
                    item={item}
                    label={item.name || item.item_name || 'Material'}
                    helper={`${formatQuantity(item.percentage, 2)}% / ${formatGramAmount(item.batchGram)} / ${formatPricePerUnit(item.unitPrice)}`}
                    onDraftChange={updatePriceDraft}
                    onSave={saveMaterialPrice}
                    saving={savingPriceId === item.item_id}
                    value={formatPrice(item.cost)}
                  />
                )) : (
                  <div className="py-4 text-xs font-semibold text-[#6b7280]">Formula has no costable material rows yet.</div>
                )}
                <PaginationOrLoadMore
                  visibleCount={visibleConcentrateRows.length}
                  totalCount={concentrateRows.length}
                  onLoadMore={() => setVisibleRows((current) => current + BATCH_ROW_PAGE_SIZE)}
                />
              </div>
            </section>
          </>
        )}
      </main>
      <MobileBottomSheet
        open={publishConfirmOpen}
        onOpenChange={setPublishConfirmOpen}
        title="Confirm product draft"
        description="Review stock, yield, cost, and pricing before product stock is created."
        footer={(
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white text-xs font-bold" onClick={() => setPublishConfirmOpen(false)}>
              Review
            </Button>
            <Button type="button" className="h-11 rounded-2xl text-xs font-bold" onClick={publishBatchAsProduct} disabled={publishingProduct}>
              {publishingProduct ? 'Publishing...' : 'Create draft'}
            </Button>
          </div>
        )}
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3">
            <div className="text-[10px] font-bold uppercase text-[#6b7280]">Auto SKU</div>
            <div className="mt-1 break-all text-sm font-bold text-[#1f2937]">{productSku || '-'}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricTile label="Batch" value={`${formatQuantity(targetValue, 0)} ml`} helper={`${formatQuantity(productLossValue, 1)}% loss`} />
            <MetricTile label="Usable" value={`${formatQuantity(usableBatchVolume, 0)} ml`} helper={`${formatQuantity(remainingBatchVolume, 1)} ml remainder`} tone="emerald" />
            <MetricTile label="Stock" value={`${productBottleCount} bottles`} helper={`${formatQuantity(bottleSizeValue, 0)} ml each`} tone="emerald" />
            <MetricTile label="COGS / bottle" value={formatPrice(productCogsPerBottle)} helper="batch cost allocated" tone="amber" />
            <MetricTile label="Sell price" value={formatPrice(productPriceNumber)} helper={productPriceValue > 0 ? 'manual price' : 'suggested price'} />
            <MetricTile label="Margin" value={formatPrice(productMarginPerBottle)} helper={`${formatQuantity(productMarginPercent, 1)}%`} tone={productMarginPerBottle >= 0 ? 'emerald' : 'amber'} />
          </div>
          <p className="text-[11px] font-semibold leading-relaxed text-[#6b7280]">
            Product akan dibuat sebagai draft tersembunyi dari katalog customer sampai kamu aktifkan di Studio Products.
          </p>
        </div>
      </MobileBottomSheet>
    </MobileAuthenticatedLayout>
  );
};

export default MobileBatchesPage;

