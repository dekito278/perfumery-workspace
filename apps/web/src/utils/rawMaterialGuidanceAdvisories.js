const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

// Zero means NOT RECORDED in this catalogue, not prohibited. Audit round 8 read it the other way, on the
// correct general principle that IFRA uses 0% for a banned material -- but the studio's own profiles do
// not follow that convention, and the data says so plainly:
//
//   * 76 reference profiles carry ifra_limit_percent = 0;
//   * 66 of them CONTRADICT THEMSELVES, carrying a positive use level beside it -- Javanol 0% IFRA with a
//     2% max, Evernyl with 5.9%, Ethyl linalool with 40%, Benzyl Benzoate with 80%;
//   * the other 10 are zero in all three columns, and they include bergamot.
//
// None of the 76 is a plausibly banned material, and 22 of them are in live formulas -- so the workbook
// was printing "Prohibited by IFRA -- material ini tidak boleh dipakai sama sekali" over bergamot and
// Javanol, docking smoothness 8 points per row and refusing to let the PACE engine touch them.
//
// Dekito's decision, 11 Oct 2026: 0 means not recorded. Rather than falling silent about the gap, the
// simulation counts these rows separately (unknownIfraLimitCount) and the panel says so -- the same answer
// round 8 was reaching for, without asserting something untrue. A real prohibition will be marked some
// other way when there is one to mark.
const toGuidanceLimit = (value) => {
  const numericValue = toFiniteNumber(value);
  return numericValue !== null && numericValue > 0 ? numericValue : null;
};

/** True when a profile exists but states no usable IFRA limit — unknown, not safe. */
export const ifraLimitIsRecorded = (referenceProfile) => (
  toGuidanceLimit(referenceProfile?.ifra_limit_percent) !== null
);

export const getDilutionFactor = (value) => {
  const dilutionPercent = toFiniteNumber(value);
  if (dilutionPercent === null || dilutionPercent <= 0) {
    return 1;
  }

  return dilutionPercent / 100;
};

// One definition of "effective concentration" for every advisory check. Three call sites each derived it
// their own way — the composer seeder from the material's own dilution_percentage, the workbook simulation
// from the row's dilution_percent, the scorer from a seed estimate — so the same material could be judged
// against the same IFRA limit at two different numbers (audit round 8).
//
// Both dilution fields describe the SAME thing: a diluted formula row points at a material that is stocked
// pre-diluted, and the row carries a copy of that material's dilution for display. So take whichever is
// present, preferring the row (it is what the perfumer actually chose for this formula).
export const resolveEffectiveConcentration = ({ listedPercentage = 0, item = null, material = null } = {}) => {
  const listed = Number(listedPercentage);
  if (!Number.isFinite(listed) || listed <= 0) return 0;

  const rowDilution = item?.dilution_percent ?? item?.dilution_percentage ?? null;
  const materialDilution = material?.dilution_percentage ?? null;
  const source = rowDilution ?? materialDilution;

  return listed * getDilutionFactor(source);
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

  if (ifraLimit !== null && normalizedEffectivePercentage > ifraLimit) {
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
