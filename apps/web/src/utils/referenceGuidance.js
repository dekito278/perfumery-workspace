import { resolveCanonicalReferenceProfile } from '@/utils/canonicalReferenceProfile.js';

const normalizeNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeText = (value) => {
  const text = String(value || '').trim();
  return text || null;
};

export const hasRawMaterialReferenceGuidance = (rawMaterial) => (
  normalizeNumber(rawMaterial?.reference_impact) !== null
  || normalizeNumber(rawMaterial?.reference_life_hours) !== null
  || normalizeNumber(rawMaterial?.reference_use_level_typical_percent) !== null
  || normalizeNumber(rawMaterial?.reference_use_level_max_percent) !== null
  || normalizeNumber(rawMaterial?.ifra_limit) !== null
  || normalizeText(rawMaterial?.reference_abc_primary_family) !== null
);

export const buildFallbackReferenceProfileFromRawMaterial = (rawMaterial) => {
  if (!hasRawMaterialReferenceGuidance(rawMaterial)) {
    return null;
  }

  const rawMaterialId = String(rawMaterial?.id || '').replace(/-/g, '').slice(0, 12).toUpperCase();
  const fallbackReferenceCode = normalizeText(rawMaterial?.workbook_code)
    || (rawMaterialId ? `RAW-${rawMaterialId}` : 'RAW-MANUAL');

  const fallbackProfile = {
    id: `raw-material-guidance-${rawMaterial?.id || fallbackReferenceCode}`,
    reference_code: fallbackReferenceCode,
    name: normalizeText(rawMaterial?.name) || fallbackReferenceCode,
    supplier: normalizeText(rawMaterial?.vendor || rawMaterial?.supplier_name),
    abc_code: normalizeText(rawMaterial?.workbook_code),
    abc_primary_family: normalizeText(rawMaterial?.reference_abc_primary_family || rawMaterial?.scent_family),
    abc_secondary_family: null,
    classification: null,
    odour_profile: null,
    impact: normalizeNumber(rawMaterial?.reference_impact),
    life_hours: normalizeNumber(rawMaterial?.reference_life_hours),
    use_level_typical_percent: normalizeNumber(rawMaterial?.reference_use_level_typical_percent),
    use_level_max_percent: normalizeNumber(rawMaterial?.reference_use_level_max_percent),
    ifra_limit_percent: normalizeNumber(rawMaterial?.ifra_limit),
    cas_no: normalizeText(rawMaterial?.cas_number),
    odour_facets: [],
    source_kind: 'raw_material_guidance',
  };

  const canonicalProfile = resolveCanonicalReferenceProfile({
    referenceProfile: fallbackProfile,
    rawMaterial,
  });

  return {
    ...fallbackProfile,
    canonical_profile: canonicalProfile,
    abc_distribution: canonicalProfile?.abc_distribution || [],
    abc_primary_family: canonicalProfile?.abc_primary_family || fallbackProfile.abc_primary_family,
    abc_secondary_family: canonicalProfile?.abc_secondary_family || fallbackProfile.abc_secondary_family,
    impact: canonicalProfile?.impact ?? fallbackProfile.impact,
    life_hours: canonicalProfile?.life_hours ?? fallbackProfile.life_hours,
    use_level_typical_percent: canonicalProfile?.use_level_typical_percent ?? fallbackProfile.use_level_typical_percent,
    use_level_max_percent: canonicalProfile?.use_level_max_percent ?? fallbackProfile.use_level_max_percent,
    ifra_limit_percent: canonicalProfile?.ifra_limit_percent ?? fallbackProfile.ifra_limit_percent,
    cas_no: canonicalProfile?.cas_number || fallbackProfile.cas_no,
    top_middle_base_tendency: canonicalProfile?.top_middle_base_tendency || null,
    confidence_score: canonicalProfile?.confidence_score ?? null,
    confidence_reason: canonicalProfile?.confidence_reason || null,
    field_locks: canonicalProfile?.field_locks || {},
    source_snapshots: canonicalProfile?.source_snapshots || {},
  };
};
