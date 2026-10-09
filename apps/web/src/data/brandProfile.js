// What the house IS, in one place, because several places need to agree about it.
//
// Written for the Fragrantica submission (Oct 2026), where a brand is entered once by an editor who
// copies it off the website. Everything here is sourced from the shop itself — the tagline, the
// concentration, the size, the fact that Dekito blends and packs every bottle — and nothing is
// inferred from a database timestamp. `storefront_products.created_at` is when a row was made in this
// app, not when a perfume was released; the two are years apart and only one of them is true.
//
// EMPTY ON PURPOSE. `foundedYear` and `city` are blank because the shop has never stated either, and a
// founding year is the kind of fact that is quoted back forever once a public database has it. Fill
// them when Dekito says them; every line below renders only when it has something to render, so the
// page is complete and honest without them rather than showing a placeholder to a buyer.
export const BRAND_PROFILE = {
  name: 'SOLIVAGANT',
  perfumer: 'Dekito',
  country: 'Indonesia',
  city: '',
  foundedYear: null,
  concentration: 'Eau de Parfum',
  sizeMl: 30,
  website: 'https://www.solivagantscent.com',
};

/** "Bogor, Indonesia" once the city is known; "Indonesia" until then. Never a stray comma. */
export const brandOrigin = () => [BRAND_PROFILE.city, BRAND_PROFILE.country]
  .map((part) => String(part || '').trim())
  .filter(Boolean)
  .join(', ');

/** The facts an editor copies, as label/value pairs, skipping the ones nobody has stated yet. */
export const brandFacts = ({ fragranceCount = 0 } = {}) => [
  { key: 'house', value: BRAND_PROFILE.name },
  { key: 'perfumer', value: BRAND_PROFILE.perfumer },
  { key: 'origin', value: brandOrigin() },
  { key: 'founded', value: BRAND_PROFILE.foundedYear ? String(BRAND_PROFILE.foundedYear) : '' },
  { key: 'fragrances', value: fragranceCount > 0 ? String(fragranceCount) : '' },
  { key: 'concentration', value: BRAND_PROFILE.concentration },
  { key: 'size', value: `${BRAND_PROFILE.sizeMl} ml` },
].filter((fact) => String(fact.value || '').trim());
