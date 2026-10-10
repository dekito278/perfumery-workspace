/**
 * Does this raw material have perfumery guidance behind it?
 *
 * Both dashboards asked it with a private two-line copy of the same predicate, reading five
 * denormalised columns on the raw_materials row and nothing else:
 *
 *   workbook_code, reference_abc_primary_family, reference_impact, reference_life_hours, ifra_limit
 *
 * The guidance does not only live there. raw_material_reference_links joins a material to a
 * material_reference_profiles row, and the raw-materials screen resolves guidance THROUGH that link —
 * enrichMaterialsWithGuidance and getResolvedGuidanceValues both fall back to the linked profile for
 * every one of those fields.
 *
 * Measured on production 2026-10-11, 774 raw materials:
 *
 *   666  have a primary reference link
 *   589  satisfy the dashboards' five-column test
 *   185  the "Celah panduan" / "Guidance gaps" card counted
 *    83  of those 185 have a primary profile that really carries guidance — an ABC family, an impact,
 *        a life in hours or an IFRA limit — and the screen the card NAVIGATES TO resolves it
 *
 * So the card sent Dekito to a screen that disagrees with it about 83 of its own 185 materials, and
 * the one it links to is the one that is right. Same shape as isReadyToPack: a card that promises what
 * another screen will show has to count with that screen's rule.
 *
 * The five columns stay in the test. 7 materials carry one of them and have no link at all, and the
 * resolver finds guidance for those too — coverage is a link OR a column, not a link instead of one.
 */
export const hasGuidanceCoverage = (material, matchedReferenceIds = null) => {
  if (!material) return false;
  if (matchedReferenceIds?.has?.(material.id)) return true;
  return Boolean(
    material.workbook_code
    || material.reference_abc_primary_family
    || (material.reference_impact !== null && material.reference_impact !== undefined)
    || (material.reference_life_hours !== null && material.reference_life_hours !== undefined)
    || (material.ifra_limit !== null && material.ifra_limit !== undefined),
  );
};

/**
 * The materials with nothing behind them, for the card's count and its preview list.
 *
 * One call, so the number and the three rows under it cannot come from different filters — which is
 * how the fulfillment screen's count and its list drifted apart in audit round 9.
 */
export const materialsWithoutGuidance = (materials = [], matchedReferenceIds = null) => (
  (Array.isArray(materials) ? materials : []).filter((material) => !hasGuidanceCoverage(material, matchedReferenceIds))
);
