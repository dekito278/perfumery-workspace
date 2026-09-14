// useCatalogProducts hangs non-enumerable flags off the products ARRAY — `loading`, and now `stale`.
// Every transform between that hook and the screen rebuilds the array with .map, which drops them, so
// each transform has to carry them forward by hand.
//
// One helper rather than a line repeated in each: the flags were carried in two places already, and a
// third flag added to only one of them is a screen that thinks the catalogue is fresh when it is not.
export const CATALOG_ARRAY_FLAGS = ['loading', 'stale'];

export const carryCatalogFlags = (next, source) => {
  if (!Array.isArray(next) || next === source) return next;
  for (const flag of CATALOG_ARRAY_FLAGS) {
    Object.defineProperty(next, flag, {
      configurable: true,
      enumerable: false,
      value: Boolean(source?.[flag]),
    });
  }
  return next;
};
