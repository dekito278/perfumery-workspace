// One bookkeeping scheme for composer row errors, because there were two and they did not agree.
//
// The renderer reads `item_${row_key}`. validateComposerFields wrote `item_${row_key}`. But every
// per-field handler — gram amount, dilution, PACE — wrote and deleted `item_${index}`. Two namespaces
// in one object, and the halves could not clear each other:
//
//   a bad gram amount    stored under item_0, rendered from item_<row_key> → NOTHING shown, and the
//                        save button greys out with no red text anywhere to say why
//   a fixed duplicate    stored under item_<row_key>, cleared under item_<index> → the error outlives
//                        the problem, and validateComposerFields only re-runs on submit, which the
//                        disabled button prevents. Reload is the only way out, and it costs the
//                        whole composition
//
// Row keys move with their row; indices do not. So keys are row_key only, and orphans are swept
// whenever the list changes — two layers, because the number of paths that reorder rows only grows.
//
// Import-free so the node guard can test the rules as behaviour.

export const ROW_ERROR_PREFIX = 'item_';

export const rowErrorKey = (rowKey) => `${ROW_ERROR_PREFIX}${rowKey}`;

export const isRowErrorKey = (key) => String(key || '').startsWith(ROW_ERROR_PREFIX);

// Drop row errors whose row is gone. Non-row keys (`name`, `code`, `ingredients`) are left alone.
export const pruneOrphanRowErrors = (errors = {}, items = []) => {
  // Falls back to the index exactly as the writers do. A row that somehow arrived without a row_key
  // gets its error stored under `item_<index>`; if the sweep did not mirror that fallback it would bin
  // that error on the next keystroke and let a real duplicate through a re-enabled save button.
  const live = new Set((items || []).map((item, index) => rowErrorKey(item?.row_key || index)));

  const next = {};
  let changed = false;

  for (const [key, value] of Object.entries(errors || {})) {
    if (isRowErrorKey(key) && !live.has(key)) {
      changed = true;
      continue;
    }
    next[key] = value;
  }

  // Return the ORIGINAL object when nothing was dropped, so a caller inside setState does not force a
  // re-render for no reason.
  return changed ? next : errors;
};

// Whether anything is genuinely still blocking the save.
export const hasBlockingErrors = (errors = {}, items = []) =>
  Object.keys(pruneOrphanRowErrors(errors, items)).length > 0;
