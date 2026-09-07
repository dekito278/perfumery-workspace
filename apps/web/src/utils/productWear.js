// When a fragrance is for. The vocabulary is fixed on purpose: a wardrobe that filters on free text
// filters on nothing, because "malam" and "Malam hari" and "evening" never meet.
//
// Kept small enough to tag eighteen products in a sitting. Anything the owner cannot answer in two
// seconds per bottle will simply not get filled, and an unfilled facet is worse than no facet.
export const WEAR_FACETS = {
  occasions: {
    label: 'Momen',
    options: [
      { value: 'kerja', label: 'Kerja' },
      { value: 'santai', label: 'Santai' },
      { value: 'malam', label: 'Malam spesial' },
      { value: 'perayaan', label: 'Perayaan' },
      { value: 'perjalanan', label: 'Perjalanan' },
    ],
  },
  times: {
    label: 'Waktu',
    options: [
      { value: 'pagi', label: 'Pagi' },
      { value: 'siang', label: 'Siang' },
      { value: 'sore', label: 'Sore' },
      { value: 'malam', label: 'Malam' },
    ],
  },
  weather: {
    label: 'Cuaca',
    options: [
      { value: 'panas', label: 'Panas' },
      { value: 'hujan', label: 'Hujan' },
      { value: 'sejuk', label: 'Sejuk' },
    ],
  },
};

export const WEAR_KEYS = Object.keys(WEAR_FACETS);

const allowed = (facet) => new Set(WEAR_FACETS[facet].options.map((o) => o.value));

// The stored shape, whatever arrived. Rows written before the column existed hold {}, a hand-edited
// row could hold anything, and the studio must not crash on either.
export const normalizeWear = (wear) => {
  const source = wear && typeof wear === 'object' && !Array.isArray(wear) ? wear : {};
  return WEAR_KEYS.reduce((out, facet) => {
    const raw = Array.isArray(source[facet]) ? source[facet] : [];
    const ok = allowed(facet);
    out[facet] = [...new Set(raw.map((v) => String(v).trim().toLowerCase()).filter((v) => ok.has(v)))];
    return out;
  }, {});
};

export const isWearTagged = (wear) => {
  const w = normalizeWear(wear);
  return WEAR_KEYS.some((facet) => w[facet].length > 0);
};

export const toggleWearValue = (wear, facet, value) => {
  const w = normalizeWear(wear);
  if (!WEAR_KEYS.includes(facet) || !allowed(facet).has(value)) return w;
  const has = w[facet].includes(value);
  return { ...w, [facet]: has ? w[facet].filter((v) => v !== value) : [...w[facet], value] };
};

// A product matches when it satisfies every facet the visitor set. An untagged facet on the product
// cannot match — silence is not a yes. Facets the visitor left alone are ignored.
export const matchesWear = (wear, selection = {}) => {
  const w = normalizeWear(wear);
  return WEAR_KEYS.every((facet) => {
    // Accept a bare string as well as an array. A caller passing 'kerja' used to fall through to
    // "no filter set", which reads as a working filter that quietly returns the whole catalogue.
    const raw = selection[facet];
    const wanted = (Array.isArray(raw) ? raw : [raw]).filter((v) => typeof v === 'string' && v.trim());
    if (!wanted.length) return true;
    return wanted.some((value) => w[facet].includes(value.trim().toLowerCase()));
  });
};

export const describeWear = (wear) => {
  const w = normalizeWear(wear);
  return WEAR_KEYS.flatMap((facet) => (
    w[facet].map((value) => WEAR_FACETS[facet].options.find((o) => o.value === value)?.label).filter(Boolean)
  ));
};
