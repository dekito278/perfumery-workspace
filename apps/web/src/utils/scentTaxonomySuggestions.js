import { findPerfumersWorldCategoryByValue } from '@/utils/perfumersWorldCategories.js';
import { suggestPerfumersWorldCategory } from '@/utils/perfumersWorldCategorySuggestions.js';
import { findEcofragranticaGrandfamilyByValue } from '@/utils/ecofragranticaScentTaxonomy.js';

// Which of the 11 grandfamilies a material belongs on, given whatever it is filed under today.
//
// This does NOT re-do the keyword work. suggestPerfumersWorldCategory already carries a well-tuned rule
// set full of real material names — hedione, calone, cashmeran, habanolide, ethylene brassylate — that
// took real effort to build. It answers in A-Z, so the only new part is the last step: turn its letter
// into a grandfamily.
//
// saas-perfumers ported a generic keyword index instead. Ours is better, so ours stays.

// The 26 -> 11 map. NOT taken on trust from saas-perfumers: every letter was checked against the
// materials actually sitting under it in our own seeded reference data (996 payloads), and the letters I
// most doubted turned out to confirm its table rather than contradict it:
//
//   A  Lauric Acid, Aldehyde C-11 Undecanal, Dodecyl Nitrile  -> Mineral (Aldehydic is a Mineral subfamily)
//   B  Peppermint, Camphor, Borneol, Rosemary, Spearmint      -> Herbal  (Minty, Camphoraceous)
//   D  Octalactone, Delta Decalactone, Gamma Nonalactone      -> Sweet/Balsamic (Lactonic is a subfamily;
//                                                                 I had assumed Soulful, and was wrong)
//   E  Coffee, 2-Acetyl Thiazole, Ethyl Safranate             -> Soulful (roasted, savoury)
//   S  Turmeric, Ginger, Cassia, Myrcene                      -> Woody   (Spicy is a Woody subfamily)
//   Y  Treemoss, Seaweed, Ozone                               -> Mineral (Marine, Ozonic)
const ABC_LETTER_TO_GRANDFAMILY = {
  A: 'Mineral',
  B: 'Herbal',
  C: 'Citrus',
  D: 'Sweet/Balsamic',
  E: 'Soulful',
  F: 'Fruity',
  G: 'Green',
  H: 'Herbal',
  I: 'Floral',
  J: 'Floral',
  K: 'Woody',
  L: 'Floral',
  M: 'Floral',
  N: 'Floral',
  O: 'Floral',
  P: 'Industrial',
  Q: 'Sweet/Balsamic',
  R: 'Floral',
  S: 'Woody',
  T: 'Woody',
  U: 'Animalic',
  V: 'Sweet/Balsamic',
  W: 'Woody',
  X: 'Animalic',
  Y: 'Mineral',
  Z: 'Industrial',
};

// Strictly ONE letter. Taking the first letter of any string instead would file every unrecognised
// category under whatever it happens to start with — "qqq" came back as Sweet/Balsamic, and a free-text
// category the owner typed would be silently shelved somewhere confident and wrong.
export const grandfamilyForAbcLetter = (letter) => {
  const normalized = String(letter || '').trim().toUpperCase();
  if (normalized.length !== 1) return null;
  return findEcofragranticaGrandfamilyByValue(ABC_LETTER_TO_GRANDFAMILY[normalized]) || null;
};

/**
 * Reading a stored category, whatever vocabulary it is in. Used wherever a material is displayed, so
 * legacy A-Z values keep showing a sensible family BEFORE the migration is applied — otherwise every
 * material would read as uncategorised until Dekito runs the SQL.
 *
 * Anything that is neither vocabulary returns null. A category nobody recognises has no family, and
 * saying so is the only honest answer.
 */
export const resolveScentGrandfamily = (category) => {
  const official = findEcofragranticaGrandfamilyByValue(category);
  if (official) return official;

  const legacy = findPerfumersWorldCategoryByValue(category);
  return legacy ? grandfamilyForAbcLetter(legacy.code) : null;
};

export const isOfficialScentTaxonomyCategory = (value) => Boolean(findEcofragranticaGrandfamilyByValue(value));

export const suggestScentTaxonomyCategory = ({ workbookCode = '', name = '', legacyCategory = '' } = {}) => {
  const already = findEcofragranticaGrandfamilyByValue(legacyCategory);
  if (already) {
    return { category: already, confidence: 'exact', reason: 'Sudah memakai taksonomi resmi.' };
  }

  // A stored A-Z value is a fact about this material, not a guess — map it directly and say so.
  const stored = findPerfumersWorldCategoryByValue(legacyCategory);
  const fromStored = stored ? grandfamilyForAbcLetter(stored.code) : null;
  if (fromStored) {
    return {
      category: fromStored,
      confidence: 'exact',
      reason: `Kategori ${stored.code} masuk ke grandfamily ${fromStored.label}.`,
    };
  }

  // Otherwise fall back to the A-Z keyword rules and translate their answer. The confidence they report
  // is carried through unchanged: the mapping step adds no certainty, so it must not claim any.
  const abc = suggestPerfumersWorldCategory({ workbookCode, name, legacyCategory });
  const mapped = abc?.category ? grandfamilyForAbcLetter(abc.category.code) : null;
  if (mapped) {
    return {
      category: mapped,
      confidence: abc.confidence,
      reason: `${abc.reason} -> ${mapped.label}.`,
    };
  }

  return { category: null, confidence: 'none', reason: 'Belum ada saran yang cukup aman.' };
};
