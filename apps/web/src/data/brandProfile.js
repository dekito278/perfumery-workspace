// What the house IS, in one place, because several places need to agree about it.
//
// Written for the Fragrantica submission (Oct 2026), where a brand is entered once by an editor who
// copies it off the website. Everything here is sourced from the shop itself — the tagline, the
// concentration, the size, the fact that Dekito blends and packs every bottle — and nothing is
// inferred from a database timestamp. `storefront_products.created_at` is when a row was made in this
// app, not when a perfume was released; the two are years apart and only one of them is true.
//
// STATED, not inferred. `foundedYear` and `city` were blank until 9 Oct 2026, when Dekito answered the
// question this file was written to ask: "Rilis dari 2023, kota bogor." They are Dekito's words and nothing
// here derives them from anything — a founding year is quoted back forever once a public database has
// it, which is why it waited for Dekito rather than being read off `created_at`.
// Since 2026-11-03 Dekito can change the city and the founding year in Studio (Fakta toko); the values
// Dekito stated are the defaults there, read from one place so the two files cannot disagree.
import { DEFAULT_SITE_FACTS } from './siteFacts.js';

export const BRAND_PROFILE = {
  name: 'SOLIVAGANT',
  perfumer: 'Dekito',
  country: 'Indonesia',
  city: DEFAULT_SITE_FACTS.brandCity,
  foundedYear: DEFAULT_SITE_FACTS.brandFoundedYear,
  concentration: 'Eau de Parfum',
  sizeMl: 30,
  website: 'https://www.solivagantscent.com',
};

/** "Bogor, Indonesia" once the city is known; "Indonesia" until then. Never a stray comma. */
export const brandOrigin = (city = BRAND_PROFILE.city) => [city, BRAND_PROFILE.country]
  .map((part) => String(part || '').trim())
  .filter(Boolean)
  .join(', ');

/** The facts an editor copies, as label/value pairs, skipping the ones nobody has stated yet. */
export const brandFacts = ({ fragranceCount = 0, city = BRAND_PROFILE.city, foundedYear = BRAND_PROFILE.foundedYear } = {}) => [
  { key: 'house', value: BRAND_PROFILE.name },
  { key: 'perfumer', value: BRAND_PROFILE.perfumer },
  { key: 'origin', value: brandOrigin(city) },
  { key: 'founded', value: foundedYear ? String(foundedYear) : '' },
  { key: 'fragrances', value: fragranceCount > 0 ? String(fragranceCount) : '' },
  { key: 'concentration', value: BRAND_PROFILE.concentration },
  { key: 'size', value: `${BRAND_PROFILE.sizeMl} ml` },
].filter((fact) => String(fact.value || '').trim());
