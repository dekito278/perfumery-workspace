import { getResolvedGuidanceNumber, getResolvedGuidanceValues } from '@/utils/mobileRawMaterialGuidance.js';

const ODOR_KEYS = ['floral', 'citrus', 'woody', 'musky', 'sweet', 'fresh', 'spicy', 'amber'];
// The keys are matched against material text (English); these are only what the chips say.
const ODOR_LABELS = {
  floral: 'Floral', citrus: 'Sitrus', woody: 'Kayu', musky: 'Musk',
  sweet: 'Manis', fresh: 'Segar', spicy: 'Rempah', amber: 'Amber',
};
const PHASE_LABELS = { top: 'atas', middle: 'tengah', base: 'dasar' };
// Medium values are stored as written ('DPG', 'Alcohol', 'TEC', 'Other'); only their names are translated.
const MEDIUM_LABELS = { alcohol: 'Alkohol', other: 'Lainnya' };

const numberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const numberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const getDilutionMedium = (item) => item.dilution_medium || item.medium || item.solvent_name || 'DPG';

export const getDilutionLabel = (item = {}) => {
  const concentration = getItemConcentration(item);
  const rawMedium = getDilutionMedium(item);
  const medium = MEDIUM_LABELS[String(rawMedium).toLowerCase()] || titleCase(rawMedium);

  if (concentration >= 99.99 || (item.dilution_type || 'neat') === 'neat') {
    return 'Murni';
  }

  if (!concentration) {
    return 'Atur pengenceran';
  }

  return `${Number(concentration.toFixed(2)).toString()}% ${medium}`;
};

export const getImpactLabel = (score = null) => {
  if (!Number.isFinite(Number(score))) return 'Belum ada data';
  if (score >= 75) return 'Tinggi';
  if (score >= 45) return 'Sedang';
  if (score > 0) return 'Rendah';
  return 'Tidak ada';
};

export const getLifetimeLabel = (score = null) => {
  if (!Number.isFinite(Number(score))) return 'Belum ada data';
  if (score >= 70) return 'Lama';
  if (score >= 40) return 'Sedang';
  if (score > 0) return 'Singkat';
  return 'Tidak diketahui';
};

const inferOdorProfile = (material = {}) => {
  const resolved = getResolvedGuidanceValues(material);
  const text = [
    material.name,
    material.category,
    resolved.reference_abc_primary_family,
    material.reference_abc_secondary_family,
    material.odour_description,
    material.guidance_reference_profile?.brief_description,
    material.guidance_reference_profile?.odour_description,
    material.guidance_reference_profile?.odour_profile,
  ].filter(Boolean).join(' ').toLowerCase();

  return ODOR_KEYS.reduce((profile, key) => {
    profile[key] = text.includes(key) ? 1 : 0;
    return profile;
  }, {});
};

export const getItemConcentration = (item) => {
  if ((item.dilution_type || 'neat') === 'neat') return 100;
  return clamp(numberOrZero(item.concentration_percent || item.dilution_percent), 0, 100);
};

export const enrichCompositionItems = (items = [], totalGrams = 0, materialsById = new Map()) =>
  items.map((item) => {
    const material = materialsById.get(item.item_id) || {};
    const resolved = getResolvedGuidanceValues(material);
    const gram = numberOrZero(item.gram_amount ?? item.grams);
    const formulaPercent = totalGrams > 0 ? (gram / totalGrams) * 100 : numberOrZero(item.percentage);
    const concentrationPercent = getItemConcentration(item);
    const actualActiveGram = (gram * concentrationPercent) / 100;
    const actualActivePercent = (formulaPercent * concentrationPercent) / 100;
    const impactValue = numberOrNull(getResolvedGuidanceNumber(material, 'reference_impact') ?? item.impactValue ?? material.impact_value);
    const lifetimeValue = numberOrNull(getResolvedGuidanceNumber(material, 'reference_life_hours') ?? item.lifetimeValue ?? material.lifetime_value);
    const hasGuidanceData = Boolean(
      resolved.workbook_code
      || resolved.reference_abc_primary_family
      || impactValue !== null
      || lifetimeValue !== null
    );
    const warnings = [
      concentrationPercent <= 0 ? 'Konsentrasi belum diisi' : null,
      (item.dilution_type || 'neat') !== 'neat' && !numberOrZero(item.concentration_percent || item.dilution_percent) ? 'Pengenceran butuh %' : null,
      actualActivePercent > 25 ? 'Kadar aktif berlebih' : null,
      !hasGuidanceData ? 'Panduan workbook belum ada' : null,
    ].filter(Boolean);

    return {
      ...item,
      material,
      materialName: material.name || item.materialName || 'Bahan',
      category: material.category || item.category || 'Tanpa kategori',
      role: item.role || resolved.reference_abc_primary_family || item.item_type || 'modifier',
      gram,
      formulaPercent,
      concentrationPercent,
      dilutionMedium: getDilutionMedium(item),
      dilutionLabel: getDilutionLabel(item),
      actualActiveGram,
      actualActivePercent,
      impactValue,
      lifetimeValue,
      hasGuidanceData,
      odorProfile: material.odorProfile || inferOdorProfile(material),
      warnings,
      notes: item.notes || '',
    };
  });

export const buildFormulaInsight = (compositionItems = [], guidanceSources = []) => {
  const totalPercent = compositionItems.reduce((sum, item) => sum + numberOrZero(item.formulaPercent), 0);
  const totalGrams = compositionItems.reduce((sum, item) => sum + numberOrZero(item.gram), 0);
  const totalActualActiveGrams = compositionItems.reduce((sum, item) => sum + numberOrZero(item.actualActiveGram), 0);
  const totalActualActive = compositionItems.reduce((sum, item) => sum + numberOrZero(item.actualActivePercent), 0);
  const impactRows = compositionItems.filter((item) => Number.isFinite(Number(item.impactValue)) && Number(item.actualActivePercent || 0) > 0);
  const lifetimeRows = compositionItems.filter((item) => Number.isFinite(Number(item.lifetimeValue)) && Number(item.actualActivePercent || 0) > 0);
  const impactWeight = impactRows.reduce((sum, item) => sum + numberOrZero(item.actualActivePercent), 0);
  const lifetimeWeight = lifetimeRows.reduce((sum, item) => sum + numberOrZero(item.actualActivePercent), 0);
  const impactScore = impactWeight > 0
    ? clamp(impactRows.reduce((sum, item) => sum + Number(item.impactValue) * numberOrZero(item.actualActivePercent), 0) / impactWeight)
    : null;
  const lifetimeScore = lifetimeWeight > 0
    ? clamp(lifetimeRows.reduce((sum, item) => sum + Number(item.lifetimeValue) * numberOrZero(item.actualActivePercent), 0) / lifetimeWeight)
    : null;
  const topMiddleBaseRaw = compositionItems.reduce((acc, item) => {
    const role = String(item.role || '').toLowerCase();
    const bucket = role.includes('top') || role.includes('citrus') || role.includes('fresh')
      ? 'top'
      : role.includes('base') || role.includes('woody') || role.includes('musk') || role.includes('amber')
        ? 'base'
        : 'middle';
    acc[bucket] += item.actualActivePercent || 0;
    return acc;
  }, { top: 0, middle: 0, base: 0 });
  const topMiddleBaseDistribution = Object.fromEntries(
    Object.entries(topMiddleBaseRaw).map(([key, value]) => [key, totalActualActive > 0 ? (value / totalActualActive) * 100 : 0])
  );
  const odorProfileGraph = ODOR_KEYS.map((key) => ({
    key,
    label: ODOR_LABELS[key],
    value: clamp(totalActualActive > 0
      ? (compositionItems.reduce((sum, item) => sum + (item.odorProfile?.[key] || 0) * (item.actualActivePercent || 0), 0) / totalActualActive) * 100
      : 0),
  })).sort((a, b) => b.value - a.value);
  const dominantNotes = odorProfileGraph.filter((entry) => entry.value > 0).slice(0, 3);
  const itemWarnings = compositionItems.flatMap((item) => item.warnings.map((warning) => `${item.materialName}: ${warning}`));
  const totalWarning = Math.abs(totalPercent - 100) > 0.25 ? [`Total formula ${totalPercent.toFixed(1)}%`] : [];
  const warnings = [...totalWarning, ...itemWarnings];
  const dominantTmb = Object.entries(topMiddleBaseDistribution).sort((a, b) => b[1] - a[1])[0];
  // The recommendation keys off the phase, not the label it is shown as.
  const needsAdjustment = !compositionItems.length || warnings.length > 0;
  const heavyPhase = !needsAdjustment && dominantTmb?.[1] > 55 ? dominantTmb[0] : null;
  const balanceStatus = needsAdjustment
    ? 'Perlu penyesuaian'
    : heavyPhase
      ? `Berat di nada ${PHASE_LABELS[heavyPhase]}`
      : 'Seimbang';
  const recommendation = !needsAdjustment && !heavyPhase
    ? 'Distribusi siap divalidasi.'
    : heavyPhase === 'base'
      ? 'Kurangi bahan nada dasar yang berat, atau tambah nada atas yang segar.'
      : heavyPhase === 'top'
        ? 'Tambah penopang nada tengah atau dasar agar lebih tahan lama.'
        : 'Periksa pengenceran, metadata yang kosong, atau peran bahan yang tidak seimbang.';

  return {
    totalPercent,
    totalGrams,
    totalActualActiveGrams,
    totalActualActive,
    hasImpactData: impactScore !== null,
    impactScore,
    impactLabel: getImpactLabel(impactScore),
    hasLifetimeData: lifetimeScore !== null,
    lifetimeScore,
    lifetimeLabel: getLifetimeLabel(lifetimeScore),
    balanceStatus,
    recommendation,
    topMiddleBaseDistribution,
    odorProfileGraph,
    dominantNotes,
    warnings,
    documentGroup: {
      status: guidanceSources.length ? 'Terimpor' : 'Belum terhubung',
      count: guidanceSources.length,
      updatedAt: guidanceSources[0]?.updatedAt,
    },
    guidanceSources,
  };
};

export const createGuidanceSource = ({ url, sourceType, notes, imported }) => ({
  id: `${Date.now()}`,
  url,
  sourceType,
  notes,
  imported,
  status: 'Terimpor',
  updatedAt: new Date().toISOString(),
});
