import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Calculator,
  Download,
  Home,
  Plus,
  Printer,
  Trash2,
  Package2,
  Store,
  FlaskConical,
  Factory,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { toast } from 'sonner';
import { getFormulas, getFormulaItems } from '@/services/formulasSupabaseService.js';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { calculateIngredientCost, formatPrice, formatPricePerUnit } from '@/utils/pricingUtils.js';
import { formatCurrency, formatPercentage, formatQuantity } from '@/utils/formatting.js';
import { buildFormulaItemReferenceMaps, resolveFormulaItemReference } from '@/utils/legacyFormulaItemSources.js';

const LOCAL_STORAGE_PREFIX = 'production-costing-v4';

const DEFAULT_RETAIL_INPUTS = {
  totalBatchVolume: '1000',
  formulaPercentage: '20',
  bottleSize: '30',
  productionLossPercent: '3',
  bottleCost: '0',
  capCost: '0',
  atomizerCost: '0',
  boxCost: '0',
  labelCost: '0',
  shrinkWrapCost: '0',
  printCost: '0',
  insertCost: '0',
  packagingCost: '0',
  otherUnitCost: '0',
  laborCost: '0',
  overheadCost: '0',
  logisticsCost: '0',
  miscBatchCost: '0',
};

const DEFAULT_BULK_INPUTS = {
  productionLossPercent: '3',
  handlingCostPerLiter: '0',
  bulkOverheadCost: '0',
};

const DEFAULT_RETAIL_SCENARIOS = [
  { id: 'manual-retail', label: '', mode: 'markup', percent: '', feePercent: '0' },
];

const DEFAULT_BULK_SCENARIOS = [
  { id: 'bulk-quote-default', label: '', mode: 'markup', percent: '30', volumeValue: '', volumeUnit: 'ml' },
];

const DEFAULT_QUOTATION_INPUTS = {
  quotationNumber: '',
  brandName: '',
  attentionName: '',
  validDays: '14',
  selectedScenarioId: '',
  notes: 'Formula, concentration, and price follow the selected quote.',
  terms: 'Price excludes customized packaging, tax, and shipping unless stated otherwise.',
};

const PACKAGING_FIELDS = [
  { key: 'bottleCost', label: 'Bottle', kind: 'unit' },
  { key: 'capCost', label: 'Cap', kind: 'unit' },
  { key: 'atomizerCost', label: 'Sprayer / atomizer', kind: 'unit' },
  { key: 'boxCost', label: 'Box', kind: 'unit' },
  { key: 'labelCost', label: 'Label', kind: 'unit' },
  { key: 'shrinkWrapCost', label: 'Seal / shrink', kind: 'unit' },
  { key: 'printCost', label: 'Print / finishing', kind: 'unit' },
  { key: 'insertCost', label: 'Insert / card', kind: 'unit' },
  { key: 'packagingCost', label: 'Outer packaging', kind: 'unit' },
  { key: 'otherUnitCost', label: 'Other per bottle', kind: 'unit' },
  { key: 'laborCost', label: 'Labor', kind: 'batch' },
  { key: 'overheadCost', label: 'Overhead', kind: 'batch' },
  { key: 'logisticsCost', label: 'Transport / handling', kind: 'batch' },
  { key: 'miscBatchCost', label: 'Misc batch cost', kind: 'batch' },
];

const parseNumberInput = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampPercentage = (value, max = 100) => Math.min(Math.max(value, 0), max);

const createScenarioId = () => `bulk-quote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createBulkScenario = () => ({
  id: createScenarioId(),
  label: '',
  mode: 'markup',
  percent: '30',
  volumeValue: '',
  volumeUnit: 'ml',
});

const buildStorageKey = (formulaId) => `${LOCAL_STORAGE_PREFIX}:${formulaId}`;

const readLocalScenario = (formulaId) => {
  if (!formulaId || typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(buildStorageKey(formulaId));
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

const writeLocalScenario = (formulaId, payload) => {
  if (!formulaId || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(buildStorageKey(formulaId), JSON.stringify(payload));
  } catch {
    // Keep the page usable even when browser storage fails.
  }
};

const createDefaultRetailInputs = (formula) => ({
  ...DEFAULT_RETAIL_INPUTS,
  bottleCost: String(Number(formula?.bottle_cost || 0)),
  capCost: String(Number(formula?.cap_cost || 0)),
  packagingCost: String(Number(formula?.packaging_cost || 0)),
});

const createDefaultRetailScenarios = () => DEFAULT_RETAIL_SCENARIOS.map((scenario) => ({ ...scenario }));
const createDefaultBulkScenarios = () => DEFAULT_BULK_SCENARIOS.map((scenario) => ({ ...scenario }));
const createDefaultQuotationInputs = () => ({ ...DEFAULT_QUOTATION_INPUTS });
const normalizeBulkScenario = (scenario, fallbackScenario) => ({
  ...fallbackScenario,
  ...scenario,
  volumeValue: String(
    scenario?.volumeValue
    ?? scenario?.volumeMl
    ?? scenario?.volume
    ?? fallbackScenario.volumeValue
  ),
  volumeUnit: scenario?.volumeUnit === 'liter'
    ? 'liter'
    : (scenario?.volumeUnit === 'ml'
      ? 'ml'
      : (scenario?.volumeUnit === 'kg'
        ? 'kg'
        : (scenario?.volumeUnit === 'gram'
          ? 'gram'
          : (scenario?.volumeMl != null ? 'ml' : fallbackScenario.volumeUnit)))),
});

const convertToMl = (value, unit) => {
  const parsedValue = Math.max(parseNumberInput(value), 0);
  if (unit === 'liter' || unit === 'kg') {
    return parsedValue * 1000;
  }
  return unit === 'gram' ? parsedValue : parsedValue;
};

const buildPackagingLineItems = (inputs, bottleCount) => {
  const unitItems = [];
  const batchItems = [];

  for (const field of PACKAGING_FIELDS) {
    const cost = parseNumberInput(inputs[field.key]);
    if (cost <= 0) {
      continue;
    }

    if (field.kind === 'unit') {
      unitItems.push({
        key: field.key,
        label: field.label,
        unitCost: cost,
        quantity: bottleCount,
        totalCost: cost * bottleCount,
      });
      continue;
    }

    batchItems.push({
      key: field.key,
      label: field.label,
      unitCost: cost,
      quantity: 1,
      totalCost: cost,
    });
  }

  return { unitItems, batchItems };
};

const buildBulkRow = ({
  id,
  label,
  volumeValue,
  volumeUnit,
  materialCogsPerMl,
  handlingCostPerLiter,
  overheadPerLiter,
  bulkScenario,
}) => {
  const markupPercent = clampPercentage(parseNumberInput(bulkScenario.percent), 1000);
  const safeVolumeMl = convertToMl(volumeValue, volumeUnit);
  const baseCogs = materialCogsPerMl * safeVolumeMl;
  const handlingCost = handlingCostPerLiter * (safeVolumeMl / 1000);
  const overheadShare = overheadPerLiter * (safeVolumeMl / 1000);
  const totalCogs = baseCogs + handlingCost + overheadShare;
  const sellPrice = bulkScenario.mode === 'margin'
    ? (markupPercent >= 100 ? 0 : (totalCogs / Math.max(1 - (markupPercent / 100), 0.0001)))
    : totalCogs * (1 + (markupPercent / 100));
  const profit = sellPrice - totalCogs;
  const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;

  return {
    id,
    label,
    volumeValue: String(volumeValue ?? ''),
    volumeUnit,
    volumeMl: safeVolumeMl,
    markupPercent,
    totalCogs,
    sellPrice,
    profit,
    margin,
    cogsPerLiter: (materialCogsPerMl * 1000) + handlingCostPerLiter + overheadPerLiter,
  };
};

const ProductionCostPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('retail');
  const [formulas, setFormulas] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [selectedFormulaId, setSelectedFormulaId] = useState('');
  const [selectedSolventId, setSelectedSolventId] = useState('');
  const [formulaProfile, setFormulaProfile] = useState(null);
  const [retailInputs, setRetailInputs] = useState(DEFAULT_RETAIL_INPUTS);
  const [bulkInputs, setBulkInputs] = useState(DEFAULT_BULK_INPUTS);
  const [retailScenarios, setRetailScenarios] = useState(createDefaultRetailScenarios);
  const [bulkScenarios, setBulkScenarios] = useState(createDefaultBulkScenarios);
  const [quotationInputs, setQuotationInputs] = useState(createDefaultQuotationInputs);
  const [quotationOpen, setQuotationOpen] = useState(false);

  useEffect(() => {
    const loadReferenceData = async () => {
      setLoading(true);
      try {
        const [formulasData, rawMaterialsData] = await Promise.all([
          getFormulas(),
          getRawMaterialOptions(),
        ]);

        setFormulas(formulasData);
        setRawMaterials(rawMaterialsData);

        const firstFormulaId = formulasData[0]?.id || '';
        const firstSolventId = rawMaterialsData.find((material) => material.type === 'solvent')?.id || '';
        setSelectedFormulaId(firstFormulaId);
        setSelectedSolventId(firstSolventId);
      } catch {
        toast.error('Failed to load production costing data');
      } finally {
        setLoading(false);
      }
    };

    loadReferenceData();
  }, []);

  const selectedFormula = formulas.find((formula) => formula.id === selectedFormulaId) || null;

  useEffect(() => {
    if (!selectedFormulaId) {
      setRetailInputs(DEFAULT_RETAIL_INPUTS);
      setBulkInputs(DEFAULT_BULK_INPUTS);
      setRetailScenarios(createDefaultRetailScenarios());
      const nextBulkScenarios = createDefaultBulkScenarios();
      setBulkScenarios(nextBulkScenarios);
      setQuotationInputs(createDefaultQuotationInputs());
      return;
    }

    const persistedScenario = readLocalScenario(selectedFormulaId);
    if (persistedScenario) {
      const nextBulkScenarios = Array.isArray(persistedScenario.bulkScenarios) && persistedScenario.bulkScenarios.length
        ? persistedScenario.bulkScenarios.map((scenario, index) => (
          normalizeBulkScenario(scenario, createBulkScenario(index + 1))
        ))
        : createDefaultBulkScenarios();

      setRetailInputs({
        ...createDefaultRetailInputs(selectedFormula),
        ...(persistedScenario.retailInputs || {}),
      });
      setBulkInputs({
        ...DEFAULT_BULK_INPUTS,
        ...(persistedScenario.bulkInputs || {}),
      });
      setRetailScenarios(
        Array.isArray(persistedScenario.retailScenarios) && persistedScenario.retailScenarios.length
          ? persistedScenario.retailScenarios
          : createDefaultRetailScenarios()
      );
      setBulkScenarios(nextBulkScenarios);
      setQuotationInputs({
        ...createDefaultQuotationInputs(),
        ...(persistedScenario.quotationInputs || {}),
        selectedScenarioId: persistedScenario.quotationInputs?.selectedScenarioId || nextBulkScenarios[0]?.id || '',
      });
      return;
    }

    const nextBulkScenarios = createDefaultBulkScenarios();
    setRetailInputs(createDefaultRetailInputs(selectedFormula));
    setBulkInputs(DEFAULT_BULK_INPUTS);
    setRetailScenarios(createDefaultRetailScenarios());
    setBulkScenarios(nextBulkScenarios);
    setQuotationInputs({
      ...createDefaultQuotationInputs(),
      selectedScenarioId: nextBulkScenarios[0]?.id || '',
    });
  }, [selectedFormulaId, selectedFormula]);

  useEffect(() => {
    if (!selectedFormulaId) {
      return;
    }

    writeLocalScenario(selectedFormulaId, {
      retailInputs,
      bulkInputs,
      retailScenarios,
      bulkScenarios,
      quotationInputs,
    });
  }, [selectedFormulaId, retailInputs, bulkInputs, retailScenarios, bulkScenarios, quotationInputs]);

  useEffect(() => {
    if (!bulkScenarios.length) {
      return;
    }

    setQuotationInputs((current) => {
      const hasSelectedScenario = bulkScenarios.some((scenario) => scenario.id === current.selectedScenarioId);
      if (hasSelectedScenario) {
        return current;
      }

      return {
        ...current,
        selectedScenarioId: bulkScenarios[0]?.id || '',
      };
    });
  }, [bulkScenarios]);

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
      } catch {
        toast.error('Failed to load formula profile');
        setFormulaProfile(null);
      }
    };

    if (!loading) {
      loadFormulaProfile();
    }
  }, [selectedFormulaId, rawMaterials, loading]);

  const solventOptions = useMemo(
    () => rawMaterials.filter((material) => material.type === 'solvent'),
    [rawMaterials]
  );

  const selectedSolvent = solventOptions.find((material) => material.id === selectedSolventId) || null;

  const retailComputed = useMemo(() => {
    const targetFillVolume = parseNumberInput(retailInputs.totalBatchVolume);
    const concentration = clampPercentage(parseNumberInput(retailInputs.formulaPercentage));
    const unitBottleSize = parseNumberInput(retailInputs.bottleSize);
    const lossPercent = clampPercentage(parseNumberInput(retailInputs.productionLossPercent));
    const yieldRatio = Math.max(1 - (lossPercent / 100), 0.0001);
    const requiredProductionVolume = targetFillVolume > 0 ? targetFillVolume / yieldRatio : 0;

    const formulaVolumeNeeded = requiredProductionVolume * (concentration / 100);
    const solventVolumeNeeded = Math.max(requiredProductionVolume - formulaVolumeNeeded, 0);
    const formulaMaterialCost = (formulaProfile?.costPerMl || 0) * formulaVolumeNeeded;
    const solventCostPerMl = selectedSolvent ? calculateIngredientCost(1, Number(selectedSolvent.cost_per_unit || 0)) : 0;
    const solventMaterialCost = solventCostPerMl * solventVolumeNeeded;
    const totalMaterialCost = formulaMaterialCost + solventMaterialCost;

    const bottleCount = unitBottleSize > 0 ? Math.floor(targetFillVolume / unitBottleSize) : 0;
    const remainingVolume = unitBottleSize > 0 ? Math.max(targetFillVolume - (bottleCount * unitBottleSize), 0) : 0;
    const packagingLineItems = buildPackagingLineItems(retailInputs, bottleCount);
    const perBottlePackagingCost = packagingLineItems.unitItems.reduce((sum, item) => sum + item.unitCost, 0);
    const totalPackagingCost = packagingLineItems.unitItems.reduce((sum, item) => sum + item.totalCost, 0);
    const totalBatchOverhead = packagingLineItems.batchItems.reduce((sum, item) => sum + item.totalCost, 0);
    const totalProductionCost = totalMaterialCost + totalPackagingCost + totalBatchOverhead;
    const costPerBottle = bottleCount > 0 ? totalProductionCost / bottleCount : 0;
    const materialCostPerBottle = bottleCount > 0 ? totalMaterialCost / bottleCount : 0;
    const cogsPerMl = targetFillVolume > 0 ? totalProductionCost / targetFillVolume : 0;

    const scenarioResults = retailScenarios.map((scenario) => {
      const percent = clampPercentage(parseNumberInput(scenario.percent), 1000);
      const feePercent = clampPercentage(parseNumberInput(scenario.feePercent));
      const salePrice = scenario.mode === 'margin'
        ? (percent >= 100 ? 0 : (costPerBottle / Math.max(1 - (percent / 100), 0.0001)))
        : costPerBottle * (1 + (percent / 100));
      const channelFee = salePrice * (feePercent / 100);
      const netRevenue = Math.max(salePrice - channelFee, 0);
      const profitPerBottle = netRevenue - costPerBottle;
      const profitMargin = netRevenue > 0 ? (profitPerBottle / netRevenue) * 100 : 0;

      return {
        ...scenario,
        percent,
        feePercent,
        salePrice,
        channelFee,
        netRevenue,
        profitPerBottle,
        profitMargin,
        batchProfit: profitPerBottle * bottleCount,
      };
    });

    return {
      targetFillVolume,
      concentration,
      unitBottleSize,
      lossPercent,
      requiredProductionVolume,
      formulaVolumeNeeded,
      solventVolumeNeeded,
      solventCostPerMl,
      formulaMaterialCost,
      solventMaterialCost,
      totalMaterialCost,
      bottleCount,
      remainingVolume,
      perBottlePackagingCost,
      totalPackagingCost,
      totalBatchOverhead,
      totalProductionCost,
      costPerBottle,
      materialCostPerBottle,
      cogsPerMl,
      packagingLineItems,
      scenarioResults,
    };
  }, [retailInputs, formulaProfile, retailScenarios, selectedSolvent]);

  const bulkComputed = useMemo(() => {
    const concentration = clampPercentage(parseNumberInput(retailInputs.formulaPercentage));
    const lossPercent = clampPercentage(parseNumberInput(bulkInputs.productionLossPercent));
    const yieldRatio = Math.max(1 - (lossPercent / 100), 0.0001);
    const formulaRatio = concentration / 100;
    const solventRatio = Math.max(1 - formulaRatio, 0);
    const formulaCogsPerMl = (formulaProfile?.costPerMl || 0) * formulaRatio / yieldRatio;
    const solventCogsPerMl = selectedSolvent
      ? calculateIngredientCost(1, Number(selectedSolvent.cost_per_unit || 0)) * solventRatio / yieldRatio
      : 0;
    const materialCogsPerMl = formulaCogsPerMl + solventCogsPerMl;
    const handlingCostPerLiter = parseNumberInput(bulkInputs.handlingCostPerLiter);
    const overheadPerLiter = parseNumberInput(bulkInputs.bulkOverheadCost);
    const allInBulkCogsPerLiter = (materialCogsPerMl * 1000) + handlingCostPerLiter + overheadPerLiter;

    const rows = bulkScenarios.map((scenario, index) => buildBulkRow({
      id: scenario.id,
      label: scenario.label || `Quote ${index + 1}`,
      volumeValue: scenario.volumeValue,
      volumeUnit: scenario.volumeUnit,
      materialCogsPerMl,
      handlingCostPerLiter,
      overheadPerLiter,
      bulkScenario: scenario,
    }));

    return {
      concentration,
      lossPercent,
      formulaCogsPerMl,
      solventCogsPerMl,
      materialCogsPerMl,
      handlingCostPerLiter,
      overheadPerLiter,
      allInBulkCogsPerLiter,
      rows,
    };
  }, [bulkInputs, bulkScenarios, formulaProfile, retailInputs.formulaPercentage, selectedSolvent]);

  const retailChampion = useMemo(
    () => retailComputed.scenarioResults.reduce((best, current) => (
      !best || current.profitPerBottle > best.profitPerBottle ? current : best
    ), null),
    [retailComputed.scenarioResults]
  );

  const bulkChampion = useMemo(
    () => bulkComputed.rows.reduce((best, current) => (
      !best || current.profit > best.profit ? current : best
    ), null),
    [bulkComputed.rows]
  );

  const updateRetailInput = (key, value) => {
    setRetailInputs((current) => ({ ...current, [key]: value }));
  };

  const updateBulkInput = (key, value) => {
    setBulkInputs((current) => ({ ...current, [key]: value }));
  };

  const updateRetailScenario = (scenarioId, key, value) => {
    setRetailScenarios((current) => current.map((scenario) => (
      scenario.id === scenarioId ? { ...scenario, [key]: value } : scenario
    )));
  };

  const updateBulkScenario = (scenarioId, key, value) => {
    setBulkScenarios((current) => current.map((scenario) => (
      scenario.id === scenarioId ? { ...scenario, [key]: value } : scenario
    )));
  };

  const addBulkScenario = () => {
    setBulkScenarios((current) => [
      ...current,
      createBulkScenario(current.length + 1),
    ]);
  };

  const removeBulkScenario = (scenarioId) => {
    setBulkScenarios((current) => (
      current.length <= 1 ? current : current.filter((scenario) => scenario.id !== scenarioId)
    ));
  };

  const updateQuotationInput = (key, value) => {
    setQuotationInputs((current) => ({ ...current, [key]: value }));
  };

  const selectedQuotationRow = useMemo(
    () => bulkComputed.rows.find((row) => row.id === quotationInputs.selectedScenarioId) || bulkComputed.rows[0] || null,
    [bulkComputed.rows, quotationInputs.selectedScenarioId]
  );

  const buildExportConfig = () => {
    if (!selectedFormula || !formulaProfile) {
      return null;
    }

    const packagingRows = [
      ...retailComputed.packagingLineItems.unitItems.map((item) => ({
        item: item.label,
        quantity: `${item.quantity} bottles`,
        unitCost: formatCurrency(item.unitCost),
        totalCost: formatPrice(item.totalCost),
        notes: 'Per bottle component',
      })),
      ...retailComputed.packagingLineItems.batchItems.map((item) => ({
        item: item.label,
        quantity: '1 batch',
        unitCost: formatCurrency(item.unitCost),
        totalCost: formatPrice(item.totalCost),
        notes: 'Batch-level overhead',
      })),
    ];

    const retailScenarioEntries = retailComputed.scenarioResults.flatMap((scenario) => ([
      { label: `${scenario.label || 'Manual retail'} sell price`, value: formatCurrency(scenario.salePrice) },
      { label: `${scenario.label || 'Manual retail'} net profit / bottle`, value: formatCurrency(scenario.profitPerBottle) },
      { label: `${scenario.label || 'Manual retail'} batch profit`, value: formatPrice(scenario.batchProfit) },
      { label: `${scenario.label || 'Manual retail'} net margin`, value: formatPercentage(scenario.profitMargin) },
    ]));

    const bulkScenarioEntries = bulkComputed.rows.flatMap((row) => ([
      { label: `${row.label} COGS`, value: formatPrice(row.totalCogs) },
      { label: `${row.label} sell price`, value: formatPrice(row.sellPrice) },
      { label: `${row.label} profit`, value: formatPrice(row.profit) },
      { label: `${row.label} margin`, value: formatPercentage(row.margin) },
    ]));

    return {
      typeLabel: 'Production Cost Sheet',
      title: selectedFormula.name,
      subtitle: `Retail bottle costing and bulk brand pricing`,
      summaryEntries: [
        { label: 'Formula', value: `${selectedFormula.name} (${selectedFormula.code})` },
        { label: 'Solvent', value: selectedSolvent?.name || '-' },
        { label: 'Retail target fill', value: `${formatQuantity(retailComputed.targetFillVolume)} ml` },
        { label: 'Concentration', value: formatPercentage(retailComputed.concentration) },
        { label: 'Retail COGS / bottle', value: formatCurrency(retailComputed.costPerBottle) },
        { label: 'Bulk COGS / liter', value: formatCurrency(bulkComputed.allInBulkCogsPerLiter) },
      ],
      tableTitle: 'Retail Material, Packaging, And Overhead Breakdown',
      columns: [
        { key: 'item', label: 'Item', width: 58 },
        { key: 'quantity', label: 'Quantity', width: 28, align: 'right' },
        { key: 'unitCost', label: 'Unit cost', width: 28, align: 'right' },
        { key: 'totalCost', label: 'Total cost', width: 28, align: 'right' },
        { key: 'notes', label: 'Notes', width: 48 },
      ],
      rows: [
        {
          item: 'Formula concentrate',
          quantity: `${formatQuantity(retailComputed.formulaVolumeNeeded)} ml`,
          unitCost: formatCurrency(formulaProfile.costPerMl),
          totalCost: formatPrice(retailComputed.formulaMaterialCost),
          notes: 'Based on saved raw material prices',
        },
        {
          item: selectedSolvent?.name || 'Batch solvent',
          quantity: `${formatQuantity(retailComputed.solventVolumeNeeded)} ml`,
          unitCost: selectedSolvent ? formatPricePerUnit(selectedSolvent.cost_per_unit, selectedSolvent.unit) : '-',
          totalCost: formatPrice(retailComputed.solventMaterialCost),
          notes: 'Main solvent for this batch',
        },
        ...packagingRows,
      ],
      footerRows: [
        {
          item: 'TOTAL RETAIL PRODUCTION COST',
          quantity: '',
          unitCost: '',
          totalCost: formatPrice(retailComputed.totalProductionCost),
          notes: `${formatCurrency(retailComputed.costPerBottle)} per bottle`,
        },
      ],
      sections: [
        {
          title: 'Retail Scenario Details',
          entries: [
            { label: 'Formula needed', value: `${formatQuantity(retailComputed.formulaVolumeNeeded)} ml` },
            { label: 'Solvent needed', value: `${formatQuantity(retailComputed.solventVolumeNeeded)} ml` },
            { label: 'Packaging / bottle', value: formatCurrency(retailComputed.perBottlePackagingCost) },
            { label: 'Batch overhead', value: formatPrice(retailComputed.totalBatchOverhead) },
            { label: 'Material cost / bottle', value: formatCurrency(retailComputed.materialCostPerBottle) },
            { label: 'COGS / ml', value: formatCurrency(retailComputed.cogsPerMl) },
          ],
          columns: 2,
        },
        {
          title: 'Retail Selling Price Scenarios',
          entries: retailScenarioEntries,
          columns: 2,
        },
        {
          title: 'Bulk Brand Pricing',
          entries: [
            { label: 'Bulk material COGS / ml', value: formatCurrency(bulkComputed.materialCogsPerMl) },
            { label: 'Bulk COGS / liter', value: formatCurrency(bulkComputed.allInBulkCogsPerLiter) },
            ...bulkScenarioEntries,
          ],
          columns: 2,
        },
      ],
    };
  };

  const buildQuotationConfig = () => {
    if (!selectedFormula || !formulaProfile || !selectedQuotationRow) {
      return null;
    }

    const validDays = Math.max(parseNumberInput(quotationInputs.validDays), 0);
    const quoteSummaryEntries = [
      { label: 'Quotation no', value: quotationInputs.quotationNumber || '-' },
      { label: 'Brand', value: quotationInputs.brandName || '-' },
      { label: 'Attention', value: quotationInputs.attentionName || '-' },
      { label: 'Valid for', value: validDays > 0 ? `${validDays} days` : '-' },
      { label: 'Formula', value: `${selectedFormula.name} (${selectedFormula.code})` },
      { label: 'Solvent', value: selectedSolvent?.name || '-' },
      { label: 'Concentration', value: formatPercentage(bulkComputed.concentration) },
      { label: 'Volume', value: `${selectedQuotationRow.volumeValue} ${selectedQuotationRow.volumeUnit}` },
      { label: 'Price / quote', value: formatPrice(selectedQuotationRow.sellPrice) },
      { label: 'COGS / quote', value: formatPrice(selectedQuotationRow.totalCogs) },
      { label: 'COGS / liter', value: formatCurrency(selectedQuotationRow.cogsPerLiter) },
      { label: 'Pricing mode', value: selectedQuotationRow.markupPercent ? `${selectedQuotationRow.markupPercent}% ${bulkScenarios.find((scenario) => scenario.id === selectedQuotationRow.id)?.mode === 'margin' ? 'target margin' : 'markup'}` : '-' },
    ];

    return {
      typeLabel: 'Brand Quotation',
      title: quotationInputs.brandName || selectedFormula.name,
      subtitle: `Quotation for bulk perfume formula supply`,
      summaryEntries: quoteSummaryEntries,
      tableTitle: 'Quotation Details',
      columns: [
        { key: 'item', label: 'Item', width: 70 },
        { key: 'value', label: 'Value', width: 70 },
        { key: 'notes', label: 'Notes', width: 56 },
      ],
      rows: [
        {
          item: 'Formula',
          value: `${selectedFormula.name} (${selectedFormula.code})`,
          notes: 'Perfume concentrate formula',
        },
        {
          item: 'Blend concentration',
          value: formatPercentage(bulkComputed.concentration),
          notes: 'Formula ratio in finished juice',
        },
        {
          item: 'Base solvent',
          value: selectedSolvent?.name || '-',
          notes: 'Main solvent used for this quote',
        },
        {
          item: 'Quote volume',
          value: `${selectedQuotationRow.volumeValue} ${selectedQuotationRow.volumeUnit}`,
          notes: `${formatQuantity(selectedQuotationRow.volumeMl)} ml equivalent`,
        },
        {
          item: 'Selling price',
          value: formatPrice(selectedQuotationRow.sellPrice),
          notes: 'Quoted bulk supply price',
        },
      ],
      footerRows: [
        {
          item: 'TOTAL QUOTATION',
          value: formatPrice(selectedQuotationRow.sellPrice),
          notes: `COGS ${formatPrice(selectedQuotationRow.totalCogs)}`,
        },
      ],
      sections: [
        {
          title: 'Quote Breakdown',
          entries: [
            { label: 'Formula COGS / ml', value: formatCurrency(bulkComputed.formulaCogsPerMl) },
            { label: 'Solvent COGS / ml', value: formatCurrency(bulkComputed.solventCogsPerMl) },
            { label: 'Handling / liter', value: formatCurrency(bulkComputed.handlingCostPerLiter) },
            { label: 'Overhead / liter', value: formatCurrency(bulkComputed.overheadPerLiter) },
            { label: 'Total COGS / quote', value: formatPrice(selectedQuotationRow.totalCogs) },
            { label: 'Quoted margin', value: formatPercentage(selectedQuotationRow.margin) },
          ],
          columns: 2,
        },
        {
          title: 'Commercial Notes',
          body: quotationInputs.notes || 'No additional notes.',
        },
        {
          title: 'Terms',
          body: quotationInputs.terms || 'No additional terms.',
        },
      ],
      notes: 'Generated from Production Costing quotation module.',
    };
  };

  const handleExportPdf = async () => {
    const exportConfig = buildExportConfig();
    if (!exportConfig) {
      toast.error('Choose a formula first');
      return;
    }

    const { exportWorkbookPdf } = await import('@/utils/workbookPdfExport.js');
    exportWorkbookPdf(exportConfig, `${selectedFormula.code || 'production_cost'}_costing.pdf`);
  };

  const handlePrint = async () => {
    const exportConfig = buildExportConfig();
    if (!exportConfig) {
      toast.error('Choose a formula first');
      return;
    }

    const { printWorkbookPdf } = await import('@/utils/workbookPdfExport.js');
    printWorkbookPdf(exportConfig);
  };

  const handleExportQuotationPdf = async () => {
    const exportConfig = buildQuotationConfig();
    if (!exportConfig) {
      toast.error('Choose a formula and quote first');
      return;
    }

    const { exportWorkbookPdf } = await import('@/utils/workbookPdfExport.js');
    exportWorkbookPdf(exportConfig, `${selectedFormula.code || 'quotation'}_brand_quotation.pdf`);
  };

  const handlePrintQuotation = async () => {
    const exportConfig = buildQuotationConfig();
    if (!exportConfig) {
      toast.error('Choose a formula and quote first');
      return;
    }

    const { printWorkbookPdf } = await import('@/utils/workbookPdfExport.js');
    printWorkbookPdf(exportConfig);
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Production Costing - Perfumer Studio</title>
        <meta
          name="description"
          content="Calculate retail bottle COGS and bulk brand pricing from formula concentrate, solvent, packaging, overhead, and manual markup."
        />
      </Helmet>

      <div className="page-container">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4 h-9 gap-2"
          >
            <Home className="h-4 w-4" />
            Back to dashboard
          </Button>
        </div>

        <PageHeader
          title="Production Costing"
          description="Pakai satu halaman untuk dua kebutuhan: costing botol retail dan harga bulk juice ke brand dengan volume quote yang bisa diatur sendiri."
          action="Export PDF"
          actionIcon={Download}
          onAction={handleExportPdf}
          eyebrow="Costing"
        />

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Retail COGS / bottle</div>
                <div className="mt-1 text-2xl font-bold font-mono text-primary">{formatCurrency(retailComputed.costPerBottle)}</div>
                <div className="mt-2 text-xs text-muted-foreground">Finished product all-in cost after materials, packaging, and overhead.</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Bulk COGS / liter</div>
                <div className="mt-1 text-2xl font-bold font-mono">{formatCurrency(bulkComputed.allInBulkCogsPerLiter)}</div>
                <div className="mt-2 text-xs text-muted-foreground">Juice cost for perfumer-to-brand sales, without retail packaging.</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Best retail profit</div>
                <div className="mt-1 text-2xl font-bold font-mono text-primary">{formatCurrency(retailChampion?.profitPerBottle || 0)}</div>
                <div className="mt-2 text-xs text-muted-foreground">{retailChampion?.label || 'Manual retail'} at margin {formatPercentage(retailChampion?.profitMargin || 0)}.</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Best bulk profit</div>
                <div className="mt-1 text-2xl font-bold font-mono text-primary">{formatPrice(bulkChampion?.profit || 0)}</div>
                <div className="mt-2 text-xs text-muted-foreground">{bulkChampion?.label || 'No bulk scenario'} for one pack.</div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  <Label>Main solvent</Label>
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

                <div className="space-y-2">
                  <Label>Concentration %</Label>
                  <Input
                    value={retailInputs.formulaPercentage}
                    onChange={(event) => updateRetailInput('formulaPercentage', event.target.value)}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Print / export</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrint} className="h-9 gap-2">
                      <Printer className="h-4 w-4" />
                      Print
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPdf} className="h-9 gap-2">
                      <Download className="h-4 w-4" />
                      PDF
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-auto w-full justify-start gap-2 rounded-xl bg-muted/50 p-1">
                <TabsTrigger value="retail" className="gap-2 rounded-lg px-4 py-2">
                  <Package2 className="h-4 w-4" />
                  Bottle Costing
                </TabsTrigger>
                <TabsTrigger value="bulk" className="gap-2 rounded-lg px-4 py-2">
                  <Factory className="h-4 w-4" />
                  Bulk / Brand Costing
                </TabsTrigger>
              </TabsList>

              <TabsContent value="retail" className="mt-4 space-y-6">
                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-6">
                    <div className="rounded-xl border bg-card p-5">
                      <div className="mb-5 flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-primary" />
                        <h2 className="text-lg font-semibold">Bottle costing setup</h2>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2">
                          <Label>Target fill volume (ml)</Label>
                          <Input value={retailInputs.totalBatchVolume} onChange={(event) => updateRetailInput('totalBatchVolume', event.target.value)} type="number" min="0" step="0.01" />
                        </div>
                        <div className="space-y-2">
                          <Label>Bottle size (ml)</Label>
                          <Input value={retailInputs.bottleSize} onChange={(event) => updateRetailInput('bottleSize', event.target.value)} type="number" min="0" step="0.01" />
                        </div>
                        <div className="space-y-2">
                          <Label>Production loss %</Label>
                          <Input value={retailInputs.productionLossPercent} onChange={(event) => updateRetailInput('productionLossPercent', event.target.value)} type="number" min="0" max="100" step="0.01" />
                        </div>
                        <div className="space-y-2">
                          <Label>COGS / ml</Label>
                          <Input value={formatQuantity(retailComputed.cogsPerMl, 2)} readOnly />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-xs text-muted-foreground">Required production</div>
                          <div className="mt-1 text-lg font-semibold font-mono">{formatQuantity(retailComputed.requiredProductionVolume)} ml</div>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-xs text-muted-foreground">Formula needed</div>
                          <div className="mt-1 text-lg font-semibold font-mono">{formatQuantity(retailComputed.formulaVolumeNeeded)} ml</div>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-xs text-muted-foreground">Solvent needed</div>
                          <div className="mt-1 text-lg font-semibold font-mono">{formatQuantity(retailComputed.solventVolumeNeeded)} ml</div>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-xs text-muted-foreground">Bottle output</div>
                          <div className="mt-1 text-lg font-semibold font-mono">{retailComputed.bottleCount} bottles</div>
                        </div>
                      </div>

                      <div className="mt-6">
                        <Accordion type="single" collapsible defaultValue={undefined} className="rounded-xl border px-4">
                          <AccordionItem value="packaging" className="border-none">
                            <AccordionTrigger className="py-4 hover:no-underline">
                              <div className="flex flex-1 items-center justify-between gap-4 pr-4">
                                <div className="flex items-center gap-2">
                                  <Package2 className="h-4 w-4 text-primary" />
                                  <div className="text-left">
                                    <div className="text-lg font-semibold">Packaging and overhead</div>
                                    <div className="text-xs text-muted-foreground">Buka saat perlu edit komponen biaya.</div>
                                  </div>
                                </div>
                                <div className="hidden gap-2 md:flex">
                                  <Badge variant="outline">/ bottle {formatCurrency(retailComputed.perBottlePackagingCost)}</Badge>
                                  <Badge variant="outline">packaging {formatPrice(retailComputed.totalPackagingCost)}</Badge>
                                  <Badge variant="outline">overhead {formatPrice(retailComputed.totalBatchOverhead)}</Badge>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-1">
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                {PACKAGING_FIELDS.map((field) => (
                                  <div key={field.key} className="space-y-1.5">
                                    <Label>
                                      {field.label}
                                      <span className="ml-1 text-xs text-muted-foreground">
                                        {field.kind === 'unit' ? '/ bottle' : '/ batch'}
                                      </span>
                                    </Label>
                                    <Input value={retailInputs[field.key]} onChange={(event) => updateRetailInput(field.key, event.target.value)} type="number" min="0" step="0.01" />
                                  </div>
                                ))}
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-lg border bg-muted/30 p-4">
                                  <div className="text-xs text-muted-foreground">Packaging / bottle</div>
                                  <div className="mt-1 text-lg font-semibold font-mono">{formatCurrency(retailComputed.perBottlePackagingCost)}</div>
                                </div>
                                <div className="rounded-lg border bg-muted/30 p-4">
                                  <div className="text-xs text-muted-foreground">Total packaging</div>
                                  <div className="mt-1 text-lg font-semibold font-mono">{formatPrice(retailComputed.totalPackagingCost)}</div>
                                </div>
                                <div className="rounded-lg border bg-muted/30 p-4">
                                  <div className="text-xs text-muted-foreground">Batch overhead</div>
                                  <div className="mt-1 text-lg font-semibold font-mono">{formatPrice(retailComputed.totalBatchOverhead)}</div>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-xl border bg-card p-5">
                      <div className="mb-4 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-4 w-4 text-primary" />
                          <h2 className="text-lg font-semibold">Retail summary</h2>
                        </div>
                        <Button variant="outline" size="sm" onClick={handlePrint} className="h-9 gap-2">
                          <Printer className="h-4 w-4" />
                          Print
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-xs text-muted-foreground">COGS / bottle</div>
                          <div className="mt-1 text-2xl font-bold font-mono text-primary">{formatCurrency(retailComputed.costPerBottle)}</div>
                          <div className="mt-2 text-xs text-muted-foreground">All-in finished bottle cost.</div>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-xs text-muted-foreground">COGS per ml</div>
                          <div className="mt-1 text-2xl font-bold font-mono">{formatCurrency(retailComputed.cogsPerMl)}</div>
                          <div className="mt-2 text-xs text-muted-foreground">Based on target finished stock volume.</div>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-xs text-muted-foreground">Bottle output</div>
                          <div className="mt-1 text-2xl font-bold">{retailComputed.bottleCount}</div>
                          <div className="mt-2 text-xs text-muted-foreground">Remaining {formatQuantity(retailComputed.remainingVolume)} ml.</div>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-xs text-muted-foreground">Total production cost</div>
                          <div className="mt-1 text-2xl font-bold font-mono">{formatPrice(retailComputed.totalProductionCost)}</div>
                          <div className="mt-2 text-xs text-muted-foreground">Material, packaging, and batch overhead.</div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3 rounded-lg border p-4 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Formula material cost</span>
                          <span className="font-mono">{formatPrice(retailComputed.formulaMaterialCost)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Solvent cost</span>
                          <span className="font-mono">{formatPrice(retailComputed.solventMaterialCost)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Total packaging</span>
                          <span className="font-mono">{formatPrice(retailComputed.totalPackagingCost)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Batch overhead</span>
                          <span className="font-mono">{formatPrice(retailComputed.totalBatchOverhead)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border bg-card p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <Store className="h-4 w-4 text-primary" />
                        <h2 className="text-lg font-semibold">Manual pricing</h2>
                      </div>

                      {retailScenarios.map((scenario) => {
                        const scenarioResult = retailComputed.scenarioResults.find((item) => item.id === scenario.id);
                        return (
                          <div key={scenario.id} className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="space-y-1.5">
                                <Label>Channel name</Label>
                                <Input value={scenario.label} onChange={(event) => updateRetailScenario(scenario.id, 'label', event.target.value)} placeholder="Isi manual" />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Mode</Label>
                                <Select value={scenario.mode} onValueChange={(value) => updateRetailScenario(scenario.id, 'mode', value)}>
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="markup">Markup from COGS</SelectItem>
                                    <SelectItem value="margin">Target net margin</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label>{scenario.mode === 'markup' ? 'Markup %' : 'Target margin %'}</Label>
                                <Input value={scenario.percent} onChange={(event) => updateRetailScenario(scenario.id, 'percent', event.target.value)} type="number" min="0" max="1000" step="0.01" />
                              </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label>Channel fee %</Label>
                                <Input value={scenario.feePercent} onChange={(event) => updateRetailScenario(scenario.id, 'feePercent', event.target.value)} type="number" min="0" max="100" step="0.01" />
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <div className="rounded-lg bg-muted/30 p-3">
                                <div className="text-xs text-muted-foreground">Sell price / bottle</div>
                                <div className="mt-1 font-mono text-lg font-semibold text-primary">{formatCurrency(scenarioResult?.salePrice || 0)}</div>
                              </div>
                              <div className="rounded-lg bg-muted/30 p-3">
                                <div className="text-xs text-muted-foreground">Net profit / bottle</div>
                                <div className="mt-1 font-mono text-lg font-semibold">{formatCurrency(scenarioResult?.profitPerBottle || 0)}</div>
                              </div>
                              <div className="rounded-lg bg-muted/30 p-3">
                                <div className="text-xs text-muted-foreground">Batch profit</div>
                                <div className="mt-1 font-mono text-lg font-semibold">{formatPrice(scenarioResult?.batchProfit || 0)}</div>
                              </div>
                              <div className="rounded-lg bg-muted/30 p-3">
                                <div className="text-xs text-muted-foreground">Net margin</div>
                                <div className="mt-1 font-mono text-lg font-semibold">{formatPercentage(scenarioResult?.profitMargin || 0)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="bulk" className="mt-4 space-y-6">
                <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                  <div className="space-y-6">
                    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                      <div className="rounded-xl border bg-card p-5">
                      <div className="mb-5 flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-primary" />
                        <h2 className="text-lg font-semibold">Bulk juice COGS</h2>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Bulk loss %</Label>
                          <Input value={bulkInputs.productionLossPercent} onChange={(event) => updateBulkInput('productionLossPercent', event.target.value)} type="number" min="0" max="100" step="0.01" />
                        </div>
                        <div className="space-y-2">
                          <Label>Handling cost / liter</Label>
                          <Input value={bulkInputs.handlingCostPerLiter} onChange={(event) => updateBulkInput('handlingCostPerLiter', event.target.value)} type="number" min="0" step="0.01" />
                        </div>
                        <div className="space-y-2">
                          <Label>Bulk overhead / liter</Label>
                          <Input value={bulkInputs.bulkOverheadCost} onChange={(event) => updateBulkInput('bulkOverheadCost', event.target.value)} type="number" min="0" step="0.01" />
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-xs text-muted-foreground">Formula COGS / ml</div>
                          <div className="mt-1 text-lg font-semibold font-mono">{formatCurrency(bulkComputed.formulaCogsPerMl)}</div>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-xs text-muted-foreground">Solvent COGS / ml</div>
                          <div className="mt-1 text-lg font-semibold font-mono">{formatCurrency(bulkComputed.solventCogsPerMl)}</div>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-xs text-muted-foreground">Material COGS / ml</div>
                          <div className="mt-1 text-lg font-semibold font-mono">{formatCurrency(bulkComputed.materialCogsPerMl)}</div>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-xs text-muted-foreground">All-in COGS / liter</div>
                          <div className="mt-1 text-lg font-semibold font-mono text-primary">{formatCurrency(bulkComputed.allInBulkCogsPerLiter)}</div>
                        </div>
                      </div>

                      <div className="mt-5 rounded-lg border p-4 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Concentration</span>
                          <span className="font-mono">{formatPercentage(bulkComputed.concentration)}</span>
                        </div>
                        <div className="mt-2 flex justify-between gap-4">
                          <span className="text-muted-foreground">Loss allowance</span>
                          <span className="font-mono">{formatPercentage(bulkComputed.lossPercent)}</span>
                        </div>
                        <div className="mt-2 flex justify-between gap-4">
                          <span className="text-muted-foreground">Handling / liter</span>
                          <span className="font-mono">{formatCurrency(bulkComputed.handlingCostPerLiter)}</span>
                        </div>
                        <div className="mt-2 flex justify-between gap-4">
                          <span className="text-muted-foreground">Overhead / liter</span>
                          <span className="font-mono">{formatCurrency(bulkComputed.overheadPerLiter)}</span>
                        </div>
                      </div>
                      </div>

                      <div className="rounded-xl border bg-card p-5">
                      <div className="mb-5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Factory className="h-4 w-4 text-primary" />
                          <h2 className="text-lg font-semibold">Brand pricing markup</h2>
                        </div>
                        <Button type="button" variant="outline" size="sm" className="h-9 gap-2" onClick={addBulkScenario}>
                          <Plus className="h-4 w-4" />
                          Add quote
                        </Button>
                      </div>

                      <Accordion
                        type="single"
                        collapsible
                        defaultValue={bulkScenarios[0]?.id}
                        className="rounded-xl border px-4"
                      >
                        {bulkScenarios.map((scenario, index) => {
                          const result = bulkComputed.rows[index];
                          return (
                            <AccordionItem key={scenario.id} value={scenario.id}>
                              <AccordionTrigger className="py-4 hover:no-underline">
                                <div className="flex flex-1 items-center justify-between gap-4 pr-4">
                                  <div className="text-left">
                                    <div className="text-sm font-medium">Quote {index + 1}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {scenario.volumeValue || '0'} {scenario.volumeUnit || 'ml'}
                                    </div>
                                  </div>
                                  <div className="hidden gap-2 md:flex">
                                    <Badge variant="outline">COGS {formatPrice(result?.totalCogs || 0)}</Badge>
                                    <Badge variant="outline">Sell {formatPrice(result?.sellPrice || 0)}</Badge>
                                    <Badge variant="outline">Profit {formatPrice(result?.profit || 0)}</Badge>
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-2 px-2"
                                    onClick={() => removeBulkScenario(scenario.id)}
                                    disabled={bulkScenarios.length <= 1}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Remove
                                  </Button>
                                </div>

                                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_120px_180px_1fr]">
                                  <div className="space-y-1.5">
                                    <Label>Volume quote</Label>
                                    <Input value={scenario.volumeValue} onChange={(event) => updateBulkScenario(scenario.id, 'volumeValue', event.target.value)} type="number" min="0" step="0.01" />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label>Unit</Label>
                                    <Select value={scenario.volumeUnit} onValueChange={(value) => updateBulkScenario(scenario.id, 'volumeUnit', value)}>
                                      <SelectTrigger className="h-9">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="ml">ml</SelectItem>
                                        <SelectItem value="liter">liter</SelectItem>
                                        <SelectItem value="gram">gram</SelectItem>
                                        <SelectItem value="kg">kg</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label>Mode</Label>
                                    <Select value={scenario.mode} onValueChange={(value) => updateBulkScenario(scenario.id, 'mode', value)}>
                                      <SelectTrigger className="h-9">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="markup">Markup from COGS</SelectItem>
                                        <SelectItem value="margin">Target net margin</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label>{scenario.mode === 'markup' ? 'Markup %' : 'Target margin %'}</Label>
                                    <Input value={scenario.percent} onChange={(event) => updateBulkScenario(scenario.id, 'percent', event.target.value)} type="number" min="0" max="1000" step="0.01" />
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                  <div className="rounded-lg bg-muted/30 p-3">
                                    <div className="text-[11px] text-muted-foreground">Volume</div>
                                    <div className="mt-1 font-mono text-base font-semibold">
                                      {scenario.volumeValue || '0'} {scenario.volumeUnit || 'ml'}
                                    </div>
                                  </div>
                                  <div className="rounded-lg bg-muted/30 p-3">
                                    <div className="text-[11px] text-muted-foreground">COGS</div>
                                    <div className="mt-1 font-mono text-base font-semibold">{formatPrice(result?.totalCogs || 0)}</div>
                                  </div>
                                  <div className="rounded-lg bg-muted/30 p-3">
                                    <div className="text-[11px] text-muted-foreground">Sell price</div>
                                    <div className="mt-1 font-mono text-base font-semibold text-primary">{formatPrice(result?.sellPrice || 0)}</div>
                                  </div>
                                  <div className="rounded-lg bg-muted/30 p-3">
                                    <div className="text-[11px] text-muted-foreground">Profit</div>
                                    <div className="mt-1 font-mono text-base font-semibold">{formatPrice(result?.profit || 0)}</div>
                                  </div>
                                </div>

                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline">Margin {formatPercentage(result?.margin || 0)}</Badge>
                                  <Badge variant="outline">COGS / liter {formatCurrency(result?.cogsPerLiter || 0)}</Badge>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-xl border bg-card p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-4 w-4 text-primary" />
                          <h2 className="text-lg font-semibold">Quote summary</h2>
                        </div>
                        <Dialog open={quotationOpen} onOpenChange={setQuotationOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" className="h-9 gap-2">
                              <Printer className="h-4 w-4" />
                              Open quotation
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-6">
                            <DialogHeader>
                              <DialogTitle>Brand quotation</DialogTitle>
                              <DialogDescription>
                                Siapkan quotation yang langsung bisa di-print atau di-export PDF untuk brand.
                              </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Quotation number</Label>
                                <Input value={quotationInputs.quotationNumber} onChange={(event) => updateQuotationInput('quotationNumber', event.target.value)} placeholder="QT-001" />
                              </div>
                              <div className="space-y-2">
                                <Label>Brand name</Label>
                                <Input value={quotationInputs.brandName} onChange={(event) => updateQuotationInput('brandName', event.target.value)} placeholder="Client brand" />
                              </div>
                              <div className="space-y-2">
                                <Label>Attention / PIC</Label>
                                <Input value={quotationInputs.attentionName} onChange={(event) => updateQuotationInput('attentionName', event.target.value)} placeholder="Contact person" />
                              </div>
                              <div className="space-y-2">
                                <Label>Quote validity (days)</Label>
                                <Input value={quotationInputs.validDays} onChange={(event) => updateQuotationInput('validDays', event.target.value)} type="number" min="0" step="1" />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label>Use quote</Label>
                                <Select value={quotationInputs.selectedScenarioId} onValueChange={(value) => updateQuotationInput('selectedScenarioId', value)}>
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select quote" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {bulkComputed.rows.map((row, index) => (
                                      <SelectItem key={row.id} value={row.id}>
                                        Quote {index + 1} - {row.volumeValue || '0'} {row.volumeUnit} - {formatPrice(row.sellPrice)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label>Quotation notes</Label>
                                <Textarea value={quotationInputs.notes} onChange={(event) => updateQuotationInput('notes', event.target.value)} rows={3} />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label>Terms</Label>
                                <Textarea value={quotationInputs.terms} onChange={(event) => updateQuotationInput('terms', event.target.value)} rows={3} />
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <div className="rounded-lg bg-muted/30 p-3">
                                <div className="text-xs text-muted-foreground">Selected formula</div>
                                <div className="mt-1 font-medium">{selectedFormula?.name || '-'}</div>
                              </div>
                              <div className="rounded-lg bg-muted/30 p-3">
                                <div className="text-xs text-muted-foreground">Quoted volume</div>
                                <div className="mt-1 font-mono text-lg font-semibold">
                                  {selectedQuotationRow ? `${selectedQuotationRow.volumeValue} ${selectedQuotationRow.volumeUnit}` : '-'}
                                </div>
                              </div>
                              <div className="rounded-lg bg-muted/30 p-3">
                                <div className="text-xs text-muted-foreground">Quoted price</div>
                                <div className="mt-1 font-mono text-lg font-semibold text-primary">{formatPrice(selectedQuotationRow?.sellPrice || 0)}</div>
                              </div>
                              <div className="rounded-lg bg-muted/30 p-3">
                                <div className="text-xs text-muted-foreground">Validity</div>
                                <div className="mt-1 font-medium">{quotationInputs.validDays || '0'} days</div>
                              </div>
                            </div>

                            <div className="flex flex-wrap justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={handlePrintQuotation} className="h-9 gap-2">
                                <Printer className="h-4 w-4" />
                                Print
                              </Button>
                              <Button variant="outline" size="sm" onClick={handleExportQuotationPdf} className="h-9 gap-2">
                                <Download className="h-4 w-4" />
                                PDF
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>

                      <div className="space-y-2 rounded-lg border p-4">
                        {bulkComputed.rows.map((row, index) => (
                          <div key={row.id} className="flex items-start justify-between gap-4 border-b pb-2 last:border-b-0 last:pb-0">
                            <div>
                              <div className="font-medium">Quote {index + 1}</div>
                              <div className="text-xs text-muted-foreground">{row.volumeValue || '0'} {row.volumeUnit || 'ml'}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-sm">{formatPrice(row.totalCogs)}</div>
                              <div className="text-xs text-muted-foreground">Sell {formatPrice(row.sellPrice)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border bg-card p-5">
                      <h2 className="text-lg font-semibold">When to use this tab</h2>
                      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                        <p>
                          Use <strong>Bulk / Brand Costing</strong> when you sell perfume juice to another brand in custom pack sizes, without retail bottle packaging.
                        </p>
                        <p>
                          This tab focuses on COGS for <strong>formula concentrate + solvent + loss + bulk handling</strong>, then applies a markup or target margin.
                        </p>
                        <p>
                          It helps you quote faster as a perfumer when a client asks how much a custom order volume will cost, then you can set the markup directly.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default ProductionCostPage;
