// A PACE revision that knows where it came from.
//
// Today "Create PACED revision" makes a brand new, unrelated formula: name "X PACED", code "X-PACED",
// and the only link back to the parent is a sentence inside `notes`. After three iterations the formula
// list holds four unconnected rows and there is no way to see what actually changed between them. The
// engine that makes this product worth using produces output the product cannot tidy up.
//
// Import-free on purpose: the node guard imports this directly, and the diff is the part most worth
// testing as behaviour rather than trusting by eye.

// --- Version chain -----------------------------------------------------------------------------------

// The old rule returned `${version}-R2` for anything already containing "paced", so the chain went
// 1.0 -> 1.0-PACED -> 1.0-PACED-R2 -> 1.0-PACED-R2-R2 -> 1.0-PACED-R2-R2-R2. It never reached R3, and it
// grew a tail instead. Revision four called itself R2, same as revision three.
const REVISION_SUFFIX = /-R(\d+)$/i;

export const nextRevisionVersion = (currentVersion) => {
  const normalized = String(currentVersion || '').trim();
  if (!normalized) {
    return 'PACED';
  }

  const counted = normalized.match(REVISION_SUFFIX);
  if (counted) {
    return `${normalized.slice(0, counted.index)}-R${Number(counted[1]) + 1}`;
  }

  return /paced/i.test(normalized) ? `${normalized}-R2` : `${normalized}-PACED`;
};

// --- Lineage -----------------------------------------------------------------------------------------

const idOf = (formula) => String(formula?.id ?? '');
const parentIdOf = (formula) => (formula?.parent_formula_id ? String(formula.parent_formula_id) : null);

const timeOf = (formula) => {
  const value = Date.parse(formula?.created_at || formula?.created || formula?.updated_at || '');
  return Number.isFinite(value) ? value : 0;
};

// Walk up to the oldest ancestor still present in the list. A parent that was deleted (or simply not
// loaded) makes its child its own root rather than orphaning it out of the list entirely.
const rootIdOf = (formula, byId) => {
  const seen = new Set();
  let current = formula;

  while (current) {
    const id = idOf(current);
    // A cycle cannot be created through the UI, but a hand-edited row could — and hanging the formula
    // list is a worse outcome than showing a slightly odd chain.
    if (seen.has(id)) return id;
    seen.add(id);

    const parent = parentIdOf(current) ? byId.get(parentIdOf(current)) : null;
    if (!parent) return id;
    current = parent;
  }

  return idOf(formula);
};

export const groupFormulasByLineage = (formulas = []) => {
  const list = (formulas || []).filter(Boolean);
  const byId = new Map(list.map((formula) => [idOf(formula), formula]));
  const groups = new Map();

  for (const formula of list) {
    const rootId = rootIdOf(formula, byId);
    const group = groups.get(rootId) || { root: byId.get(rootId) || formula, revisions: [] };
    if (idOf(formula) !== rootId) {
      group.revisions.push(formula);
    }
    groups.set(rootId, group);
  }

  return [...groups.values()];
};

/** One lineage, oldest first — the root then its revisions in the order they were made. */
export const buildLineageChain = (formulas = [], formulaId) => {
  const target = String(formulaId || '');
  if (!target) return [];

  const group = groupFormulasByLineage(formulas).find((candidate) => (
    idOf(candidate.root) === target || candidate.revisions.some((revision) => idOf(revision) === target)
  ));

  if (!group) return [];
  return [group.root, ...[...group.revisions].sort((left, right) => timeOf(left) - timeOf(right))];
};

// --- Diff --------------------------------------------------------------------------------------------

// Materials are matched by item_id, which is the actual identity. Name is only a last resort: renaming a
// material does not make it a different material, and two rows can share a name.
const itemKey = (item = {}) => String(item.item_id || item.raw_material_id || item.name || item.item_name || '')
  .trim()
  .toLowerCase();

const itemLabel = (item = {}) => String(item.name || item.item_name || item.item_id || 'Bahan tanpa nama');

// The composer calls this gram_amount and the detail page calls it grams. Reading only one of them would
// make every diff come back as "nothing changed", which is the most convincing way to be wrong.
const toGrams = (item = {}) => {
  const value = Number(item.grams ?? item.gram_amount);
  return Number.isFinite(value) ? value : 0;
};

const indexItems = (items = []) => {
  const index = new Map();

  for (const item of items || []) {
    const key = itemKey(item);
    if (!key) continue;
    const existing = index.get(key);
    // Two rows of the same material are summed, not overwritten — otherwise the diff silently loses one.
    index.set(key, existing ? { ...existing, grams: toGrams(existing) + toGrams(item) } : item);
  }

  return index;
};

// From zero to something has no meaningful percentage.
const percentChange = (base, target) => (base ? ((target - base) / base) * 100 : null);

export const diffFormulaItems = (baseItems = [], targetItems = []) => {
  const base = indexItems(baseItems);
  const target = indexItems(targetItems);
  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  for (const [key, targetItem] of target) {
    const baseItem = base.get(key);
    const targetGrams = toGrams(targetItem);

    if (!baseItem) {
      added.push({ key, label: itemLabel(targetItem), baseGrams: 0, targetGrams, deltaGrams: targetGrams, deltaPercent: null });
      continue;
    }

    const baseGrams = toGrams(baseItem);
    const deltaGrams = targetGrams - baseGrams;
    const entry = { key, label: itemLabel(targetItem), baseGrams, targetGrams, deltaGrams, deltaPercent: percentChange(baseGrams, targetGrams) };
    (deltaGrams === 0 ? unchanged : changed).push(entry);
  }

  for (const [key, baseItem] of base) {
    if (target.has(key)) continue;
    const baseGrams = toGrams(baseItem);
    removed.push({ key, label: itemLabel(baseItem), baseGrams, targetGrams: 0, deltaGrams: -baseGrams, deltaPercent: null });
  }

  // Biggest move first — that is what a perfumer opens the panel to see.
  changed.sort((left, right) => Math.abs(right.deltaGrams) - Math.abs(left.deltaGrams));
  added.sort((left, right) => right.targetGrams - left.targetGrams);
  removed.sort((left, right) => right.baseGrams - left.baseGrams);

  const totalBase = [...base.values()].reduce((sum, item) => sum + toGrams(item), 0);
  const totalTarget = [...target.values()].reduce((sum, item) => sum + toGrams(item), 0);

  return {
    added,
    removed,
    changed,
    unchanged,
    totalBase,
    totalTarget,
    totalDelta: totalTarget - totalBase,
    hasChanges: added.length > 0 || removed.length > 0 || changed.length > 0,
  };
};
