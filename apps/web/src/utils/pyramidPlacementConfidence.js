// How much of a formula's top / middle / base split is a GUESS.
//
// resolvePyramidPlacement asks three sources in order: the reference profile's top_middle_base_tendency,
// then the material's own pyramid_placement column, then an inference from its ABC class distribution and
// life hours. The order is right -- a stated answer beats a derived one -- but the studio's data makes the
// third source do real work:
//
//   * top_middle_base_tendency is null on all 666 reference profiles, so the first source never fires;
//   * pyramid_placement is filled on 551 of 774 materials, so Dekito's own answer decides for those;
//   * the remaining 223 are inferred.
//
// And the inference is not reliable. Withholding the column and comparing the guess against his own
// answer on those 551 materials: it agrees on 295 and DISAGREES ON 256 -- 46%.
//
// That reaches every screen that prints a pyramid balance, because topPercent / middlePercent /
// basePercent are sums over placements, and opening, heart, drydown and tenacity are built from those
// percentages. Across the studio's formulas: 144 of 680 items are placed by the guess, all 27 formulas
// contain at least one, and on GARNET-1 four guessed materials carry 93.3% of the formula's weight.
//
// None of which is a bug -- it is a data gap. What was wrong is that no screen said so, while the screen
// next door has announced its own blind spot (unpriced materials) since audit round 9. Same shape here.
const placementIsStated = (row) => {
  const material = row?.raw_material || null;
  const tendency = String(
    row?.reference_profile?.top_middle_base_tendency
    || row?.reference_profile?.canonical_profile?.top_middle_base_tendency
    || '',
  ).trim().toLowerCase();
  if (['top', 'middle', 'base'].includes(tendency)) return true;

  const stated = String(material?.pyramid_placement || '').trim().toLowerCase();
  return ['top', 'middle', 'base'].includes(stated);
};

/**
 * Counted over the rows that actually CARRY a placement — a row the resolver could not place at all is
 * not a guess, it is absent, and it contributes to none of the three percentages.
 */
export const pyramidPlacementBlindSpot = (rows = []) => {
  const placed = (Array.isArray(rows) ? rows : []).filter((row) => (
    ['top', 'middle', 'base'].includes(String(row?.pyramidPlacement || ''))
  ));
  const guessed = placed.filter((row) => !placementIsStated(row));
  const totalWeight = placed.reduce((sum, row) => sum + Math.max(0, Number(row?.odourWeight || 0)), 0);
  const guessedWeight = guessed.reduce((sum, row) => sum + Math.max(0, Number(row?.odourWeight || 0)), 0);

  return {
    isComplete: guessed.length === 0,
    placedCount: placed.length,
    guessedCount: guessed.length,
    guessedShare: totalWeight > 0 ? guessedWeight / totalWeight : 0,
    guessedNames: guessed
      .map((row) => String(row?.name || '').trim())
      .filter(Boolean)
      .slice(0, 4),
  };
};

export default pyramidPlacementBlindSpot;
