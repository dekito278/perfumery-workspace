// Which language a product's own words are read in.
//
// The UI around a product is translated from a message file; the product's words are not — they are
// Dekito's, written per bottle, and they live in the database beside the Indonesian ones.
//
// The rule is per FIELD, not per product. A product with an English description but no English notes
// shows the English description and the Indonesian notes, rather than falling back wholesale to
// Indonesian and hiding work that is already done. Half a translation is still better than none as long
// as nothing is blank — and nothing here can go blank, because every fallback lands on the Indonesian
// text that was always there.
//
// Import-free so the guard runs the rules.

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

/**
 * @param product a public fragrance object
 * @param region  'id' | 'en'
 * @returns { description, notes, topNotes, heartNotes, baseNotes } — never blank where the Indonesian
 *   was not blank.
 */
export const productCopyFor = (product, region) => {
  const english = region === 'en';
  const pick = (en, id) => (english && text(en) ? text(en) : id);
  const pickList = (en, id) => (english && list(en).length ? list(en) : id);

  return {
    description: pick(product?.descriptionEn, product?.description),
    notes: pick(product?.notesEn, product?.notes),
    topNotes: pickList(product?.topNotesEn, product?.topNotes),
    heartNotes: pickList(product?.heartNotesEn, product?.heartNotes),
    baseNotes: pickList(product?.baseNotesEn, product?.baseNotes),
  };
};

/** How much of a product has English copy — for the Studio list, so Dekito can see what is left. */
export const englishCopyProgress = (product) => {
  const fields = [
    text(product?.descriptionEn),
    text(product?.notesEn),
    list(product?.topNotesEn).length ? 'x' : '',
    list(product?.heartNotesEn).length ? 'x' : '',
    list(product?.baseNotesEn).length ? 'x' : '',
  ];
  const filled = fields.filter(Boolean).length;
  return { filled, total: fields.length, complete: filled === fields.length };
};
