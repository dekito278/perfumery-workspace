// Finding one country in a list of two hundred.
//
// The destination list is a native <select>, which has no search of its own: reaching Malaysia meant
// scrolling past a hundred names. A text box filters it — but the filtering has one rule that is easy
// to get wrong and silent when it is, so it lives here where a check can run it.
//
// THE SELECTED COUNTRY IS NEVER FILTERED OUT. A <select> whose value is not among its options renders
// as blank in some browsers and silently jumps to the first option in others — so a search for "jep"
// after choosing Malaysia would either blank the field or quietly re-quote the whole order to
// Afghanistan. It stays in the list, always, at the position it already had.

const normalise = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  // Strip combining accents so "Réunion" is reachable by typing "reunion".
  .replace(/[̀-ͯ]/g, '')
  .trim();

/**
 * @param destinations  [{ code, name, zone }]
 * @param query         what was typed, may be empty
 * @param selectedCode  the country currently chosen, which always survives the filter
 */
export const filterDestinations = (destinations = [], query = '', selectedCode = '') => {
  const needle = normalise(query);
  if (!needle) return destinations;
  return destinations.filter((item) => (
    item.code === selectedCode
    || normalise(item.name).includes(needle)
    // The two-letter code, for whoever already knows it. Exact match only: a substring match on a
    // 2-character code turns every "my" into a match for Myanmar AND Malaysia by accident.
    || normalise(item.code) === needle
  ));
};

/**
 * How many countries the query actually FOUND — which is not the same as how many are on screen, since
 * the selected one is there whether it matched or not. Printing the list length would tell Dekito
 * "1 hasil" for a search that found nothing at all.
 */
export const countMatches = (destinations = [], query = '') => {
  const needle = normalise(query);
  if (!needle) return destinations.length;
  return destinations.filter((item) => (
    normalise(item.name).includes(needle) || normalise(item.code) === needle
  )).length;
};

export default filterDestinations;
