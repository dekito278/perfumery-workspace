import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { buildWorkbookSimulation } from '@/utils/formulaWorkbookSimulation.js';

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const roundMetric = (value, digits = 1) => {
  const number = toFiniteNumber(value);
  if (number === null) return null;
  return Number(number.toFixed(digits));
};

const formatMetric = (value, suffix = '') => {
  const number = toFiniteNumber(value);
  if (number === null) return '-';
  return `${number}${suffix}`;
};

export const buildFormulaReferenceLinksMap = (items = [], referenceStatusMap = new Map()) => new Map(
  (items || [])
    .map((item) => [item.item_id, referenceStatusMap.get(item.item_id)])
    .filter(([, link]) => Boolean(link))
);

export const getFormulaLifetimeHours = (simulation = {}) => (
  simulation.odourWeightedLifeHours ?? simulation.simpleLifeHours ?? null
);

export const buildMobileFormulaMetrics = ({
  items = [],
  rawMaterialsById = new Map(),
  referenceLinksMap = new Map(),
} = {}) => {
  const simulation = buildWorkbookSimulation({ items, rawMaterialsById, referenceLinksMap });
  const impactScore = simulation.hasImpactData ? roundMetric(simulation.impactEstimate, 1) : null;
  const lifetimeHours = simulation.hasLifeData ? roundMetric(getFormulaLifetimeHours(simulation), 1) : null;
  const paceScore = roundMetric(
    simulation.pace?.harmonyScore
    ?? simulation.pace?.smoothnessScore
    ?? simulation.coveragePercent,
    0
  );

  return {
    itemCount: items.length,
    totalGrams: calculateTotalAmount(items),
    impactScore,
    impactDisplay: formatMetric(impactScore),
    lifetimeScore: lifetimeHours,
    lifetimeDisplay: formatMetric(lifetimeHours, lifetimeHours === null ? '' : 'h'),
    paceScore,
    coveragePercent: roundMetric(simulation.coveragePercent, 0),
    guidanceBackedCount: simulation.guidanceBackedCount || 0,
    missingGuidanceCount: simulation.missingGuidanceCount || 0,
    warningCount: simulation.warningCount || 0,
    simulation,
  };
};
