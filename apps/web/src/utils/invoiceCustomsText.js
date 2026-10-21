// What a shipping document is allowed to call the goods.
//
// NOT A STYLE RULE. A parcel to the United States was held by Fish and Wildlife because a declaration
// said "oud" — a word that reads, to an inspector with a species list, like an Aquilaria extract.
// Nothing SOLIVAGANT ships contains it: the oud and the sandalwood are reconstructions and the musks
// are synthetic. So the declaration says what the bottle is, in the words customs uses, and never the
// perfumer's vocabulary.
//
// Dekito's brief, §8: the description is ALWAYS these strings. Never oud, Aquilaria, animalic, musk, or
// the name of an animal.
//
// Import-free so the guard runs it.

/** The words a declaration may never carry, whatever the perfume is called. */
export const FORBIDDEN_CUSTOMS_WORDS = [
  'oud', 'aquilaria', 'animalic', 'musk', 'ambergris', 'civet', 'castoreum', 'deer', 'hyraceum',
];

export const BOTTLE_CUSTOMS_DESCRIPTION = 'Perfume, alcohol-based, synthetic fragrance, 30 ml';

/** The gift vial, at whatever size the shop is filling. 3 ml since 2026-10-21. */
export const vialCustomsDescription = (sizeMl) => `Perfume sample, ${sizeMl} ml`;

/**
 * Does this text name something a species list would stop?
 *
 * Whole words only: "Maskumambang" is a Javanese verse form and contains none of these, but a
 * substring match on "musk" would flag it — and flagging a product name nobody can change would make
 * the rule unusable and then ignored.
 */
export const namesAForbiddenIngredient = (text) => {
  const haystack = String(text || '').toLowerCase();
  return FORBIDDEN_CUSTOMS_WORDS.some((word) => new RegExp(`\\b${word}s?\\b`).test(haystack));
};
