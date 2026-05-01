export const DEFAULT_RETAIL_INPUTS = {
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

export const DEFAULT_BULK_INPUTS = {
  productionLossPercent: '3',
  handlingCostPerLiter: '0',
  bulkOverheadCost: '0',
};

export const DEFAULT_RETAIL_SCENARIOS = [
  { id: 'manual-retail', label: '', mode: 'markup', percent: '', feePercent: '0' },
];

export const DEFAULT_BULK_SCENARIOS = [
  { id: 'bulk-quote-default', label: '', mode: 'markup', percent: '30', volumeValue: '', volumeUnit: 'ml' },
];

export const DEFAULT_QUOTATION_INPUTS = {
  quotationNumber: '',
  brandName: '',
  attentionName: '',
  validDays: '14',
  selectedScenarioId: '',
  notes: 'Formula, concentration, and price follow the selected quote.',
  terms: 'Price excludes customized packaging, tax, and shipping unless stated otherwise.',
};

export const PACKAGING_FIELDS = [
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

const LOCAL_STORAGE_PREFIX = 'production-costing-v4';

export const parseNumberInput = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const clampPercentage = (value, max = 100) => Math.min(Math.max(value, 0), max);

const createScenarioId = () => `bulk-quote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createBulkScenario = () => ({
  id: createScenarioId(),
  label: '',
  mode: 'markup',
  percent: '30',
  volumeValue: '',
  volumeUnit: 'ml',
});

const buildStorageKey = (formulaId) => `${LOCAL_STORAGE_PREFIX}:${formulaId}`;

export const readLocalScenario = (formulaId) => {
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

export const writeLocalScenario = (formulaId, payload) => {
  if (!formulaId || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(buildStorageKey(formulaId), JSON.stringify(payload));
  } catch {
    // Keep the page usable even when browser storage fails.
  }
};

export const createDefaultRetailInputs = (formula) => ({
  ...DEFAULT_RETAIL_INPUTS,
  bottleCost: String(Number(formula?.bottle_cost || 0)),
  capCost: String(Number(formula?.cap_cost || 0)),
  packagingCost: String(Number(formula?.packaging_cost || 0)),
});

export const createDefaultRetailScenarios = () => DEFAULT_RETAIL_SCENARIOS.map((scenario) => ({ ...scenario }));
export const createDefaultBulkScenarios = () => DEFAULT_BULK_SCENARIOS.map((scenario) => ({ ...scenario }));
export const createDefaultQuotationInputs = () => ({ ...DEFAULT_QUOTATION_INPUTS });

export const normalizeBulkScenario = (scenario, fallbackScenario) => ({
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

export const convertToMl = (value, unit) => {
  const parsedValue = Math.max(parseNumberInput(value), 0);
  if (unit === 'liter' || unit === 'kg') {
    return parsedValue * 1000;
  }
  return unit === 'gram' ? parsedValue : parsedValue;
};

export const buildPackagingLineItems = (inputs, bottleCount) => {
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

export const buildBulkRow = ({
  id,
  label,
  volumeValue,
  volumeUnit,
  materialCogsPerMl,
  handlingCostPerLiter,
  overheadPerLiter,
  bulkScenario,
}) => {
  const safeVolumeMl = convertToMl(volumeValue, volumeUnit);
  const totalCogs = (materialCogsPerMl * safeVolumeMl) + ((handlingCostPerLiter + overheadPerLiter) * (safeVolumeMl / 1000));
  const markupPercent = clampPercentage(parseNumberInput(bulkScenario.percent), 1000);
  const sellPrice = bulkScenario.mode === 'margin'
    ? (markupPercent >= 100 ? 0 : (totalCogs / Math.max(1 - (markupPercent / 100), 0.0001)))
    : totalCogs * (1 + (markupPercent / 100));
  const profit = sellPrice - totalCogs;
  const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;

  return {
    id,
    label,
    volumeValue,
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
