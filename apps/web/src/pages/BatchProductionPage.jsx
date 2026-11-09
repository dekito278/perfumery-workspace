import React, { useEffect, useMemo, useState } from 'react';
import { shopToday } from '@/utils/localDay.js';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Beaker, ClipboardCheck, Factory, Home, PackageCheck, Save, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { autoTierPriceMessage } from '@/utils/autoTierPrices.js';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import { Button } from '@/components/ui/button.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import StatusChip from '@/components/ui/status-chip.jsx';
import { useProductionCostPage } from '@/hooks/useProductionCostPage.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { deductBatchMaterialStock, getBatches, getBatchUsageRecords, saveBatch } from '@/services/batchesService.js';
import {
  getProductBatchKey,
  PRODUCT_BATCH_BOTTLE_TAG_PREFIX,
  PRODUCT_BATCH_CODE_TAG_PREFIX,
  PRODUCT_BATCH_COGS_TAG_PREFIX,
  PRODUCT_BATCH_DILUTION_TAG_PREFIX,
  PRODUCT_BATCH_ID_TAG_PREFIX,
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
import { updateFormulaStatus } from '@/services/formulasSupabaseService.js';
import { calculateIngredientCost, formatPrice } from '@/utils/pricingUtils.js';
import { clampPercentage, parseNumberInput, suggestedBottlePrice } from '@/utils/productionCosting.js';
import { formatQuantity } from '@/utils/formatting.js';
import { BATCH_STATUSES } from '@/utils/constants.js';
import FormulaCostBlindSpotNotice from '@/components/FormulaCostBlindSpotNotice.jsx';

const workflowStatuses = BATCH_STATUSES.filter((status) => ['planned', 'produced', 'qc', 'ready_for_product', 'converted_to_product'].includes(status.value));
const BATCH_STATUS_LABELS = Object.fromEntries(BATCH_STATUSES.map(({ value, label }) => [value, label]));
const stockDeductingStatuses = new Set(['produced', 'qc', 'ready_for_product', 'converted_to_product']);
const qcStatuses = [
  { value: 'pending', label: 'Menunggu' },
  { value: 'passed', label: 'Lulus' },
  { value: 'needs_adjustment', label: 'Perlu penyesuaian' },
  { value: 'failed', label: 'Gagal' },
];

const formatNumber = (value, digits = 0) => new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: digits,
}).format(Number(value || 0));

const getFormulaItemDilutionPercent = (item) => {
  const percent = Number(
    item?.dilution_percent
    ?? item?.dilution_percentage
    ?? item?.dilutionPercentage
    ?? item?.concentration_percent
    ?? 0,
  );

  return Number.isFinite(percent) && percent > 0 && percent < 100 ? percent : null;
};

const getFormulaItemDilutionSolventName = (item) => String(
  item?.dilution_solvent_name
  || item?.dilutionSolventName
  || item?.dilution_solvent?.name
  || item?.expand?.dilution_solvent_id?.name
  || '',
).trim();

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

const metricTone = {
  neutral: 'border-stone-200 bg-white text-[#1f2937]',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  rose: 'border-rose-200 bg-rose-50 text-rose-800',
};

const MetricCard = ({ label, value, helper, tone = 'neutral' }) => (
  <div className={`rounded-2xl border p-4 shadow-sm ${metricTone[tone] || metricTone.neutral}`}>
    <div className="text-xs font-bold uppercase opacity-70">{label}</div>
    <div className="mt-2 text-2xl font-bold">{value}</div>
    {helper ? <p className="mt-1 text-xs font-semibold opacity-75">{helper}</p> : null}
  </div>
);

const fieldClass = 'h-11 w-full min-w-0 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300';

const BatchProductionPage = () => {
  const navigate = useNavigate();
  const { id: requestedBatchFormulaId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const requestedFormulaId = requestedBatchFormulaId || searchParams.get('formulaId') || '';
  const catalogProducts = useCatalogProducts({ editableOnly: true });
  const {
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

  const [selectedOnce, setSelectedOnce] = useState(false);
  const [targetMl, setTargetMl] = useState('100');
  const [bottleMl, setBottleMl] = useState('30');
  const [lossPercent, setLossPercent] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('');
  const [batchStatus, setBatchStatus] = useState('planned');
  const [savingBatch, setSavingBatch] = useState(false);
  const [publishingProduct, setPublishingProduct] = useState(false);
  const [savedBatch, setSavedBatch] = useState(null);
  const [batchHistory, setBatchHistory] = useState([]);
  const [usageRecords, setUsageRecords] = useState([]);
  const [qcStatus, setQcStatus] = useState('pending');
  const [qcNotes, setQcNotes] = useState('');

  useEffect(() => {
    if (!selectedOnce && requestedFormulaId && formulas.some((formula) => formula.id === requestedFormulaId)) {
      setSelectedFormulaId(requestedFormulaId);
      setSelectedOnce(true);
    }
  }, [formulas, requestedFormulaId, selectedOnce, setSelectedFormulaId]);

  useEffect(() => {
    // Guard against an out-of-order response: switching formulas quickly could let the earlier request
    // resolve last and leave savedBatch pointing at another formula's batch — which the save path then
    // updates by id (audit round 8).
    let cancelled = false;
    const loadBatchHistory = async () => {
      if (!selectedFormulaId) {
        setBatchHistory([]);
        setSavedBatch(null);
        setUsageRecords([]);
        return;
      }

      const rows = await getBatches({ formulaId: selectedFormulaId });
      if (cancelled) return;
      setBatchHistory(rows);
      const latest = rows[0] || null;
      setSavedBatch(latest);
      setBatchStatus(latest?.status || 'planned');
      setQcStatus(latest?.qc_status || 'pending');
      setQcNotes(latest?.qc_notes || '');
      // Saving updates THIS batch by id, so the form has to show its parameters. It used to keep the page
      // defaults, which meant simply opening a formula armed a save that would rewrite the last batch's
      // volume, ratio, bottle size and loss with values nobody typed (audit round 8).
      if (latest) {
        if (latest.target_quantity) setTargetMl(String(latest.target_quantity));
        if (latest.bottle_ml) setBottleMl(String(latest.bottle_ml));
        if (latest.loss_percent !== null && latest.loss_percent !== undefined) setLossPercent(String(latest.loss_percent));
        if (latest.solvent_id) setSelectedSolventId(latest.solvent_id);
        if (latest.selling_price) setSellingPrice(String(latest.selling_price));
        if (latest.formula_percentage) updateRetailInput('formulaPercentage', String(latest.formula_percentage));
      }
    };

    loadBatchHistory();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFormulaId]);

  useEffect(() => {
    let cancelled = false;
    const loadUsage = async () => {
      if (!savedBatch?.id || String(savedBatch.id).startsWith('local-batch-')) {
        setUsageRecords([]);
        return;
      }
      const rows = await getBatchUsageRecords(savedBatch.id);
      if (!cancelled) setUsageRecords(rows);
    };

    loadUsage();
    return () => {
      cancelled = true;
    };
  }, [savedBatch?.id]);

  const selectedSolvent = solventOptions.find((material) => material.id === selectedSolventId) || null;
  const targetValue = Math.max(parseNumberInput(targetMl), 0);
  const concentration = clampPercentage(parseNumberInput(retailInputs.formulaPercentage));
  const formulaRatio = concentration / 100;
  const bottleValue = Math.max(parseNumberInput(bottleMl), 0);
  const lossValue = clampPercentage(parseNumberInput(lossPercent));
  const formulaItems = useMemo(() => formulaProfile?.items || [], [formulaProfile?.items]);
  const totalFormulaGrams = Number(formulaProfile?.totalGrams || 0);
  // The rows are the CONCENTRATE weighing sheet, so they scale to formulaMl (targetValue x the formula
  // ratio), not to the finished batch volume. Scaling to targetValue made every row 1/ratio too large —
  // 5x at the default 20% — while deduct_batch_material_stock consumed formula_quantity_needed (= formulaMl).
  // A perfumer following the sheet made 5x the concentrate they had diluent for, and the printed sheet
  // disagreed with the usage ledger right below it (audit round 8).
  const concentrateBaseGrams = targetValue * formulaRatio;
  const concentrateRows = useMemo(() => {
    if (!formulaItems.length || !concentrateBaseGrams || !totalFormulaGrams) return [];
    return formulaItems.map((item, index) => {
      const formulaGram = Number(item.gram_amount || item.grams || 0);
      const percentage = totalFormulaGrams > 0 ? (formulaGram / totalFormulaGrams) * 100 : 0;
      const batchGram = (concentrateBaseGrams * percentage) / 100;
      const unitPrice = Number(item.unit_price || 0);
      const dilutionPercent = getFormulaItemDilutionPercent(item);
      const dilutionSolventName = getFormulaItemDilutionSolventName(item);
      const activeBatchGram = dilutionPercent ? batchGram * (dilutionPercent / 100) : batchGram;
      const carrierBatchGram = dilutionPercent ? Math.max(batchGram - activeBatchGram, 0) : 0;
      return {
        ...item,
        activeBatchGram,
        batchGram,
        carrierBatchGram,
        cost: calculateIngredientCost(batchGram, unitPrice),
        dilutionPercent,
        dilutionSolventName,
        percentage,
        rowKey: item.id || `${item.item_id || 'material'}-${index}`,
        unitPrice,
      };
    });
  }, [formulaItems, concentrateBaseGrams, totalFormulaGrams]);

  const concentrateCost = concentrateRows.reduce((sum, item) => sum + Number(item.cost || 0), 0);
  const concentrateCostPerMl = concentrateBaseGrams > 0 ? concentrateCost / concentrateBaseGrams : 0;
  const formulaMl = targetValue * formulaRatio;
  const solventMl = Math.max(targetValue - formulaMl, 0);
  const solventCostPerMl = selectedSolvent ? calculateIngredientCost(1, Number(selectedSolvent.cost_per_unit || 0)) : 0;
  const dilutionCost = (concentrateCostPerMl * formulaMl) + (solventCostPerMl * solventMl);
  const usableMl = targetValue * Math.max(1 - (lossValue / 100), 0);
  const bottleCount = bottleValue > 0 ? Math.floor(usableMl / bottleValue) : 0;
  const cogsPerBottle = bottleCount > 0 ? dilutionCost / bottleCount : 0;
  const suggestedPrice = suggestedBottlePrice(cogsPerBottle);
  const typedSellingPrice = parseNumberInput(sellingPrice);
  const sellingPriceNumber = typedSellingPrice > 0 ? typedSellingPrice : suggestedPrice;
  const marginPerBottle = sellingPriceNumber - cogsPerBottle;
  const marginPercent = sellingPriceNumber > 0 ? (marginPerBottle / sellingPriceNumber) * 100 : 0;
  const batchProductKey = selectedFormula ? buildBatchProductKey({
    bottleMl: bottleValue,
    concentration,
    formulaId: selectedFormula.id,
    lossPercent: lossValue,
    targetMl: targetValue,
  }) : '';
  const productSku = selectedFormula ? buildProductSku({
    bottleMl: bottleValue,
    concentration,
    formula: selectedFormula,
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
    formula_quantity_needed: formulaMl,
    solvent_quantity_needed: solventMl,
    bottle_ml: bottleValue,
    loss_percent: lossValue,
    usable_quantity: usableMl,
    bottle_count: bottleCount,
    cogs_per_bottle: Math.round(cogsPerBottle),
    selling_price: sellingPriceNumber,
    sku: productSku,
    status,
    qc_status: qcStatus,
    qc_notes: qcNotes.trim(),
    qc_checked_at: qcStatus === 'pending' ? null : (savedBatch?.qc_checked_at || new Date().toISOString()),
    qc_reviewer: selectedFormula?.author_name || '',
    notes: `Formula ${selectedFormula?.name || ''} converted through browser batch flow.`,
  });

  const refreshBatchHistory = async () => {
    if (!selectedFormulaId) return;
    setBatchHistory(await getBatches({ formulaId: selectedFormulaId }));
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
      let nextUsageRecords = [];
      if (stockDeductingStatuses.has(nextStatus) && !batch.is_stock_deducted) {
        nextUsageRecords = await deductBatchMaterialStock(batch.id);
        // The flag is already persisted — deduct_batch_material_stock sets it itself and refuses to run
        // again while it is true, which is what stops a reload halving the stock. This used to re-save
        // the batch "to persist the flag", which it could not: saveBatch's payload deliberately drops
        // is_stock_deducted, because a save carrying a stale copy of it once cleared the flag and let the
        // next save deduct every raw material a second time (audit round 7). One redundant write, and a
        // comment that contradicted the one guarding the payload.
        batch = { ...batch, is_stock_deducted: true, usage_records: nextUsageRecords };
        setUsageRecords(nextUsageRecords);
      }
      setSavedBatch(batch);
      setBatchStatus(batch.status || nextStatus);
      await refreshBatchHistory();
      if (selectedFormula.status === 'draft' || selectedFormula.status === 'approved') {
        await updateFormulaStatus(selectedFormula.id, 'ready_for_batch');
      }
      toast.success(nextUsageRecords.length ? 'Batch disimpan dan stok bahan dipotong' : 'Batch disimpan');
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
      if (stockDeductingStatuses.has(nextStatus) && !savedBatch.is_stock_deducted) {
        const nextUsageRecords = await deductBatchMaterialStock(savedBatch.id);
        // Same as above: the RPC owns the flag, so there is nothing here left to persist.
        const nextBatch = { ...savedBatch, is_stock_deducted: true, usage_records: nextUsageRecords };
        setSavedBatch(nextBatch);
        setUsageRecords(nextUsageRecords);
        await refreshBatchHistory();
        return nextBatch;
      }
      return savedBatch;
    }
    return saveProductionBatch(nextStatus);
  };

  const publishBatchAsProduct = async () => {
    if (!selectedFormula || bottleCount <= 0) {
      toast.error('Isi dulu: formula, ukuran batch, dan ukuran botol');
      return;
    }
    // The mobile twin refuses to publish without a price; desktop did not, so a batch could go live as a
    // catalog product at Rp 0 (audit round 8).
    if (sellingPriceNumber <= 0) {
      toast.error('Isi harga jual sebelum membuat draf stok produk');
      return;
    }
    if (qcStatus !== 'passed') {
      toast.error('QC harus lulus sebelum membuat draf stok produk');
      return;
    }
    if (publishedProduct) {
      navigate(`/studio/products?edit=${encodeURIComponent(publishedProduct.id)}`);
      return;
    }

    setPublishingProduct(true);
    try {
      const batch = await ensureBatchRecord('ready_for_product');
      if (!batch) return;
      const materialNames = concentrateRows.map((item) => item.name || item.item_name).filter(Boolean);
      const publishedAt = new Date().toISOString();
      const product = await saveCustomProduct({
        name: selectedFormula.name,
        category: selectedFormula.category || 'Studio Batch',
        priceNumber: sellingPriceNumber,
        size: `${formatQuantity(bottleValue, 0)} ml`,
        notes: selectedFormula.notes || materialNames.slice(0, 5).join(', ') || 'Studio batch perfume',
        topNotes: materialNames.slice(0, 3),
        heartNotes: materialNames.slice(3, 6),
        baseNotes: materialNames.slice(6, 9),
        description: `Published from ${selectedFormula.name} batch. ${formatQuantity(targetValue, 0)} ml produced with ${formatQuantity(lossValue, 1)}% loss into ${bottleCount} bottles.`,
        concentration: `${formatQuantity(concentration, 1)}% perfume`,
        stock: bottleCount,
        variants: [{
          id: `${formatQuantity(bottleValue, 0)}-ml`,
          size: `${formatQuantity(bottleValue, 0)} ml`,
          priceNumber: sellingPriceNumber,
          stock: bottleCount,
        }],
        tags: [
          PRODUCT_DRAFT_TAG,
          'Studio batch',
          `${PRODUCT_BATCH_TAG_PREFIX} ${batchProductKey}`,
          `${PRODUCT_BATCH_ID_TAG_PREFIX} ${batch.id}`,
          `${PRODUCT_BATCH_CODE_TAG_PREFIX} ${batch.batch_code}`,
          `${PRODUCT_FORMULA_TAG_PREFIX} ${selectedFormula.id}`,
          `${PRODUCT_BATCH_TARGET_TAG_PREFIX} ${targetValue}`,
          `${PRODUCT_BATCH_BOTTLE_TAG_PREFIX} ${bottleValue}`,
          `${PRODUCT_BATCH_DILUTION_TAG_PREFIX} ${concentration}`,
          `${PRODUCT_BATCH_LOSS_TAG_PREFIX} ${lossValue}`,
          `${PRODUCT_BATCH_USABLE_TAG_PREFIX} ${usableMl}`,
          `${PRODUCT_BATCH_COGS_TAG_PREFIX} ${Math.round(cogsPerBottle)}`,
          `${PRODUCT_BATCH_STOCK_TAG_PREFIX} ${bottleCount}`,
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
      toast.success(`${bottleCount} botol dibuat sebagai draf produk`);
      // The product saved; its member and export prices may not have. Same rule as both product forms:
      // reported, never swallowed — a batch product that reaches the catalogue at retail-only is the
      // state the automation exists to prevent.
      const tierMessage = autoTierPriceMessage(product.autoTierPrices);
      if (tierMessage) toast[tierMessage.level](tierMessage.text);
      navigate('/studio/products');
    } catch (error) {
      toast.error(error.message || 'Gagal membuat draf produk');
    } finally {
      setPublishingProduct(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Produksi Batch - Solivagant</title>
        <meta name="description" content="Buat batch produksi, gerbang QC, pemakaian stok, dan draf stok produk dari formula yang disetujui." />
      </Helmet>
      <div className="page-container">
        <Button variant="ghost" onClick={() => navigate('/studio')} className="mb-4 h-9 gap-2">
          <Home className="h-4 w-4" />
          Kembali ke dashboard
        </Button>
        <PageHeader
          title="Produksi Batch"
          description="Alur untuk mengubah formula menjadi batch produksi, QC, catatan pemakaian bahan, lalu draf stok produk."
          action="Formula baru"
          actionIcon={Beaker}
          onAction={() => navigate('/formulas/new')}
          eyebrow="Produksi"
        />

        {loading ? (
          <StateBlock tone="loading" title="Memuat kalkulator batch" description="Menyiapkan formula, pelarut, dan profil biaya." />
        ) : !formulas.length ? (
          <StateBlock icon={Beaker} title="Belum ada formula" description="Buat atau impor formula dulu sebelum produksi batch." actionLabel="Formula baru" onAction={() => navigate('/formulas/new')} />
        ) : (
          <div className="space-y-6">
            {profileLoading ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                Memperbarui profil batch...
              </div>
            ) : null}

            <section className="overflow-hidden rounded-3xl border bg-white p-5 shadow-sm">
              <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.35fr)_minmax(160px,0.65fr)_minmax(160px,0.65fr)_minmax(220px,0.85fr)]">
                <label className="grid min-w-0 gap-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Formula</span>
                  <select value={selectedFormulaId} onChange={(event) => setSelectedFormulaId(event.target.value)} className={fieldClass}>
                    <option value="">Pilih formula</option>
                    {formulas.map((formula) => <option key={formula.id} value={formula.id}>{formula.name} ({formula.code})</option>)}
                  </select>
                </label>
                <label className="grid min-w-0 gap-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Volume batch</span>
                  <input value={targetMl} onChange={(event) => setTargetMl(event.target.value)} inputMode="decimal" className={fieldClass} />
                </label>
                <label className="grid min-w-0 gap-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Pengenceran %</span>
                  <input value={retailInputs.formulaPercentage} onChange={(event) => updateRetailInput('formulaPercentage', event.target.value)} inputMode="decimal" className={fieldClass} />
                </label>
                <label className="grid min-w-0 gap-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Pelarut</span>
                  <select value={selectedSolventId} onChange={(event) => setSelectedSolventId(event.target.value)} className={fieldClass}>
                    <option value="">Pilih pelarut</option>
                    {solventOptions.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {/* "100 ml full concentrate" under the cost of 20 ml of it: the helper named the finished
                  batch while the figure priced the concentrate, and the two only agree at 100%
                  dilution — which is why nobody caught it. Both quantities are named now. */}
              <MetricCard label="HPP konsentrat" value={formatPrice(concentrateCost)} helper={`${formatNumber(concentrateBaseGrams, 1)} ml konsentrat untuk batch ${formatNumber(targetValue, 1)} ml`} tone="amber" />
              <MetricCard label="HPP pengenceran" value={formatPrice(dilutionCost)} helper={`${formatNumber(formulaMl, 1)} ml formula / ${formatNumber(solventMl, 1)} ml pelarut`} tone="emerald" />
              <MetricCard label="Hasil" value={`${bottleCount} botol`} helper={`${formatNumber(usableMl, 1)} ml terpakai`} />
              <MetricCard label="HPP / botol" value={formatPrice(cogsPerBottle)} helper={`botol ${formatNumber(bottleValue, 0)} ml`} tone="amber" />
              <MetricCard label="Stok bahan" value={savedBatch?.is_stock_deducted ? 'Dipotong' : 'Menunggu'} helper={`${usageRecords.length} baris pemakaian`} tone={savedBatch?.is_stock_deducted ? 'emerald' : 'neutral'} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <section className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase text-amber-700">Batch produksi</div>
                    <h2 className="mt-1 text-xl font-bold">Simpan batch dan catatan pemakaian bahan</h2>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">Status Diproduksi, QC, atau Siap produk menulis catatan pemakaian agar stok bahan tidak terpotong dua kali.</p>
                  </div>
                  <StatusChip tone={savedBatch?.is_stock_deducted ? 'success' : 'warning'}>{savedBatch?.batch_code || 'Belum disimpan'}</StatusChip>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Status batch</span>
                    <select value={batchStatus} onChange={(event) => setBatchStatus(event.target.value)} className={fieldClass}>
                      {workflowStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Status QC</span>
                    <select value={qcStatus} onChange={(event) => setQcStatus(event.target.value)} className={fieldClass}>
                      {qcStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                  </label>
                  <Button type="button" className="self-end rounded-2xl gap-2" onClick={() => saveProductionBatch(batchStatus)} disabled={savingBatch}>
                    <Save className="h-4 w-4" />
                    {savingBatch ? 'Menyimpan...' : savedBatch ? 'Perbarui batch' : 'Simpan batch'}
                  </Button>
                </div>
                <label className="mt-4 grid gap-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Catatan QC</span>
                  <textarea value={qcNotes} onChange={(event) => setQcNotes(event.target.value)} rows={3} placeholder="Maserasi, kejernihan, keseimbangan aroma, catatan penyesuaian..." className="rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
                </label>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => saveProductionBatch(qcStatus === 'passed' ? 'ready_for_product' : 'qc')} disabled={savingBatch}>
                    <ClipboardCheck className="h-4 w-4" />
                    Simpan hasil QC
                  </Button>
                  <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => navigate('/production-costing')}>
                    <Factory className="h-4 w-4" />
                    Buka hitung biaya
                  </Button>
                </div>
              </section>

              <section className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase text-amber-700">Stok produk</div>
                    <h2 className="mt-1 text-xl font-bold">{publishedProduct ? 'Batch ini sudah punya stok produk' : 'Draf produk dari batch'}</h2>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">Produk dibuat sebagai draf agar foto dan deskripsinya bisa diubah dulu sebelum tampil di toko.</p>
                  </div>
                  <ShoppingBag className="h-5 w-5 text-amber-700" />
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Botol ml</span>
                    <input value={bottleMl} onChange={(event) => setBottleMl(event.target.value)} inputMode="decimal" className={fieldClass} />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Susut %</span>
                    <input value={lossPercent} onChange={(event) => setLossPercent(event.target.value)} inputMode="decimal" className={fieldClass} />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Harga jual</span>
                    <input value={sellingPrice} onChange={(event) => setSellingPrice(event.target.value)} inputMode="decimal" placeholder={formatPrice(suggestedPrice)} className={fieldClass} />
                  </label>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {/* The price this button is about to publish, and what it leaves. An empty Sell price
                      field falls back to the suggestion, and until now the only trace of that was the
                      grey placeholder inside the field — which reads as an example, not as the number
                      the product will be created at. The phone screen has shown both of these all
                      along. */}
                  <MetricCard label="Harga jual" value={formatPrice(sellingPriceNumber)} helper={typedSellingPrice > 0 ? 'harga manual' : 'harga saran'} />
                  <MetricCard label="Margin" value={formatPrice(marginPerBottle)} helper={`${formatQuantity(marginPercent, 1)}%`} tone={marginPerBottle >= 0 ? 'emerald' : 'amber'} />
                  <MetricCard label="Stok draf" value={`${publishedProduct?.stock ?? bottleCount} botol`} helper={publishedProduct ? 'stok produk tertaut' : 'dihitung dari volume terpakai'} tone="emerald" />
                  <MetricCard label="SKU" value={productSku || '-'} helper={publishedProduct ? 'sudah tertaut' : 'dibuat otomatis'} />
                </div>
                <Button type="button" className="mt-4 h-11 w-full rounded-2xl gap-2" onClick={publishedProduct ? () => navigate('/studio/products') : publishBatchAsProduct} disabled={publishingProduct || (!publishedProduct && bottleCount <= 0)}>
                  <ShoppingBag className="h-4 w-4" />
                  {publishedProduct ? 'Buka produk tertaut' : publishingProduct ? 'Membuat draf...' : 'Buat draf stok produk'}
                </Button>
              </section>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">Riwayat batch</h2>
                  <PackageCheck className="h-5 w-5 text-amber-700" />
                </div>
                <div className="mt-4 grid gap-2">
                  {batchHistory.length ? batchHistory.slice(0, 8).map((batch) => (
                    <button
                      key={batch.id}
                      type="button"
                      onClick={() => {
                        setSavedBatch(batch);
                        setBatchStatus(batch.status || 'planned');
                        setQcStatus(batch.qc_status || 'pending');
                        setQcNotes(batch.qc_notes || '');
                      }}
                      className="rounded-2xl border bg-[#fbfaf7] px-4 py-3 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold">{batch.batch_code}</div>
                          <div className="mt-1 text-xs font-semibold text-muted-foreground">{formatNumber(batch.target_quantity, 0)} ml / botol {formatNumber(batch.bottle_ml, 0)} ml / stok {batch.bottle_count}</div>
                        </div>
                        <StatusChip size="xs" tone={batch.status === 'converted_to_product' ? 'success' : 'warning'}>{BATCH_STATUS_LABELS[batch.status] || batch.status}</StatusChip>
                      </div>
                    </button>
                  )) : <p className="rounded-2xl border border-dashed bg-[#fbfaf7] p-4 text-sm font-semibold text-muted-foreground">Belum ada batch tersimpan untuk formula ini.</p>}
                </div>
              </section>

              <section className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">Catatan pemakaian bahan</h2>
                  <StatusChip tone={usageRecords.length ? 'success' : 'neutral'}>{usageRecords.length} baris</StatusChip>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#fbfaf7] text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Bahan</th>
                        <th className="px-4 py-3">Jumlah</th>
                        <th className="px-4 py-3">Stok</th>
                        <th className="px-4 py-3 text-right">Biaya</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {usageRecords.length ? usageRecords.map((record) => (
                        <tr key={record.id || `${record.raw_material_id}-${record.type}`}>
                          <td className="px-4 py-3 font-bold">{record.raw_material_name || record.raw_material_id || 'Bahan'}</td>
                          <td className="px-4 py-3 font-semibold">{formatNumber(record.quantity_deducted, 2)} {record.unit || ''}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-muted-foreground">{formatNumber(record.stock_before, 2)} ke {formatNumber(record.stock_after, 2)}</td>
                          <td className="px-4 py-3 text-right font-bold">{formatPrice(record.cost)}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="4" className="px-4 py-8 text-center text-sm font-semibold text-muted-foreground">Catatan pemakaian muncul setelah batch masuk Diproduksi, QC, atau Siap produk.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <section className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Rincian bahan baku</h2>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">Konsentrat untuk batch {formatNumber(targetValue, 1)} ml: timbang {formatNumber(concentrateBaseGrams, 2)} ml total, lalu encerkan dengan {formatNumber(solventMl, 2)} ml {selectedSolvent?.name || 'pelarut'}.</p>
                </div>
                <StatusChip tone={concentrateRows.length ? 'success' : 'neutral'}>{concentrateRows.length} bahan</StatusChip>
              </div>
              {profileError ? (
                <div role="alert" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold leading-relaxed text-rose-700">
                  Biaya bahan formula gagal dimuat — HPP &amp; harga saran di bawah TIDAK memperhitungkan biaya juice (dihitung Rp 0), dan angka itu ikut TERSIMPAN ke catatan batch. Pilih ulang formula sebelum menyimpan.
                </div>
              ) : null}
                            <FormulaCostBlindSpotNotice readiness={formulaProfile?.readiness} className="mt-4" />
              <div className="mt-4 overflow-x-auto rounded-2xl border">
                <table className="min-w-[920px] w-full text-left text-sm">
                  <thead className="bg-[#fbfaf7] text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Bahan</th>
                      <th className="px-4 py-3">%</th>
                      <th className="px-4 py-3">Pengenceran</th>
                      <th className="px-4 py-3">Jumlah batch</th>
                      <th className="px-4 py-3 text-right">Biaya</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {concentrateRows.length ? concentrateRows.map((item) => (
                      <tr key={item.rowKey}>
                        <td className="px-4 py-3">
                          <div className="font-bold">{item.name || item.item_name || 'Bahan'}</div>
                          {item.dilutionPercent ? (
                            <div className="mt-1 text-xs font-semibold text-emerald-700">Formula memakai bahan yang diencerkan</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-semibold">{formatNumber(item.percentage, 2)}%</td>
                        <td className="px-4 py-3">
                          {item.dilutionPercent ? (
                            <div>
                              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                                {formatNumber(item.dilutionPercent, 2)}%{item.dilutionSolventName ? ` dalam ${item.dilutionSolventName}` : ''}
                              </span>
                              <div className="mt-1 text-xs font-semibold text-muted-foreground">
                                Aktif {formatNumber(item.activeBatchGram, 2)} ml / pelarut {formatNumber(item.carrierBatchGram, 2)} ml
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-bold text-muted-foreground">Murni</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold">{formatNumber(item.batchGram, 2)} ml</td>
                        <td className="px-4 py-3 text-right font-bold">{formatPrice(item.cost)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-sm font-semibold text-muted-foreground">Formula belum punya baris bahan yang bisa dihitung biayanya.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default BatchProductionPage;
