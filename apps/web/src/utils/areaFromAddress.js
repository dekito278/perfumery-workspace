// Which delivery area an address names, and when a search result may be taken for it without asking.
//
// Visitor audit, 13 Nov 2026: picking a courier searched the destination list with the WHOLE address and
// took the first hit. "Jl. Ir. H. Juanda 100, Coblong, Bandung" became "PAL SERATUS/100, BERMANI ULU RAYA,
// REJANG LEBONG, BENGKULU" — the house number matched a village name — and the shipping was quoted there.
// "Kebayoran Baru, Jakarta Selatan" became Kebayoran Lama Selatan. A wrong area is a wrong fee and,
// worse, a parcel addressed to the wrong district.
//
// Two rules, shared by the checkout and the bespoke page:
//   1. search with the AREA part of the address (the kecamatan and the city), never the street;
//   2. pick a result on the buyer's behalf only when it names every word of that area. Otherwise the
//      results are listed and the buyer chooses.
// Import-free so the guard runs it.

const STREET_PART = /^(jl|jln|jalan|gg|gang|komp|komplek|kompleks|perum|perumahan|blok|no|nomor|ruko|apartemen|apt|tower|lantai|lt|dusun|dsn|rt|rw)\b\.?/i;
const AREA_PREFIX = /^(kec|kecamatan|kel|kelurahan|desa|ds|kab|kabupaten|kota|kotamadya|provinsi|prov)\b\.?\s*/i;
// A province says too little to choose a district by, so it is left out of the search and never counts as
// one of the two parts a confident pick needs. "Yogyakarta" and "Jakarta" are cities too, so only the
// province-only forms are listed.
const PROVINCES = new Set([
  'ACEH', 'SUMATERA UTARA', 'SUMUT', 'SUMATERA BARAT', 'SUMBAR', 'RIAU', 'KEPULAUAN RIAU', 'KEPRI', 'JAMBI',
  'SUMATERA SELATAN', 'SUMSEL', 'BANGKA BELITUNG', 'BABEL', 'BENGKULU', 'LAMPUNG', 'DKI JAKARTA', 'DKI',
  'JAWA BARAT', 'JABAR', 'JAWA TENGAH', 'JATENG', 'DI YOGYAKARTA', 'DIY', 'JAWA TIMUR', 'JATIM', 'BANTEN',
  'BALI', 'NUSA TENGGARA BARAT', 'NTB', 'NUSA TENGGARA TIMUR', 'NTT', 'KALIMANTAN BARAT', 'KALBAR',
  'KALIMANTAN TENGAH', 'KALTENG', 'KALIMANTAN SELATAN', 'KALSEL', 'KALIMANTAN TIMUR', 'KALTIM',
  'KALIMANTAN UTARA', 'KALTARA', 'SULAWESI UTARA', 'SULUT', 'SULAWESI TENGAH', 'SULTENG', 'SULAWESI SELATAN',
  'SULSEL', 'SULAWESI TENGGARA', 'SULTRA', 'SULAWESI BARAT', 'SULBAR', 'GORONTALO', 'MALUKU', 'MALUKU UTARA',
  'PAPUA', 'PAPUA BARAT', 'PAPUA SELATAN', 'PAPUA TENGAH', 'PAPUA PEGUNUNGAN', 'PAPUA BARAT DAYA', 'INDONESIA',
]);
const isProvince = (part) => PROVINCES.has(String(part || '').toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim());

const NOISE_WORDS = new Set(['DAN', 'DI', 'KOTA', 'KAB', 'KABUPATEN', 'KEC', 'KECAMATAN', 'KEL', 'KELURAHAN', 'DESA', 'PROVINSI', 'PROV']);

const cleanPart = (part) => String(part || '')
  .replace(/\b\d{5}\b/g, '') // a postcode
  .replace(AREA_PREFIX, '')
  .replace(/\s+/g, ' ')
  .trim();

/** The kecamatan and city an address names, for the destination search. '' when none can be told apart. */
export const areaQueryFromAddress = (address = '') => {
  const raw = String(address || '').trim();
  if (!raw) return '';
  const parts = raw.split(/[,\n;]+/).map((part) => part.trim()).filter(Boolean);
  const areaParts = parts
    .filter((part) => !STREET_PART.test(part))
    .filter((part) => !/\d/.test(part.replace(/\b\d{5}\b/g, ''))) // a house number, "Km 5", RT 01/RW 02
    .map(cleanPart)
    .filter((part) => part && !isProvince(part));
  if (areaParts.length) return areaParts.slice(-2).join(', ');
  // One line, no commas: drop everything up to the last number ("Jl Juanda 100 Coblong Bandung").
  const tail = raw.replace(/^.*\d+[a-z]?\b\s*/i, '').trim();
  return cleanPart(tail);
};

const wordsOf = (text) => String(text || '')
  .toUpperCase()
  .split(/[^A-Z0-9]+/)
  .filter((word) => word.length >= 3 && !NOISE_WORDS.has(word));

/** Whether a destination label names every word of the area the buyer wrote. */
export const isConfidentAreaMatch = (query, label) => {
  const wanted = wordsOf(query);
  if (!wanted.length) return false;
  const have = new Set(wordsOf(label));
  return wanted.every((word) => have.has(word));
};

/**
 * The first result that confidently matches, or null: then the buyer is shown the list and picks.
 *
 * Only for an area of TWO parts (kecamatan and city). "Denpasar" alone matches all four Denpasar districts
 * equally well, and taking the first would be the original bug with better manners.
 */
export const pickConfidentDestination = (query, destinations = [], address = '') => {
  const parts = String(query || '').split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const confident = (Array.isArray(destinations) ? destinations : []).filter((destination) => isConfidentAreaMatch(query, destination?.label));
  if (!confident.length) return null;
  // Labels lead with the kelurahan ("DAGO, COBLONG, BANDUNG, JAWA BARAT, 40135"). When the address names
  // one of them — often in the street itself, "Jl. Dago 5" — that one, so the postcode is right too.
  const addressWords = new Set(wordsOf(address));
  const named = confident.find((destination) => {
    const village = wordsOf(String(destination?.label || '').split(',')[0]);
    return village.length && village.every((word) => addressWords.has(word));
  });
  return named || confident[0];
};

/**
 * What to search with: the area field the buyer typed wins (it is an area already); otherwise the area
 * part of the address. The full address is never the search text.
 */
export const destinationSearchText = ({ areaText = '', address = '' } = {}) => {
  const area = String(areaText || '').trim();
  if (area) return area;
  return areaQueryFromAddress(address);
};
