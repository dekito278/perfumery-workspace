import { buildWorkbookSimulation } from '@/utils/formulaWorkbookSimulation.js';

const DEFAULT_DECAY_SAMPLES = [0, 1, 3, 6, 12, 24, 48, 72, 120, 168, 240];

const toFiniteNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeLabel = (value, fallback) => {
  const text = String(value || '').trim();
  return text || fallback;
};

const accumulate = (map, key, amount) => {
  if (!amount) {
    return;
  }

  map.set(key, (map.get(key) || 0) + amount);
};

const resolveDecayLifetime = (row) => {
  const lifeHours = toFiniteNumber(row.lifeHours);
  if (lifeHours !== null && lifeHours > 0) {
    return lifeHours;
  }

  if (row.pyramidPlacement === 'top') {
    return 12;
  }

  if (row.pyramidPlacement === 'base') {
    return 240;
  }

  return 72;
};

const buildFacetAndFamilyData = (rows) => {
  const facetTotals = new Map();
  const familyTotals = new Map();

  rows.forEach((row) => {
    const referenceProfile = row.reference_profile;
    const effectiveLoad = Number(row.effectiveActiveGrams || 0);
    const facets = Array.isArray(referenceProfile?.odour_facets) ? referenceProfile.odour_facets : [];

    if (facets.length) {
      facets.forEach((facet) => {
        const facetStrength = Math.max(Number(facet.value || 0), 0);
        if (!facetStrength) {
          return;
        }

        const normalizedWeight = effectiveLoad * (facetStrength / 100);
        accumulate(
          facetTotals,
          normalizeLabel(facet.letter, normalizeLabel(facet.family, 'Facet')),
          normalizedWeight
        );
        accumulate(
          familyTotals,
          normalizeLabel(facet.family, referenceProfile?.abc_primary_family || 'Unclassified'),
          normalizedWeight
        );
      });
      return;
    }

    accumulate(
      familyTotals,
      normalizeLabel(referenceProfile?.abc_primary_family, row.component_family || row.scent_family || 'Unclassified'),
      effectiveLoad
    );
  });

  const facetEntries = [...facetTotals.entries()].sort((left, right) => right[1] - left[1]);
  const totalFacetWeight = facetEntries.reduce((sum, [, value]) => sum + value, 0);
  const familyEntries = [...familyTotals.entries()].sort((left, right) => right[1] - left[1]);
  const totalFamilyWeight = familyEntries.reduce((sum, [, value]) => sum + value, 0);

  return {
    odourFacetData: facetEntries.slice(0, 8).map(([facet, weight]) => ({
      facet,
      weight,
      percent: totalFacetWeight > 0 ? (weight / totalFacetWeight) * 100 : 0,
    })),
    familyData: familyEntries.slice(0, 8).map(([family, weight]) => ({
      family,
      weight,
      percent: totalFamilyWeight > 0 ? (weight / totalFamilyWeight) * 100 : 0,
    })),
  };
};

const buildDecayData = (rows) => {
  const maxLifetime = rows.reduce((max, row) => Math.max(max, resolveDecayLifetime(row)), 0);
  const samples = DEFAULT_DECAY_SAMPLES.filter((hour) => hour <= Math.max(240, Math.ceil(maxLifetime)));
  if (!samples.includes(0)) {
    samples.unshift(0);
  }

  return samples.map((hour) => {
    const bucketValues = rows.reduce((accumulator, row) => {
      const lifetime = resolveDecayLifetime(row);
      const sourceAmount = Number(row.effectiveActiveGrams || 0);
      const bucket = row.pyramidPlacement || 'middle';
      const remainingShare = lifetime > 0
        ? Math.exp(Math.log(0.05) * (hour / lifetime))
        : 0;
      const value = sourceAmount * remainingShare;

      accumulator[bucket] += value;
      return accumulator;
    }, { top: 0, middle: 0, base: 0 });

    return {
      hour,
      label: hour === 0 ? '0h' : `${hour}h`,
      top: bucketValues.top,
      middle: bucketValues.middle,
      base: bucketValues.base,
      total: bucketValues.top + bucketValues.middle + bucketValues.base,
    };
  });
};

export const buildFormulaSensoryCharts = ({ items, rawMaterialsById, referenceLinksMap }) => {
  const simulation = buildWorkbookSimulation({ items, rawMaterialsById, referenceLinksMap });
  const linkedRows = simulation.rows.filter((row) => row.reference_profile);
  const { odourFacetData, familyData } = buildFacetAndFamilyData(linkedRows);
  const decayData = buildDecayData(linkedRows);
  const dominantFacet = odourFacetData[0] || null;
  const dominantFamily = familyData[0] || null;
  const openingProfile = decayData[0] || null;
  const finishProfile = decayData[decayData.length - 1] || null;

  return {
    simulation,
    odourFacetData,
    familyData,
    decayData,
    dominantFacet,
    dominantFamily,
    openingProfile,
    finishProfile,
  };
};
