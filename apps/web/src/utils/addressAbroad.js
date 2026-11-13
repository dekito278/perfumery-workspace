// Does a typed address end in another country? A HINT for the Indonesian checkout, never a refusal.
//
// Dekito's brief, 14 Nov 2026 (P0-2): rupiah prices are for delivery inside Indonesia. The order server
// enforces that on its own — every rupiah order must carry a domestic courier destination it prices again —
// but a buyer abroad who types "123 Orchard Rd, Singapore" into the Indonesian checkout deserves to be told
// where their order goes BEFORE they hunt for a kecamatan that does not exist.
//
// Only the LAST part of the address is read (after the last comma or line break): Indonesian streets are
// named after countries — Jl. Singapura, Jl. Belanda, Jl. Jepang — and they come first. The country a
// parcel goes to comes last. Import-free apart from the zone table, so a guard can run it.
import { CARD_COUNTRIES, countryNameFor } from './shippingDestination.js';

const fold = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const EXTRA_NAMES = ['usa', 'u.s.a', 'u.s.a.', 'uk', 'england', 'scotland', 'holland', 'korea'];

let names = null;
const countryNames = () => {
  if (names) return names;
  const found = new Set(EXTRA_NAMES);
  for (const code of CARD_COUNTRIES) {
    if (code === 'ID') continue;
    for (const locale of ['en', 'id']) {
      const name = fold(countryNameFor(code, locale));
      if (name && name !== fold(code) && !/indonesia/.test(name)) found.add(name);
    }
  }
  names = [...found].sort((a, b) => b.length - a.length);
  return names;
};

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The country the address ends in, as written, or '' when it reads as Indonesian (or says nothing). */
export const countryAddressEndsIn = (address = '') => {
  const parts = fold(address).split(/[,\n]/).map((part) => part.trim()).filter(Boolean);
  const last = parts[parts.length - 1] || '';
  if (!last || /\bindonesia\b/.test(last)) return '';
  return countryNames().find((name) => new RegExp(`(^|[^a-z])${escape(name)}($|[^a-z])`).test(last)) || '';
};

export const addressLooksAbroad = (address = '') => Boolean(countryAddressEndsIn(address));
