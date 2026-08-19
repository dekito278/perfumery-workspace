const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

// A limit of 0 is a real, and the strictest, limit: IFRA uses it for prohibited materials. Folding it into
// "no limit" meant the one material that must never appear in a formula was the one material that never
// raised an advisory (audit round 8). null still means "unknown".
const toGuidanceLimit = (value) => {
  const numericValue = toFiniteNumber(value);
  return numericValue !== null && numericValue >= 0 ? numericValue : null;
};

export const getDilutionFactor = (value) => {
  const dilutionPercent = toFiniteNumber(value);
  if (dilutionPercent === null || dilutionPercent <= 0) {
    return 1;
  }

  return dilutionPercent / 100;
};

export const buildGuidanceLimitAdvisories = ({
  referenceProfile = null,
  effectivePercentage = null,
} = {}) => {
  if (!referenceProfile || effectivePercentage === null || effectivePercentage === undefined) {
    return [];
  }

  const normalizedEffectivePercentage = Number(effectivePercentage);
  if (!Number.isFinite(normalizedEffectivePercentage) || normalizedEffectivePercentage <= 0) {
    return [];
  }

  const advisories = [];
  const typicalLimit = toGuidanceLimit(referenceProfile.use_level_typical_percent);
  const maxLimit = toGuidanceLimit(referenceProfile.use_level_max_percent);
  const ifraLimit = toGuidanceLimit(referenceProfile.ifra_limit_percent);

  if (typicalLimit !== null && normalizedEffectivePercentage > typicalLimit) {
    advisories.push({
      type: 'typical',
      severity: 'info',
      label: 'Above typical use level',
      limit: typicalLimit,
      message: `Effective concentration ${normalizedEffectivePercentage.toFixed(2)}% is above the typical reference level of ${typicalLimit.toFixed(2)}%.`,
    });
  }

  if (maxLimit !== null && normalizedEffectivePercentage > maxLimit) {
    advisories.push({
      type: 'max',
      severity: 'warning',
      label: 'Above max use level',
      limit: maxLimit,
      message: `Effective concentration ${normalizedEffectivePercentage.toFixed(2)}% is above the suggested max reference level of ${maxLimit.toFixed(2)}%.`,
    });
  }

  if (ifraLimit === 0) {
    advisories.push({
      type: 'ifra',
      severity: 'danger',
      label: 'Prohibited by IFRA',
      limit: 0,
      message: `Reference IFRA limit is 0% — material ini tidak boleh dipakai sama sekali, sekarang terpakai ${normalizedEffectivePercentage.toFixed(2)}%.`,
    });
  } else if (ifraLimit !== null && normalizedEffectivePercentage > ifraLimit) {
    advisories.push({
      type: 'ifra',
      severity: 'danger',
      label: 'Above IFRA reference limit',
      limit: ifraLimit,
      message: `Effective concentration ${normalizedEffectivePercentage.toFixed(2)}% is above the reference IFRA limit of ${ifraLimit.toFixed(2)}%.`,
    });
  }

  return advisories;
};
