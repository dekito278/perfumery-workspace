import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Beaker, ClipboardCheck, Factory, Home, PackageCheck, Save, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
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
import { clampPercentage, parseNumberInput } from '@/utils/productionCosting.js';
import { formatQuantity } from '@/utils/formatting.js';
import { BATCH_STATUSES } from '@/utils/constants.js';

const workflowStatuses = BATCH_STATUSES.filter((status) => ['planned', 'produced', 'qc', 'ready_for_product', 'converted_to_product'].includes(status.value));
const stockDeductingStatuses = new Set(['produced', 'qc', 'ready_for_product', 'converted_to_product']);
const qcStatuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'passed', label: 'Passed' },
  { value: 'needs_adjustment', label: 'Needs adjustment' },
  { value: 'failed', label: 'Failed' },
];

const formatNumber = (value, digits = 0) => new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: digits,
}).format(Number(value || 0));

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

const fieldClass = 'h-11 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300';

const BatchProductionPage = () => {
  const navigate = useNavigate();
  const { id: requestedBatchFormulaId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const requestedFormulaId = requestedBatchFormulaId || searchParams.get('formulaId') || '';
  const catalogProducts = useCatalogProducts({ editableOnly: true });
  const {
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
    const loadBatchHistory = async () => {
      if (!selectedFormulaId) {
        setBatchHistory([]);
        setSavedBatch(null);
        setUsageRecords([]);
        return;
      }

      const rows = await getBatches({ formulaId: selectedFormulaId });
      setBatchHistory(rows);
      setSavedBatch(rows[0] || null);
      setBatchStatus(rows[0]?.status || 'planned');
      setQcStatus(rows[0]?.qc_status || 'pending');
      setQcNotes(rows[0]?.qc_notes || '');
    };

    loadBatchHistory();
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
  const formulaItems = formulaProfile?.items || [];
  const totalFormulaGrams = Number(formulaProfile?.totalGrams || 0);
  const concentrateRows = useMemo(() => {
    if (!formulaItems.length || !targetValue || !totalFormulaGrams) return [];
    return formulaItems.map((item, index) => {
      const formulaGram = Number(item.gram_amount || item.grams || 0);
      const percentage = totalFormulaGrams > 0 ? (formulaGram / totalFormulaGrams) * 100 : 0;
      const batchGram = (targetValue * percentage) / 100;
      const unitPrice = Number(item.unit_price || 0);
      return {
        ...item,
        batchGram,
        cost: calculateIngredientCost(batchGram, unitPrice),
        percentage,
        rowKey: item.id || `${item.item_id || 'material'}-${index}`,
        unitPrice,
      };
    });
  }, [formulaItems, targetValue, totalFormulaGrams]);

  const concentrateCost = concentrateRows.reduce((sum, item) => sum + Number(item.cost || 0), 0);
  const concentrateCostPerMl = targetValue > 0 ? concentrateCost / targetValue : 0;
  const formulaMl = targetValue * formulaRatio;
  const solventMl = Math.max(targetValue - formulaMl, 0);
  const solventCostPerMl = selectedSolvent ? calculateIngredientCost(1, Number(selectedSolvent.cost_per_unit || 0)) : 0;
  const dilutionCost = (concentrateCostPerMl * formulaMl) + (solventCostPerMl * solventMl);
  const usableMl = targetValue * Math.max(1 - (lossValue / 100), 0);
  const bottleCount = bottleValue > 0 ? Math.floor(usableMl / bottleValue) : 0;
  const cogsPerBottle = bottleCount > 0 ? dilutionCost / bottleCount : 0;
  const suggestedPrice = Math.ceil((cogsPerBottle * 2) / 1000) * 1000;
  const sellingPriceNumber = parseNumberInput(sellingPrice) > 0 ? parseNumberInput(sellingPrice) : suggestedPrice;
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
      toast.error('Pilih formula, batch size, dan dilution dulu');
      return null;
    }
    if (!selectedSolventId) {
      toast.error('Pilih solvent sebelum save batch');
      return null;
    }

    setSavingBatch(true);
    try {
      let batch = await saveBatch(buildBatchPayload(nextStatus, overrides));
      let nextUsageRecords = [];
      if (stockDeductingStatuses.has(nextStatus) && !batch.is_stock_deducted) {
        nextUsageRecords = await deductBatchMaterialStock(batch.id);
        batch = { ...batch, is_stock_deducted: true, usage_records: nextUsageRecords };
        setUsageRecords(nextUsageRecords);
      }
      setSavedBatch(batch);
      setBatchStatus(batch.status || nextStatus);
      await refreshBatchHistory();
      if (selectedFormula.status === 'draft' || selectedFormula.status === 'approved') {
        await updateFormulaStatus(selectedFormula.id, 'ready_for_batch');
      }
      toast.success(nextUsageRecords.length ? 'Batch saved dan material stock deducted' : 'Batch saved');
      return batch;
    } catch (error) {
      toast.error(error.message || 'Gagal save batch');
      return null;
    } finally {
      setSavingBatch(false);
    }
  };

  const ensureBatchRecord = async (nextStatus = batchStatus) => {
    if (savedBatch?.id && savedBatch.status === nextStatus) {
      if (stockDeductingStatuses.has(nextStatus) && !savedBatch.is_stock_deducted) {
        const nextUsageRecords = await deductBatchMaterialStock(savedBatch.id);
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
      toast.error('Set formula, batch size, dan bottle size dulu');
      return;
    }
    if (qcStatus !== 'passed') {
      toast.error('QC harus passed sebelum draft product stock');
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
      toast.success(`${bottleCount} bottle masuk draft product stock`);
      navigate('/studio/products');
    } catch (error) {
      toast.error(error.message || 'Gagal draft product stock');
    } finally {
      setPublishingProduct(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Batch Production - Solivagant</title>
        <meta name="description" content="Create production batches, QC gates, stock usage, and draft product stock from approved formulas." />
      </Helmet>
      <div className="page-container">
        <Button variant="ghost" onClick={() => navigate('/studio')} className="mb-4 h-9 gap-2">
          <Home className="h-4 w-4" />
          Back to dashboard
        </Button>
        <PageHeader
          title="Batch Production"
          description="Workflow browser untuk ubah formula menjadi production batch, QC, material ledger, lalu draft product stock."
          action="New formula"
          actionIcon={Beaker}
          onAction={() => navigate('/formulas/new')}
          eyebrow="Production"
        />

        {loading ? (
          <StateBlock tone="loading" title="Memuat batch workspace" description="Formula, solvent, dan costing profile sedang disiapkan." />
        ) : !formulas.length ? (
          <StateBlock icon={Beaker} title="Belum ada formula" description="Buat atau import formula dulu sebelum batch production." actionLabel="Create formula" onAction={() => navigate('/formulas/new')} />
        ) : (
          <div className="space-y-6">
            {profileLoading ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                Updating batch profile...
              </div>
            ) : null}

            <section className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Formula</span>
                  <select value={selectedFormulaId} onChange={(event) => setSelectedFormulaId(event.target.value)} className={fieldClass}>
                    <option value="">Select formula</option>
                    {formulas.map((formula) => <option key={formula.id} value={formula.id}>{formula.name} ({formula.code})</option>)}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Batch volume</span>
                  <input value={targetMl} onChange={(event) => setTargetMl(event.target.value)} inputMode="decimal" className={fieldClass} />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Dilution %</span>
                  <input value={retailInputs.formulaPercentage} onChange={(event) => updateRetailInput('formulaPercentage', event.target.value)} inputMode="decimal" className={fieldClass} />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Solvent</span>
                  <select value={selectedSolventId} onChange={(event) => setSelectedSolventId(event.target.value)} className={fieldClass}>
                    <option value="">Select solvent</option>
                    {solventOptions.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Concentrate COGS" value={formatPrice(concentrateCost)} helper={`${formatNumber(targetValue, 1)} ml full concentrate`} tone="amber" />
              <MetricCard label="Dilution COGS" value={formatPrice(dilutionCost)} helper={`${formatNumber(formulaMl, 1)} ml formula / ${formatNumber(solventMl, 1)} ml solvent`} tone="emerald" />
              <MetricCard label="Yield" value={`${bottleCount} bottles`} helper={`${formatNumber(usableMl, 1)} ml usable`} />
              <MetricCard label="COGS / bottle" value={formatPrice(cogsPerBottle)} helper={`${formatNumber(bottleValue, 0)} ml bottle`} tone="amber" />
              <MetricCard label="Stock ledger" value={savedBatch?.is_stock_deducted ? 'Deducted' : 'Pending'} helper={`${usageRecords.length} usage rows`} tone={savedBatch?.is_stock_deducted ? 'emerald' : 'neutral'} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <section className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase text-amber-700">Production batch</div>
                    <h2 className="mt-1 text-xl font-bold">Save batch dan material ledger</h2>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">Status Produced/QC/Ready akan menulis usage ledger agar stock material tidak kepotong dua kali.</p>
                  </div>
                  <StatusChip tone={savedBatch?.is_stock_deducted ? 'success' : 'warning'}>{savedBatch?.batch_code || 'Not saved'}</StatusChip>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Batch status</span>
                    <select value={batchStatus} onChange={(event) => setBatchStatus(event.target.value)} className={fieldClass}>
                      {workflowStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase text-muted-foreground">QC status</span>
                    <select value={qcStatus} onChange={(event) => setQcStatus(event.target.value)} className={fieldClass}>
                      {qcStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                  </label>
                  <Button type="button" className="self-end rounded-2xl gap-2" onClick={() => saveProductionBatch(batchStatus)} disabled={savingBatch}>
                    <Save className="h-4 w-4" />
                    {savingBatch ? 'Saving...' : savedBatch ? 'Update batch' : 'Save batch'}
                  </Button>
                </div>
                <label className="mt-4 grid gap-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground">QC notes</span>
                  <textarea value={qcNotes} onChange={(event) => setQcNotes(event.target.value)} rows={3} placeholder="Maceration, clarity, scent balance, adjustment notes..." className="rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
                </label>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => saveProductionBatch(qcStatus === 'passed' ? 'ready_for_product' : 'qc')} disabled={savingBatch}>
                    <ClipboardCheck className="h-4 w-4" />
                    Save QC gate
                  </Button>
                  <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => navigate('/production-costing')}>
                    <Factory className="h-4 w-4" />
                    Open costing calculator
                  </Button>
                </div>
              </section>

              <section className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase text-amber-700">Product stock</div>
                    <h2 className="mt-1 text-xl font-bold">{publishedProduct ? 'Batch sudah punya product' : 'Draft product dari batch'}</h2>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">Product dibuat sebagai draft agar bisa diedit foto/deskripsi sebelum tampil di storefront.</p>
                  </div>
                  <ShoppingBag className="h-5 w-5 text-amber-700" />
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Bottle ml</span>
                    <input value={bottleMl} onChange={(event) => setBottleMl(event.target.value)} inputMode="decimal" className={fieldClass} />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Loss %</span>
                    <input value={lossPercent} onChange={(event) => setLossPercent(event.target.value)} inputMode="decimal" className={fieldClass} />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Sell price</span>
                    <input value={sellingPrice} onChange={(event) => setSellingPrice(event.target.value)} inputMode="decimal" placeholder={formatPrice(suggestedPrice)} className={fieldClass} />
                  </label>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <MetricCard label="Draft stock" value={`${publishedProduct?.stock ?? bottleCount} bottles`} helper={publishedProduct ? 'linked product stock' : 'calculated from usable volume'} tone="emerald" />
                  <MetricCard label="SKU" value={productSku || '-'} helper={publishedProduct ? 'already linked' : 'auto generated'} />
                </div>
                <Button type="button" className="mt-4 h-11 w-full rounded-2xl gap-2" onClick={publishedProduct ? () => navigate('/studio/products') : publishBatchAsProduct} disabled={publishingProduct || (!publishedProduct && bottleCount <= 0)}>
                  <ShoppingBag className="h-4 w-4" />
                  {publishedProduct ? 'Open linked product' : publishingProduct ? 'Publishing...' : 'Create draft product stock'}
                </Button>
              </section>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">Batch history</h2>
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
                          <div className="mt-1 text-xs font-semibold text-muted-foreground">{formatNumber(batch.target_quantity, 0)} ml / {formatNumber(batch.bottle_ml, 0)} ml / {batch.bottle_count} stock</div>
                        </div>
                        <StatusChip size="xs" tone={batch.status === 'converted_to_product' ? 'success' : 'warning'}>{batch.status}</StatusChip>
                      </div>
                    </button>
                  )) : <p className="rounded-2xl border border-dashed bg-[#fbfaf7] p-4 text-sm font-semibold text-muted-foreground">Belum ada batch tersimpan untuk formula ini.</p>}
                </div>
              </section>

              <section className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">Material usage ledger</h2>
                  <StatusChip tone={usageRecords.length ? 'success' : 'neutral'}>{usageRecords.length} rows</StatusChip>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#fbfaf7] text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Material</th>
                        <th className="px-4 py-3">Qty</th>
                        <th className="px-4 py-3">Stock</th>
                        <th className="px-4 py-3 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {usageRecords.length ? usageRecords.map((record) => (
                        <tr key={record.id || `${record.raw_material_id}-${record.type}`}>
                          <td className="px-4 py-3 font-bold">{record.raw_material_name || record.raw_material_id || 'Material'}</td>
                          <td className="px-4 py-3 font-semibold">{formatNumber(record.quantity_deducted, 2)} {record.unit || ''}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-muted-foreground">{formatNumber(record.stock_before, 2)} to {formatNumber(record.stock_after, 2)}</td>
                          <td className="px-4 py-3 text-right font-bold">{formatPrice(record.cost)}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="4" className="px-4 py-8 text-center text-sm font-semibold text-muted-foreground">Ledger muncul setelah batch masuk Produced/QC/Ready Product.</td>
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
                  <h2 className="text-lg font-bold">Raw material breakdown</h2>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">Formula diskalakan ke batch {formatNumber(targetValue, 1)} ml.</p>
                </div>
                <StatusChip tone={concentrateRows.length ? 'success' : 'neutral'}>{concentrateRows.length} materials</StatusChip>
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fbfaf7] text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Material</th>
                      <th className="px-4 py-3">%</th>
                      <th className="px-4 py-3">Batch qty</th>
                      <th className="px-4 py-3 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {concentrateRows.length ? concentrateRows.map((item) => (
                      <tr key={item.rowKey}>
                        <td className="px-4 py-3 font-bold">{item.name || item.item_name || 'Material'}</td>
                        <td className="px-4 py-3 font-semibold">{formatNumber(item.percentage, 2)}%</td>
                        <td className="px-4 py-3 font-semibold">{formatNumber(item.batchGram, 2)} ml</td>
                        <td className="px-4 py-3 text-right font-bold">{formatPrice(item.cost)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="4" className="px-4 py-8 text-center text-sm font-semibold text-muted-foreground">Formula belum punya material rows yang bisa dihitung.</td>
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
