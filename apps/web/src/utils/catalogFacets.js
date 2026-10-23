// How many bottles are behind each filter pill.
//
// A pill that says only "WOODY" asks the buyer to tap to find out whether there is anything there, and
// sometimes the answer is nothing — a dead end they paid a tap for. The number is knowable before the
// tap, so it is shown.
//
// COUNTED AGAINST WHAT IS ALREADY NARROWED, never against the whole catalogue. Once someone has typed
// "vanilla", a pill reading "FLORAL 8" would be a lie: the honest number is how many they would see if
// they pressed it now. The caller narrows by search and by wear first, and passes that list in.
//
// Pure and import-free so the self-check runs the real thing rather than a copy of it.

/**
 * @param products   the list already narrowed by everything EXCEPT the category
 * @param categories the pills, in the order they are shown
 * @param matches    (product, category) -> boolean — the same predicate the grid filters with, passed
 *                   in rather than imported so this file cannot drift from it
 * @returns { [category]: count }
 */
export const catalogPillCounts = (products = [], categories = [], matches = () => true) => {
  const list = Array.isArray(products) ? products : [];
  const counts = {};
  for (const category of Array.isArray(categories) ? categories : []) {
    counts[category] = list.filter((product) => matches(product, category)).length;
  }
  return counts;
};

/**
 * Is this pill worth offering?
 *
 * "All" always is, even at zero: it is how a buyer gets back out of a filter that found nothing. Any
 * other pill at zero leads to an empty grid, so it is disabled rather than left as a trap.
 */
export const pillIsOffered = (category, count) => category === 'All' || Number(count) > 0;
