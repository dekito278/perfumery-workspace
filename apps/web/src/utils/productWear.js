// When a fragrance is for. The vocabulary is fixed on purpose: a wardrobe that filters on free text
// filters on nothing, because "malam" and "Malam hari" and "evening" never meet.
//
// Kept small enough to tag eighteen products in a sitting. Anything the owner cannot answer in two
// seconds per bottle will simply not get filled, and an unfilled facet is worse than no facet.
// `value` is what is stored in the database and must never change. `label` is what Studio shows Dekito,
// who reads Indonesian. `labelKey` is what the storefront shows a buyer, who may not — the same option,
// three jobs, and only the middle one is allowed to stay Indonesian forever.
//
// Keys are per facet AND value on purpose: 'malam' is "Malam spesial" under occasions and "Malam" under
// times, and one shared key would quietly make them the same word.
export const WEAR_FACETS = {
  occasions: {
    label: 'Momen',
    labelKey: 'wear.occasions',
    options: [
      { value: 'kerja', label: 'Kerja', labelKey: 'wear.occasions.kerja' },
      { value: 'santai', label: 'Santai', labelKey: 'wear.occasions.santai' },
      { value: 'malam', label: 'Malam spesial', labelKey: 'wear.occasions.malam' },
      { value: 'perayaan', label: 'Perayaan', labelKey: 'wear.occasions.perayaan' },
      { value: 'perjalanan', label: 'Perjalanan', labelKey: 'wear.occasions.perjalanan' },
    ],
  },
  times: {
    label: 'Waktu',
    labelKey: 'wear.times',
    options: [
      { value: 'pagi', label: 'Pagi', labelKey: 'wear.times.pagi' },
      { value: 'siang', label: 'Siang', labelKey: 'wear.times.siang' },
      { value: 'sore', label: 'Sore', labelKey: 'wear.times.sore' },
      { value: 'malam', label: 'Malam', labelKey: 'wear.times.malam' },
    ],
  },
  weather: {
    label: 'Cuaca',
    labelKey: 'wear.weather',
    options: [
      { value: 'panas', label: 'Panas', labelKey: 'wear.weather.panas' },
      { value: 'hujan', label: 'Hujan', labelKey: 'wear.weather.hujan' },
      { value: 'sejuk', label: 'Sejuk', labelKey: 'wear.weather.sejuk' },
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

/**
 * The chips under "wear it for" on a product page, in the shop's language.
 *
 * Like getScarcityLabel, the translator is required and there is no default: falling back to the
 * Indonesian `label` would leave "Malam spesial" sitting in the English shop with nothing to flag it.
 */
export const describeWearStudio = (wear) => {
  const w = normalizeWear(wear);
  return WEAR_KEYS.flatMap((facet) => (
    w[facet].map((value) => WEAR_FACETS[facet].options.find((o) => o.value === value)?.label).filter(Boolean)
  ));
};

export const describeWear = (wear, translate) => {
  if (typeof translate !== 'function') return [];
  const w = normalizeWear(wear);
  return WEAR_KEYS.flatMap((facet) => (
    w[facet]
      .map((value) => WEAR_FACETS[facet].options.find((o) => o.value === value)?.labelKey)
      .filter(Boolean)
      .map((key) => translate(key))
  ));
};
