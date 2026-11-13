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
export const pickConfidentDestination = (typed, destinations = [], address = '') => {
  // Compared in the courier's spelling, the same one the search was made in ("Gedongtengen").
  const query = courierAreaSpelling(typed);
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

// --- What the courier list calls a place, and which results to show first ------------------------------
//
// Fourth visitor audit, 13 Nov 2026: "Gedongtengen" found nothing (the courier list writes GEDONG TENGEN),
// "Jogja" offered a village in Aceh, "Kuta" listed five Aceh villages before Kuta in Badung, and
// "Kebayoran Baru" put Kebayoran Lama first. The search behind it is the courier's; what the shop can do
// is ask it in the courier's spelling, and show the results that name what the buyer typed first.

// Only names a buyer commonly writes and the courier list spells otherwise. Each is a fact about the
// courier data (checked against the live search), never a guess at what a buyer meant.
const AREA_SPELLINGS = [
  [/\b(jogja|jogjakarta|jogya|yogya)\b/gi, 'Yogyakarta'],
  [/\bgedongtengen\b/gi, 'Gedong Tengen'],
  [/\bjaksel\b/gi, 'Jakarta Selatan'],
  [/\bjakpus\b/gi, 'Jakarta Pusat'],
  [/\bjakbar\b/gi, 'Jakarta Barat'],
  [/\bjaktim\b/gi, 'Jakarta Timur'],
  [/\bjakut\b/gi, 'Jakarta Utara'],
];

/** The area text in the courier list's spelling: "Gedongtengen, Jogja" -> "Gedong Tengen, Yogyakarta". */
export const courierAreaSpelling = (text = '') => AREA_SPELLINGS
  .reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), String(text || ''));

const squash = (text) => String(text || '').toUpperCase().replace(/[^A-Z0-9]+/g, '');

/** The first part of the area the buyer typed (the kecamatan, or the only word), spaces ignored. */
const firstAreaPart = (query) => squash(String(query || '').split(',')[0]);

/** Whether some result names the buyer's first area part as its kelurahan or kecamatan. */
export const resultsNameTheArea = (query, destinations = []) => {
  const wanted = firstAreaPart(query);
  if (!wanted) return true;
  return (Array.isArray(destinations) ? destinations : []).some((destination) => {
    const [village, district] = String(destination?.label || '').split(',');
    return squash(village) === wanted || squash(district) === wanted;
  });
};

/**
 * The results with what the buyer typed first: the kecamatan named exactly, then the kelurahan, then a
 * label holding every word, then one naming the city. Ties keep the courier's order. Nothing is dropped.
 */
export const rankDestinations = (query, destinations = []) => {
  const list = Array.isArray(destinations) ? destinations : [];
  const wanted = firstAreaPart(query);
  const cityPart = String(query || '').split(',').slice(1).map(squash).filter(Boolean);
  const score = (destination) => {
    const parts = String(destination?.label || '').split(',').map(squash);
    let points = 0;
    if (wanted && parts[1] === wanted) points += 8;
    if (wanted && parts[0] === wanted) points += 4;
    if (isConfidentAreaMatch(query, destination?.label)) points += 2;
    if (cityPart.length && cityPart.every((city) => parts.slice(1).includes(city))) points += 1;
    return points;
  };
  return list
    .map((destination, index) => ({ destination, index, points: score(destination) }))
    .sort((a, b) => (b.points - a.points) || (a.index - b.index))
    .map(({ destination }) => destination);
};
