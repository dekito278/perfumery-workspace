import { buildWorkbookSimulation } from '@/utils/formulaWorkbookSimulation.js';
import { extractWorkbookClassDistribution } from '@/utils/workbookAbcClassification.js';

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

const accumulateContributor = (map, key, contributor) => {
  if (!map.has(key)) {
    map.set(key, []);
  }

  map.get(key).push(contributor);
};

const resolveReferenceFacets = (referenceProfile) => {
  const explicitFacets = Array.isArray(referenceProfile?.odour_facets) ? referenceProfile.odour_facets : [];
  if (explicitFacets.length) {
    return explicitFacets;
  }

  const workbookClassDistribution = extractWorkbookClassDistribution(referenceProfile);
  if (!workbookClassDistribution.length) {
    return [];
  }

  return workbookClassDistribution.map((entry, index) => ({
    letter: entry.letter,
    family: entry.familyName,
    value: Number(entry.share || 0),
    description: entry.description || null,
    sort_order: index,
    source: entry.source || 'workbook_class_distribution',
  }));
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

const resolveRemainingShareAtHour = (row, hour) => {
  const lifetime = resolveDecayLifetime(row);
  if (lifetime <= 0) {
    return 0;
  }

  return Math.exp(Math.log(0.05) * (hour / lifetime));
};

const buildFacetAndFamilyData = (rows) => {
  const facetTotals = new Map();
  const familyTotals = new Map();

  rows.forEach((row) => {
    const referenceProfile = row.reference_profile;
    const odourWeight = Number(row.odourWeight || 0);
    const facets = resolveReferenceFacets(referenceProfile);

    if (facets.length) {
      facets.forEach((facet) => {
        const facetStrength = Math.max(Number(facet.value || 0), 0);
        if (!facetStrength) {
          return;
        }

        const normalizedWeight = odourWeight * (facetStrength / 100);
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
      odourWeight
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

const buildWorkbookClassData = (rows) => {
  const classTotals = new Map();
  const contributorMap = new Map();

  rows.forEach((row) => {
    const odourWeight = Number(row.odourWeight || 0);
    if (!odourWeight) {
      return;
    }

    const classDistribution = Array.isArray(row.classDistribution) && row.classDistribution.length
      ? row.classDistribution
      : extractWorkbookClassDistribution(row.reference_profile);

    classDistribution.forEach((entry) => {
      const classWeight = odourWeight * (Number(entry.share || 0) / 100);
      if (!classWeight) {
        return;
      }

      accumulate(classTotals, entry.classIndex, classWeight);
      accumulateContributor(contributorMap, entry.classIndex, {
        name: row.name,
        referenceCode: row.reference_profile?.reference_code || null,
        weight: classWeight,
      });
    });
  });

  const classEntries = [...classTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([classIndex, weight]) => {
      const rowClass = rows
        .flatMap((row) => row.classDistribution || [])
        .find((entry) => entry.classIndex === classIndex);
      return {
        ...rowClass,
        weight,
        contributors: (contributorMap.get(classIndex) || [])
          .sort((left, right) => right.weight - left.weight)
          .slice(0, 3),
      };
    });

  const totalWeight = classEntries.reduce((sum, entry) => sum + entry.weight, 0);
  return classEntries.map((entry) => ({
    ...entry,
    percent: totalWeight > 0 ? (entry.weight / totalWeight) * 100 : 0,
    label: entry.familyName,
  }));
};

const buildWorkbookClassDataAtHour = (rows, hour = 0) => {
  const elapsedHour = Math.max(Number(hour) || 0, 0);
  const elapsedRows = rows.map((row) => ({
    ...row,
    odourWeight: Number(row.odourWeight || 0) * resolveRemainingShareAtHour(row, elapsedHour),
  }));

  return buildWorkbookClassData(elapsedRows);
};

const buildDecayPoint = (rows, hour) => {
  const bucketValues = rows.reduce((accumulator, row) => {
    const sourceAmount = Number(row.odourWeight || 0);
    const bucket = row.pyramidPlacement || 'middle';
    const value = sourceAmount * resolveRemainingShareAtHour(row, hour);

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
};

const buildDecayData = (rows, maxElapsedHour) => {
  const sampledHours = DEFAULT_DECAY_SAMPLES.filter((hour) => hour <= maxElapsedHour);
  const samples = sampledHours.includes(0) ? sampledHours : [0, ...sampledHours];

  if (!samples.includes(maxElapsedHour)) {
    samples.push(maxElapsedHour);
  }

  return samples
    .sort((left, right) => left - right)
    .map((hour) => buildDecayPoint(rows, Math.max(Math.round(hour), 0)));
};

const buildClassDistributionTimeline = (rows, maxElapsedHour) => (
  Array.from({ length: maxElapsedHour + 1 }, (_, hour) => ({
    hour,
    label: hour === 0 ? '0h' : `${hour}h`,
    classes: buildWorkbookClassDataAtHour(rows, hour),
  }))
);

export const buildFormulaSensoryCharts = ({ items, rawMaterialsById, referenceLinksMap }) => {
  const simulation = buildWorkbookSimulation({ items, rawMaterialsById, referenceLinksMap });
  const linkedRows = simulation.rows.filter((row) => row.reference_profile);
  const { odourFacetData, familyData } = buildFacetAndFamilyData(linkedRows);
  const classDistributionData = buildWorkbookClassData(linkedRows);
  const maxElapsedHour = Math.max(
    0,
    Math.round(
      toFiniteNumber(simulation.simpleLifeHours)
      || linkedRows.reduce((max, row) => Math.max(max, resolveDecayLifetime(row)), 0)
      || 0
    ),
  );
  const classDistributionTimeline = buildClassDistributionTimeline(linkedRows, maxElapsedHour);
  const decayTimeline = classDistributionTimeline.map((entry) => buildDecayPoint(linkedRows, entry.hour));
  const decayData = buildDecayData(linkedRows, maxElapsedHour);
  const fallbackFacetData = odourFacetData.length
    ? odourFacetData
    : familyData.map((entry) => ({
        facet: entry.family,
        weight: entry.weight,
        percent: entry.percent,
        source: 'family',
      }));
  const dominantFacet = fallbackFacetData[0] || null;
  const dominantFamily = familyData[0] || null;
  const dominantClass = classDistributionData[0] || null;
  const openingProfile = decayTimeline[0] || null;
  const finishProfile = decayTimeline[decayTimeline.length - 1] || null;

  return {
    simulation,
    odourFacetData,
    fallbackFacetData,
    familyData,
    classDistributionData,
    classDistributionTimeline,
    maxElapsedHour,
    decayData,
    decayTimeline,
    dominantFacet,
    dominantFamily,
    dominantClass,
    openingProfile,
    finishProfile,
    hasWorkbookFacetData: odourFacetData.length > 0,
  };
};
