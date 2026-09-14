// One answer to "has this composition been touched", for all four composer pages.
//
// The create pages could get away with `some(item => item.item_id || gram > 0)` because they start
// empty. The edit pages cannot: they start full, so "touched" means "differs from what was loaded",
// which needs the loaded state kept around to compare against.

const cleanItems = (formulaItems = []) => (Array.isArray(formulaItems) ? formulaItems : [])
  .filter((item) => item?.item_id || Number(item?.gram_amount || 0) > 0)
  .map((item) => [
    item.item_id || '',
    String(item.gram_amount ?? ''),
    String(item.dilution_percent ?? ''),
    item.dilution_solvent_id || '',
  ]);

/**
 * A stable string for the parts of a formula a person actually edits. Row keys, ordering helpers and
 * derived percentages are deliberately left out — they change without the formula changing, and a dirty
 * flag that fires on its own teaches people to click through the warning.
 */
export const formulaComposerSnapshot = ({
  name = '', code = '', category = '', version = '', status = '', notes = '', formulaItems = [],
} = {}) => JSON.stringify({
  name: String(name).trim(),
  code: String(code).trim(),
  category: String(category).trim(),
  version: String(version).trim(),
  status: String(status).trim(),
  notes: String(notes).trim(),
  items: cleanItems(formulaItems),
});

/** True when the composer holds something that would be lost. */
export const isFormulaComposerDirty = (current, saved) => Boolean(saved) && current !== saved;
