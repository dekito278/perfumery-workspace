// `node src/utils/formulaPaceRecommendations.selfcheck.mjs`
//
// The engine behind "Revision suggestions" on the workbook panel: given a PACE simulation it names one
// or two gram moves, and "Create PACED revision" writes those moves into a new formula. So this is not
// advice a perfumer reads and weighs — it is the input to a database row.
//
// It lived inside FormulaWorkbookSimulationPanel.jsx (1346 lines), where no selfcheck could run it, for
// the same reason SCORE_BANDS and PACE_TARGETS had to be lifted out into paceScoreBands.js. Two defects
// were sitting in it, both of which the guard beside this file now holds shut.
import { formatGramAmount } from '@/utils/formatting.js';
import { resolveMaterialCompositionProfile } from '@/utils/materialCompositionProfile.js';
import { PACE_TARGETS } from '@/utils/paceScoreBands.js';

const sortRowsByWeight = (rows) => (
  [...rows].sort((left, right) => Number(right.odourWeight || 0) - Number(left.odourWeight || 0))
);

const averageValues = (values) => {
  const numericValues = values.filter((value) => Number.isFinite(value));
  if (!numericValues.length) {
    return 0;
  }

  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
};

const getTargetGap = (value, target) => Math.max(Number(target || 0) - Number(value || 0), 0);

const isFormulaInHealthyPaceRange = (simulation) => {
  const pace = simulation.pace || {};

  return (
    pace.openingScore >= PACE_TARGETS.opening
    && pace.heartScore >= PACE_TARGETS.heart
    && pace.drydownScore >= PACE_TARGETS.drydown
    && pace.diffusionScore >= PACE_TARGETS.diffusion
    && pace.tenacityScore >= PACE_TARGETS.tenacity
    && pace.harmonyScore >= PACE_TARGETS.harmony
    && pace.smoothnessScore >= PACE_TARGETS.smoothness
    && pace.bridgeQualityScore >= PACE_TARGETS.bridgeQuality
    && !simulation.ifraAdvisories?.length
  );
};

export const buildFrameworkObjectives = (simulation) => {
  const pace = simulation.pace || {};

  return {
    balance: averageValues([
      pace.openingScore,
      pace.heartScore,
      pace.harmonyScore,
      pace.smoothnessScore,
      pace.bridgeQualityScore,
      pace.balanceScore,
    ]),
    projection: averageValues([
      pace.diffusionScore,
      pace.openingScore,
      pace.impactSignal,
      pace.topMiddleBridgeScore,
    ]),
    longevity: averageValues([
      pace.drydownScore,
      pace.tenacityScore,
      pace.lifeSignal,
      simulation.basePercent,
    ]),
  };
};

const FUNCTION_PRIORITY_BY_OBJECTIVE = {
  balance: {
    bridge: 8,
    blender: 7,
    support: 6,
    modifier: 3,
    fixative: 1,
    diffuser: -2,
    hero: -3,
  },
  projection: {
    diffuser: 8,
    modifier: 5,
    support: 3,
    bridge: 2,
    hero: 1,
    blender: 1,
    fixative: -2,
  },
  longevity: {
    fixative: 8,
    support: 5,
    blender: 3,
    hero: 2,
    bridge: 1,
    modifier: 0,
    diffuser: -3,
  },
};

const getRowProfile = (row, referenceLinksMap) => resolveMaterialCompositionProfile(
  row?.raw_material || null,
  row?.item_id ? referenceLinksMap?.get(row.item_id) || null : null,
);

const getRowImpactShare = (row, simulation) => {
  const totalImpactContribution = Number(simulation.impactEstimate || 0);
  const impactContribution = Number(row?.impactContribution || 0);

  if (totalImpactContribution <= 0 || impactContribution <= 0) {
    return 0;
  }

  return impactContribution / totalImpactContribution;
};

const isRowNearUseCeiling = (row, profile) => {
  const effectivePercentage = Number(row?.effectivePercentage || 0);
  const typical = Number(profile?.use_level_typical_percent || 0);
  const max = Number(profile?.use_level_max_percent || 0);

  if (max > 0 && effectivePercentage >= max * 0.8) {
    return true;
  }

  if (typical > 0 && effectivePercentage >= typical * 0.9) {
    return true;
  }

  return false;
};

const canSafelyIncreaseRow = (row, simulation, objective, referenceLinksMap) => {
  if (!row) {
    return false;
  }

  if (
    simulation.ifraAdvisories?.some((advisory) => advisory.itemId === row.item_id)
    || simulation.maxUseAdvisories?.some((advisory) => advisory.itemId === row.item_id)
  ) {
    return false;
  }

  const profile = getRowProfile(row, referenceLinksMap);
  const impact = Number(row?.impact ?? profile?.impact ?? 0);
  const impactShare = getRowImpactShare(row, simulation);

  if (isRowNearUseCeiling(row, profile)) {
    return false;
  }

  if (impact >= 900 && impactShare >= 0.18) {
    return false;
  }

  if (objective === 'balance' && impact >= 700 && impactShare >= 0.14) {
    return false;
  }

  return true;
};

const scoreIncreaseCandidate = (row, simulation, objective, referenceLinksMap) => {
  if (!row) {
    return Number.NEGATIVE_INFINITY;
  }

  const profile = getRowProfile(row, referenceLinksMap);
  const primaryFunction = profile?.primary_function || null;
  const impact = Number(row?.impact ?? profile?.impact ?? 0);
  const impactShare = getRowImpactShare(row, simulation);
  const effectivePercentage = Number(row.effectivePercentage || 0);
  const typical = Number(profile?.use_level_typical_percent || 0);
  const max = Number(profile?.use_level_max_percent || 0);

  let score = Number(row.odourWeight || 0);
  score += FUNCTION_PRIORITY_BY_OBJECTIVE[objective]?.[primaryFunction] || 0;

  if (row.pyramidPlacement === 'middle' && objective === 'balance') {
    score += 2;
  }

  if (row.pyramidPlacement === 'base' && objective === 'longevity') {
    score += 2;
  }

  if (row.pyramidPlacement === 'top' && objective === 'projection') {
    score += 1.5;
  }

  if (impact >= 900) {
    score -= 10;
  } else if (impact >= 600) {
    score -= 6;
  } else if (impact >= 350) {
    score -= 3;
  }

  if (impactShare >= 0.3) {
    score -= 10;
  } else if (impactShare >= 0.2) {
    score -= 6;
  } else if (impactShare >= 0.12) {
    score -= 2;
  }

  if (typical > 0 && effectivePercentage >= typical * 0.75) {
    score -= 4;
  }

  if (max > 0 && effectivePercentage >= max * 0.7) {
    score -= 6;
  }

  return score;
};

// The scoring below exists to rank candidates, so it has to see all of them. This used to cut the list
// to the first four AFTER filtering and BEFORE sorting, and the incoming list is ordered by odour weight
// — a different order from the one being scored. Two consequences: a lighter row that scored higher
// (the penalties reach -20, so it easily can) was never reachable, and in pickDiffusionRow, whose pool is
// three top rows followed by three middle rows, the middle half was dropped whenever four top rows
// passed the guardrails. The pick is capped at one row anyway; there is nothing to truncate.
const pickPreferredIncreaseRow = (rows, simulation, objective, referenceLinksMap) => {
  const candidates = (rows || [])
    .filter((row) => canSafelyIncreaseRow(row, simulation, objective, referenceLinksMap));

  if (!candidates.length) {
    return null;
  }

  return [...candidates]
    .sort((left, right) => (
      scoreIncreaseCandidate(right, simulation, objective, referenceLinksMap)
      - scoreIncreaseCandidate(left, simulation, objective, referenceLinksMap)
    ))[0] || null;
};

const pickDiffusionRow = (topRows, middleRows, simulation, referenceLinksMap) => {
  const candidates = [...topRows.slice(0, 3), ...middleRows.slice(0, 3)];
  return pickPreferredIncreaseRow(candidates, simulation, 'projection', referenceLinksMap);
};

const canSafelyReduceDominantRow = (row, simulation) => {
  if (!row) {
    return false;
  }

  const effectivePercentage = Number(row.effectivePercentage || 0);
  const hasOverloadSignal = effectivePercentage >= 18
    || Number(simulation.pace?.dominantClass?.sharePercent || 0) >= 40
    || simulation.maxUseAdvisories?.some((advisory) => advisory.itemId === row.item_id)
    || simulation.ifraAdvisories?.some((advisory) => advisory.itemId === row.item_id);

  if (!hasOverloadSignal) {
    return false;
  }

  if (row.pyramidPlacement === 'base' && (simulation.pace?.tenacityScore < PACE_TARGETS.tenacity || simulation.pace?.drydownScore < PACE_TARGETS.drydown)) {
    return false;
  }

  if (row.pyramidPlacement === 'middle' && simulation.pace?.heartScore < PACE_TARGETS.heart) {
    return false;
  }

  return true;
};

const buildIncreaseDelta = (currentGrams, score) => {
  const grams = Number(currentGrams || 0);
  const isWeak = Number(score || 0) < 40;

  if (grams <= 0.01) {
    return isWeak ? 0.04 : 0.02;
  }

  if (grams <= 0.05) {
    return isWeak ? 0.08 : 0.04;
  }

  if (grams <= 0.2) {
    return isWeak ? 0.15 : 0.08;
  }

  if (grams <= 0.5) {
    return isWeak ? 0.25 : 0.12;
  }

  if (grams <= 1) {
    return isWeak ? 0.4 : 0.2;
  }

  if (grams <= 3) {
    return isWeak ? 0.6 : 0.3;
  }

  return isWeak ? 1 : 0.5;
};

const buildDecreaseDelta = (currentGrams, score) => {
  const grams = Number(currentGrams || 0);
  const isWeak = Number(score || 0) < 40;

  if (grams <= 0.02) {
    return 0.01;
  }

  if (grams <= 0.1) {
    return isWeak ? 0.03 : 0.02;
  }

  if (grams <= 0.5) {
    return isWeak ? 0.08 : 0.05;
  }

  if (grams <= 1) {
    return isWeak ? 0.15 : 0.08;
  }

  if (grams <= 3) {
    return isWeak ? 0.25 : 0.12;
  }

  return isWeak ? 0.4 : 0.2;
};

export const formatRecommendationValue = (value) => formatGramAmount(Number(value || 0));

const getRecommendationPriorityBoost = (objective, priorityMode) => {
  if (!objective) {
    return 0;
  }

  if (objective === priorityMode) {
    return 10;
  }

  if (priorityMode === 'balance') {
    return objective === 'projection' ? 2 : 1;
  }

  if (priorityMode === 'projection') {
    return objective === 'balance' ? 2 : 1;
  }

  if (priorityMode === 'longevity') {
    return objective === 'balance' ? 2 : 1;
  }

  return 0;
};

const getFunctionStrategyLabel = (row, referenceLinksMap) => {
  const profile = getRowProfile(row, referenceLinksMap);
  const primaryFunction = profile?.primary_function || null;

  switch (primaryFunction) {
    case 'bridge':
      return 'penopang transisi';
    case 'fixative':
      return 'penopang fiksatif';
    case 'diffuser':
      return 'pengangkat pancaran';
    case 'blender':
      return 'penghalus campuran';
    case 'modifier':
      return 'aksen pengubah';
    case 'hero':
      return 'jangkar utama';
    case 'support':
      return 'penopang badan';
    // Named for what it is. A solvent collects no objective bonus (it is in none of the priority tables),
    // but if one is ever suggested the card must not call it body support.
    case 'solvent':
      return 'pelarut';
    default:
      return row.pyramidPlacement === 'base'
        ? 'penopang jejak akhir'
        : row.pyramidPlacement === 'top'
          ? 'pengangkat pembuka'
          : 'penopang nada tengah';
  }
};

const buildIncreaseRecommendation = ({ axisLabel, objective, reason, row, score, strategyLabel }) => {
  if (!row) {
    return null;
  }

  const currentGrams = Number(row.listedGrams || 0);
  const delta = buildIncreaseDelta(currentGrams, score);
  const target = currentGrams + delta;

  return {
    key: `increase-${axisLabel}-${row.item_id}`,
    itemId: row.item_id,
    action: 'increase',
    tone: 'accent',
    recommendationKind: 'safe_increase',
    objective,
    strategyLabel,
    axisLabel,
    title: `${axisLabel}: naikkan ${row.name}`,
    reason,
    actionLabel: 'Tambah',
    currentGrams,
    delta,
    target,
    helper: `Coba ubah ${row.name} dari ${formatRecommendationValue(currentGrams)} ke ${formatRecommendationValue(target)} (+${formatRecommendationValue(delta)}) di revisi uji berikutnya.`,
  };
};

const buildDecreaseRecommendation = ({ axisLabel, objective, reason, row, score, strategyLabel }) => {
  if (!row) {
    return null;
  }

  const currentGrams = Number(row.listedGrams || 0);
  const delta = Math.min(buildDecreaseDelta(currentGrams, score), currentGrams);

  if (delta <= 0) {
    return null;
  }

  const target = Math.max(currentGrams - delta, 0);

  return {
    key: `decrease-${axisLabel}-${row.item_id}`,
    itemId: row.item_id,
    action: 'decrease',
    tone: 'danger',
    recommendationKind: 'cleanup_move',
    objective,
    strategyLabel,
    axisLabel,
    title: `${axisLabel}: kurangi ${row.name}`,
    reason,
    actionLabel: 'Kurangi',
    currentGrams,
    delta,
    target,
    helper: `Coba ubah ${row.name} dari ${formatRecommendationValue(currentGrams)} ke ${formatRecommendationValue(target)} (-${formatRecommendationValue(delta)}) untuk meredam dominasi atau bentrokan.`,
  };
};

const buildDominantCleanupRecommendation = ({
  axisLabel,
  objective,
  row,
  score,
  simulation,
  referenceLinksMap,
  reason,
}) => {
  if (!canSafelyReduceDominantRow(row, simulation)) {
    return null;
  }

  return buildDecreaseRecommendation({
    axisLabel,
    objective,
    reason,
    row,
    score,
    strategyLabel: getFunctionStrategyLabel(row, referenceLinksMap),
  });
};

export const buildPaceRecommendations = (simulation, priorityMode = 'balance') => {
  if (isFormulaInHealthyPaceRange(simulation)) {
    return [];
  }

  const rows = simulation.rows || [];
  const topRows = sortRowsByWeight(rows.filter((row) => row.pyramidPlacement === 'top'));
  const middleRows = sortRowsByWeight(rows.filter((row) => row.pyramidPlacement === 'middle'));
  const baseRows = sortRowsByWeight(rows.filter((row) => row.pyramidPlacement === 'base'));
  const allRows = sortRowsByWeight(rows.filter((row) => Number(row.odourWeight || 0) > 0));
  const dominantRow = allRows[0] || null;
  const objectives = buildFrameworkObjectives(simulation);
  const preferredTopRow = pickPreferredIncreaseRow(topRows, simulation, 'projection', simulation.referenceLinksMap);
  const preferredMiddleBalanceRow = pickPreferredIncreaseRow(middleRows, simulation, 'balance', simulation.referenceLinksMap);
  const preferredBaseRow = pickPreferredIncreaseRow(baseRows, simulation, 'longevity', simulation.referenceLinksMap);
  const candidates = [];

  if (simulation.pace.openingScore < PACE_TARGETS.opening && preferredTopRow && simulation.topPercent < 34 && objectives.projection < 68) {
    candidates.push({
      priority: getTargetGap(simulation.pace.openingScore, PACE_TARGETS.opening) + 4,
      recommendation: buildIncreaseRecommendation({
      axisLabel: 'Pembuka',
      objective: 'projection',
      reason: 'Pancaran dan angkatan awal di bawah target. Formula butuh dorongan nada atas yang terkendali, dari bahan yang tidak mudah menguasai akord.',
      row: preferredTopRow,
      score: simulation.pace.openingScore,
      strategyLabel: getFunctionStrategyLabel(preferredTopRow, simulation.referenceLinksMap),
      }),
    });
  } else if (simulation.pace.openingScore < PACE_TARGETS.opening && simulation.topPercent < 34) {
    const cleanupRecommendation = buildDominantCleanupRecommendation({
      axisLabel: 'Pembuka',
      objective: 'projection',
      row: dominantRow,
      score: simulation.pace.openingScore,
      simulation,
      referenceLinksMap: simulation.referenceLinksMap,
      reason: 'Pembuka lemah, tetapi tidak ada bahan nada atas yang lolos batas aman untuk dinaikkan. Mengurangi bahan paling dominan lebih aman daripada memaksa tambahan berdampak tinggi.',
    });

    if (cleanupRecommendation) {
      candidates.push({
        priority: getTargetGap(simulation.pace.openingScore, PACE_TARGETS.opening) + 1,
        recommendation: cleanupRecommendation,
      });
    }
  }

  if (simulation.pace.heartScore < PACE_TARGETS.heart && preferredMiddleBalanceRow && simulation.middlePercent < 38 && objectives.balance < 72) {
    candidates.push({
      priority: getTargetGap(simulation.pace.heartScore, PACE_TARGETS.heart) + 6,
      recommendation: buildIncreaseRecommendation({
      axisLabel: 'Inti',
      objective: 'balance',
      reason: 'Keseimbangan di badan formula lemah. Bagian tengah perlu topangan dari bahan penghubung atau pemberi badan, bukan sekadar menaikkan bahan terkuat.',
      row: preferredMiddleBalanceRow,
      score: simulation.pace.heartScore,
      strategyLabel: getFunctionStrategyLabel(preferredMiddleBalanceRow, simulation.referenceLinksMap),
      }),
    });
  } else if (simulation.pace.heartScore < PACE_TARGETS.heart && simulation.middlePercent < 38) {
    const cleanupRecommendation = buildDominantCleanupRecommendation({
      axisLabel: 'Inti',
      objective: 'balance',
      row: dominantRow,
      score: simulation.pace.heartScore,
      simulation,
      referenceLinksMap: simulation.referenceLinksMap,
      reason: 'Keseimbangan inti lemah, tetapi tidak ada bahan nada tengah yang lolos batas aman. Memangkas bahan dominan lebih aman daripada memaksa tambahan yang berat.',
    });

    if (cleanupRecommendation) {
      candidates.push({
        priority: getTargetGap(simulation.pace.heartScore, PACE_TARGETS.heart),
        recommendation: cleanupRecommendation,
      });
    }
  }

  if ((simulation.pace.drydownScore < PACE_TARGETS.drydown || simulation.pace.tenacityScore < PACE_TARGETS.tenacity) && preferredBaseRow && simulation.basePercent < 48 && objectives.longevity < 74) {
    candidates.push({
      priority: Math.max(
        getTargetGap(simulation.pace.drydownScore, PACE_TARGETS.drydown),
        getTargetGap(simulation.pace.tenacityScore, PACE_TARGETS.tenacity),
      ) + 8,
      recommendation: buildIncreaseRecommendation({
      axisLabel: simulation.pace.tenacityScore < simulation.pace.drydownScore ? 'Ketahanan' : 'Jejak akhir',
      objective: 'longevity',
      reason: 'Ketahanan di bawah target. Tahap akhir butuh daya tahan dan bobot jejak akhir dari bahan nada dasar yang selaras dengan formula.',
      row: preferredBaseRow,
      score: Math.min(simulation.pace.drydownScore, simulation.pace.tenacityScore),
      strategyLabel: getFunctionStrategyLabel(preferredBaseRow, simulation.referenceLinksMap),
      }),
    });
  } else if ((simulation.pace.drydownScore < PACE_TARGETS.drydown || simulation.pace.tenacityScore < PACE_TARGETS.tenacity) && simulation.basePercent < 48) {
    const cleanupRecommendation = buildDominantCleanupRecommendation({
      axisLabel: simulation.pace.tenacityScore < simulation.pace.drydownScore ? 'Ketahanan' : 'Jejak akhir',
      objective: 'longevity',
      row: dominantRow,
      score: Math.min(simulation.pace.drydownScore, simulation.pace.tenacityScore),
      simulation,
      referenceLinksMap: simulation.referenceLinksMap,
      reason: 'Ketahanan di bawah target, tetapi tidak ada bahan nada dasar yang lolos batas aman. Mengurangi dominasi berlebih lebih aman daripada memaksa tambahan nada dasar yang lebih berat.',
    });

    if (cleanupRecommendation) {
      candidates.push({
        priority: Math.max(
          getTargetGap(simulation.pace.drydownScore, PACE_TARGETS.drydown),
          getTargetGap(simulation.pace.tenacityScore, PACE_TARGETS.tenacity),
        ),
        recommendation: cleanupRecommendation,
      });
    }
  }

  if (simulation.pace.bridgeQualityScore < PACE_TARGETS.bridgeQuality && preferredMiddleBalanceRow && simulation.middlePercent < 40 && objectives.balance < 75) {
    candidates.push({
      priority: getTargetGap(simulation.pace.bridgeQualityScore, PACE_TARGETS.bridgeQuality) + 5,
      recommendation: buildIncreaseRecommendation({
      axisLabel: 'Transisi',
      objective: 'balance',
      reason: 'Keseimbangan terganggu oleh transisi yang patah. Formula butuh sambungan di nada tengah dari bahan penghubung, bukan sekadar bahan paling lantang.',
      row: preferredMiddleBalanceRow,
      score: simulation.pace.bridgeQualityScore,
      strategyLabel: getFunctionStrategyLabel(preferredMiddleBalanceRow, simulation.referenceLinksMap),
      }),
    });
  } else if (simulation.pace.bridgeQualityScore < PACE_TARGETS.bridgeQuality && simulation.middlePercent < 40) {
    const cleanupRecommendation = buildDominantCleanupRecommendation({
      axisLabel: 'Transisi',
      objective: 'balance',
      row: dominantRow,
      score: simulation.pace.bridgeQualityScore,
      simulation,
      referenceLinksMap: simulation.referenceLinksMap,
      reason: 'Transisi lemah, tetapi tidak ada bahan penghubung yang lolos batas aman. Langkah yang lebih aman: kurangi bahan yang menguasai transisi.',
    });

    if (cleanupRecommendation) {
      candidates.push({
        priority: getTargetGap(simulation.pace.bridgeQualityScore, PACE_TARGETS.bridgeQuality),
        recommendation: cleanupRecommendation,
      });
    }
  }

  if (simulation.pace.diffusionScore < PACE_TARGETS.diffusion && objectives.projection < 72) {
    const diffusionRow = pickDiffusionRow(topRows, middleRows, simulation, simulation.referenceLinksMap);
    if (diffusionRow && !(simulation.topPercent > 40 && diffusionRow.pyramidPlacement === 'top')) {
      candidates.push({
        priority: getTargetGap(simulation.pace.diffusionScore, PACE_TARGETS.diffusion) + 3,
        recommendation: buildIncreaseRecommendation({
          axisLabel: 'Pancaran',
          objective: 'projection',
          reason: 'Pancaran tertinggal. Formula butuh angkatan keluar dari bahan yang menambah sebaran, tanpa terlalu mendorong nada berdampak tinggi yang sudah dominan.',
          row: diffusionRow,
          score: simulation.pace.diffusionScore,
          strategyLabel: getFunctionStrategyLabel(diffusionRow, simulation.referenceLinksMap),
        }),
      });
    }
  }

  if ((simulation.pace.harmonyScore < PACE_TARGETS.harmony || simulation.pace.smoothnessScore < PACE_TARGETS.smoothness) && objectives.balance < 78) {
    if (simulation.pace.bridgeQualityScore < PACE_TARGETS.bridgeQuality && preferredMiddleBalanceRow && simulation.middlePercent < 40) {
      candidates.push({
        priority: Math.max(
          getTargetGap(simulation.pace.harmonyScore, PACE_TARGETS.harmony),
          getTargetGap(simulation.pace.smoothnessScore, PACE_TARGETS.smoothness),
        ) + 7,
        recommendation: buildIncreaseRecommendation({
          axisLabel: simulation.pace.harmonyScore < simulation.pace.smoothnessScore ? 'Harmoni' : 'Kehalusan',
          objective: 'balance',
          reason: 'Harmoni lemah karena strukturnya tipis. Menambah bahan penghubung atau pemberi badan lebih aman daripada menaikkan bahan berdampak ekstrem lagi.',
          row: preferredMiddleBalanceRow,
          score: Math.min(simulation.pace.harmonyScore, simulation.pace.smoothnessScore),
          strategyLabel: getFunctionStrategyLabel(preferredMiddleBalanceRow, simulation.referenceLinksMap),
        }),
      });
    } else if (canSafelyReduceDominantRow(dominantRow, simulation)) {
      candidates.push({
        priority: Math.max(
          getTargetGap(simulation.pace.harmonyScore, PACE_TARGETS.harmony),
          getTargetGap(simulation.pace.smoothnessScore, PACE_TARGETS.smoothness),
        ) + 2,
        recommendation: buildDecreaseRecommendation({
          axisLabel: simulation.pace.harmonyScore < simulation.pace.smoothnessScore ? 'Harmoni' : 'Kehalusan',
          objective: 'balance',
          reason: 'Campuran terlihat tertekan dan satu bahan memikul beban terlalu besar. Memangkas bahan dominan itu adalah langkah perapian yang lebih aman.',
          row: dominantRow,
          score: Math.min(simulation.pace.harmonyScore, simulation.pace.smoothnessScore),
          strategyLabel: getFunctionStrategyLabel(dominantRow, simulation.referenceLinksMap),
        }),
      });
    }
  }

  // Keyed by the material, not by material+action. A row can be both the preferred increase candidate
  // and the dominant row that wants trimming -- a heavy base note at 18%+ with ordinary impact is the
  // normal case -- and the old key let both survive, so the panel could print "Drydown: lift X" beside
  // "Harmony: reduce X" and the perfumer got two opposite instructions about one material.
  //
  // It did not stop at the display either. "Create PACED revision" hands this list to
  // buildPacedRevisionItems, which maps it by itemId: a second recommendation for the same material
  // silently replaced the first, so only one of the pair was ever applied while the revision note still
  // claimed both. Deduping here means the note can only ever count moves that were really made.
  const uniqueRecommendations = [];
  const seenItems = new Set();

  candidates
    .filter((entry) => entry.recommendation)
    .sort((left, right) => {
      const leftPriority = Number(left.priority || 0) + getRecommendationPriorityBoost(left.recommendation?.objective, priorityMode);
      const rightPriority = Number(right.priority || 0) + getRecommendationPriorityBoost(right.recommendation?.objective, priorityMode);

      return rightPriority - leftPriority;
    })
    .forEach((entry) => {
      const key = entry.recommendation.itemId;
      if (seenItems.has(key)) {
        return;
      }

      seenItems.add(key);
      uniqueRecommendations.push(entry.recommendation);
    });

  return uniqueRecommendations.slice(0, 2);
};
