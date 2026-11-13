// "Parfum karya" (Dekito's brief, 14 Nov 2026, P2-6): up to four photos of the work itself — weighing,
// blending, packing — on a product page and on About. Only Dekito's own photos, set in Studio; never stock
// images. Import-free so the forms, the pages and the guard read one rule.
export const MAX_PROCESS_IMAGES = 4;

const isImageUrl = (value) => /^(https:\/\/|\/)[^\s]+$/.test(value);

/** A list of up to four photo addresses, from an array or text with one per line. */
export const normalizeProcessImages = (value) => {
  const list = Array.isArray(value) ? value : String(value || '').split('\n');
  return [...new Set(list.map((item) => String(item || '').trim()).filter(isImageUrl))].slice(0, MAX_PROCESS_IMAGES);
};

/** "Batch 03 · 40 botol" — whichever half is filled in; nothing when neither is. */
export const batchParts = ({ batchLabel = '', batchSize = null } = {}) => {
  const name = String(batchLabel || '').trim().slice(0, 40);
  const size = Number(batchSize);
  return { name, size: Number.isInteger(size) && size > 0 && size < 100000 ? size : null };
};
