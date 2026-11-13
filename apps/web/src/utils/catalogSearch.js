// The words a buyer types, and the words the catalogue is written in.
//
// Second visitor audit, 13 Nov 2026: "segar" found nothing in a catalogue whose fresh perfumes are filed as
// FRESH. The family names and much of the note vocabulary are English, while the shop and its buyers speak
// Indonesian, so a search is widened by the common scent words in both directions. Small and literal on
// purpose: each pair is a translation, never a guess at what a buyer "might like".
// Import-free so the guard runs it.

const PAIRS = [
  ['segar', 'fresh'], ['bunga', 'floral'], ['kayu', 'woody'], ['kayu', 'wood'], ['manis', 'sweet'],
  ['manis', 'gourmand'], ['hangat', 'warm'], ['hangat', 'amber'], ['rempah', 'spicy'], ['rempah', 'spice'],
  ['jeruk', 'citrus'], ['sitrus', 'citrus'], ['hijau', 'green'], ['laut', 'marine'], ['laut', 'aquatic'],
  ['tanah', 'earthy'], ['asap', 'smoky'], ['kulit', 'leather'], ['vanila', 'vanilla'], ['melati', 'jasmine'],
  ['mawar', 'rose'], ['kopi', 'coffee'], ['teh', 'tea'], ['buah', 'fruity'], ['bersih', 'clean'],
  ['sabun', 'soapy'], ['bedak', 'powdery'], ['gaharu', 'oud'], ['nilam', 'patchouli'], ['akar wangi', 'vetiver'],
  ['cendana', 'sandalwood'], ['kemenyan', 'incense'], ['madu', 'honey'], ['susu', 'milky'], ['lembut', 'soft'],
];

/** The query and its translations, lower-cased; the catalogue matches when its text contains any of them. */
export const catalogSearchTerms = (query = '') => {
  const wanted = String(query || '').trim().toLowerCase();
  if (!wanted) return [];
  const terms = new Set([wanted]);
  for (const [id, en] of PAIRS) {
    if (wanted === id) terms.add(en);
    if (wanted === en) terms.add(id);
  }
  return [...terms];
};

export const matchesCatalogSearch = (searchable = '', query = '') => {
  const terms = catalogSearchTerms(query);
  if (!terms.length) return true;
  const text = String(searchable || '').toLowerCase();
  return terms.some((term) => text.includes(term));
};

export default matchesCatalogSearch;
