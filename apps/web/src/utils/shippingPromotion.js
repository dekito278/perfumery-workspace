// Isomorphic shipping-promotion logic — pure, ZERO browser/supabase imports so it runs in the client
// AND in a Node serverless endpoint (the authoritative order/shipping path). The cache/localStorage/
// supabase access lives in services/shippingPromotionService.js, which re-exports these. Keep this
// file import-free.

export const SHIPPING_PROMOTION_PRESETS = {
  FREE_JAVA: 'free_java',
  FREE_JAVA_DISCOUNT_OTHER: 'free_java_discount_other',
  FLAT_JAVA: 'flat_java',
  FLAT_JAVA_DISCOUNT_OTHER: 'flat_java_discount_other',
  FREE_ALL: 'free_all',
  DISCOUNT_ALL: 'discount_all',
};

const JAVA_KEYWORDS = [
  'jakarta',
  'yogyakarta',
  'jogja',
  'bandung',
  'bekasi',
  'bogor',
  'depok',
  'tangerang',
  'cirebon',
  'semarang',
  'solo',
  'surakarta',
  'magelang',
  'sleman',
  'surabaya',
  'malang',
  'sidoarjo',
  // No 'kediri': there is a Kediri in Lombok Barat (NTB) as well as the Javanese one, and this list is
  // only a fallback for destinations that arrive without province data. Kediri, Jawa Timur is still
  // matched by its province. A promo must fail closed, not hand free shipping to another island.
];

const JAVA_PROVINCES = new Set([
  'banten',
  'dki jakarta',
  'daerah khusus ibukota jakarta',
  'jakarta raya',
  'jawa barat',
  'jawa tengah',
  'di yogyakarta',
  'daerah istimewa yogyakarta',
  'jawa timur',
]);

export const defaultShippingPromotionSettings = {
  enabled: false,
  preset: SHIPPING_PROMOTION_PRESETS.FREE_JAVA_DISCOUNT_OTHER,
  javaAmount: 10000,
  otherAmount: 10000,
  minimumSubtotal: 0,
  startsAt: '',
  endsAt: '',
  updatedAt: '',
};

export const shippingPromotionPresetLabels = {
  [SHIPPING_PROMOTION_PRESETS.FREE_JAVA]: 'Pulau Jawa gratis ongkir',
  [SHIPPING_PROMOTION_PRESETS.FREE_JAVA_DISCOUNT_OTHER]: 'Jawa gratis, luar Jawa diskon ongkir',
  [SHIPPING_PROMOTION_PRESETS.FLAT_JAVA]: 'Pulau Jawa ongkir maksimal',
  [SHIPPING_PROMOTION_PRESETS.FLAT_JAVA_DISCOUNT_OTHER]: 'Jawa maksimal, luar Jawa diskon',
  [SHIPPING_PROMOTION_PRESETS.FREE_ALL]: 'Semua area gratis ongkir',
  [SHIPPING_PROMOTION_PRESETS.DISCOUNT_ALL]: 'Semua area diskon ongkir',
};

const formatRupiah = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const normalizeAreaText = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\bd\.?\s*i\.?\b/g, 'di')
  .replace(/\bd\.?\s*k\.?\s*i\.?\b/g, 'dki')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const JAVA_FALLBACK_KEYWORDS = [...JAVA_PROVINCES, ...JAVA_KEYWORDS].map(normalizeAreaText);

// Whole-phrase match, not substring: `includes('solo')` was true for "Solok, Sumatera Barat", so a promo
// with free Java shipping shipped to West Sumatra for nothing. Padding both sides means a keyword only
// matches on word boundaries, and multi-word province names still work (audit round 9).
const containsWholePhrase = (text, phrase) => ` ${text} `.includes(` ${phrase} `);

export const normalizeShippingPromotionSettings = (settings = {}) => ({
  ...defaultShippingPromotionSettings,
  ...settings,
  enabled: settings.enabled === true,
  preset: Object.values(SHIPPING_PROMOTION_PRESETS).includes(settings.preset)
    ? settings.preset
    : defaultShippingPromotionSettings.preset,
  javaAmount: Math.max(Number(settings.javaAmount ?? defaultShippingPromotionSettings.javaAmount), 0),
  otherAmount: Math.max(Number(settings.otherAmount ?? defaultShippingPromotionSettings.otherAmount), 0),
  minimumSubtotal: Math.max(Number(settings.minimumSubtotal || 0), 0),
  startsAt: String(settings.startsAt || settings.starts_at || '').trim(),
  endsAt: String(settings.endsAt || settings.ends_at || '').trim(),
});

const getDestinationProvinceCandidates = (destination, rate) => [
  destination?.provinceName,
  destination?.province_name,
  destination?.province,
  destination?.administrativeArea,
  destination?.administrative_area,
  rate?.provinceName,
  rate?.province_name,
  rate?.province,
].map(normalizeAreaText).filter(Boolean);

const destinationToSearchText = (destination, rate) => [
  destination?.label,
  destination?.name,
  destination?.cityName,
  destination?.city,
  destination?.districtName,
  destination?.subdistrictName,
  destination?.provinceName,
  destination?.province,
  destination?.fullName,
  rate?.destinationLabel,
  rate?.destinationName,
].map(normalizeAreaText).filter(Boolean).join(' ');

export const getShippingDestinationArea = (destination, rate) => {
  const provinceMatch = getDestinationProvinceCandidates(destination, rate)
    .find((province) => JAVA_PROVINCES.has(province));

  if (provinceMatch) {
    return { area: 'java', matchedBy: 'province', matchedValue: provinceMatch };
  }

  const searchText = destinationToSearchText(destination, rate);
  const keywordMatch = JAVA_FALLBACK_KEYWORDS
    .find((keyword) => containsWholePhrase(searchText, keyword));

  if (keywordMatch) {
    return { area: 'java', matchedBy: 'keyword', matchedValue: keywordMatch };
  }

  return { area: 'other', matchedBy: 'fallback', matchedValue: '' };
};

export const isJavaShippingDestination = (destination, rate) => {
  return getShippingDestinationArea(destination, rate).area === 'java';
};

const getAreaAdjustment = ({ settings, destination, rate, areaInfo = getShippingDestinationArea(destination, rate) }) => {
  const isJava = areaInfo.area === 'java';
  const javaAmount = Number(settings.javaAmount || 0);
  const otherAmount = Number(settings.otherAmount || 0);

  switch (settings.preset) {
    case SHIPPING_PROMOTION_PRESETS.FREE_JAVA:
      return isJava ? { type: 'free', amount: 0, label: 'Gratis ongkir Pulau Jawa' } : null;
    case SHIPPING_PROMOTION_PRESETS.FREE_JAVA_DISCOUNT_OTHER:
      return isJava
        ? { type: 'free', amount: 0, label: 'Gratis ongkir Pulau Jawa' }
        : { type: 'discount', amount: otherAmount, label: `Diskon ongkir luar Jawa ${formatRupiah(otherAmount)}` };
    case SHIPPING_PROMOTION_PRESETS.FLAT_JAVA:
      return isJava ? { type: 'flat', amount: javaAmount, label: `Ongkir Pulau Jawa maksimal ${formatRupiah(javaAmount)}` } : null;
    case SHIPPING_PROMOTION_PRESETS.FLAT_JAVA_DISCOUNT_OTHER:
      return isJava
        ? { type: 'flat', amount: javaAmount, label: `Ongkir Pulau Jawa maksimal ${formatRupiah(javaAmount)}` }
        : { type: 'discount', amount: otherAmount, label: `Diskon ongkir luar Jawa ${formatRupiah(otherAmount)}` };
    case SHIPPING_PROMOTION_PRESETS.FREE_ALL:
      return { type: 'free', amount: 0, label: 'Gratis ongkir semua area' };
    case SHIPPING_PROMOTION_PRESETS.DISCOUNT_ALL:
      return { type: 'discount', amount: otherAmount, label: `Diskon ongkir ${formatRupiah(otherAmount)}` };
    default:
      return null;
  }
};

const applyAdjustment = (cost, adjustment) => {
  const originalCost = Math.max(Number(cost || 0), 0);
  if (!adjustment) return originalCost;
  if (adjustment.type === 'free') return 0;
  if (adjustment.type === 'flat') return Math.min(originalCost, Math.max(Number(adjustment.amount || 0), 0));
  if (adjustment.type === 'discount') return Math.max(originalCost - Number(adjustment.amount || 0), 0);
  return originalCost;
};

const getDateTime = (value, endOfDay = false) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return null;

  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
    ? `${rawValue}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`
    : rawValue;
  const time = new Date(normalizedValue).getTime();
  return Number.isFinite(time) ? time : null;
};

export const getShippingPromotionEligibility = (settings, subtotal = 0, now = Date.now()) => {
  const normalizedSettings = normalizeShippingPromotionSettings(settings);
  if (!normalizedSettings.enabled) {
    return { eligible: false, reason: 'Promo ongkir nonaktif' };
  }

  const minimumSubtotal = Number(normalizedSettings.minimumSubtotal || 0);
  if (minimumSubtotal > 0 && Number(subtotal || 0) < minimumSubtotal) {
    return { eligible: false, reason: `Minimal belanja ${formatRupiah(minimumSubtotal)}` };
  }

  const startsAt = getDateTime(normalizedSettings.startsAt);
  if (startsAt && now < startsAt) {
    return { eligible: false, reason: 'Promo ongkir belum mulai' };
  }

  const endsAt = getDateTime(normalizedSettings.endsAt, true);
  if (endsAt && now > endsAt) {
    return { eligible: false, reason: 'Promo ongkir sudah berakhir' };
  }

  return { eligible: true, reason: '' };
};

// NOTE: no cache default here (the client wrapper in shippingPromotionService adds the cache settings).
export const applyShippingPromotionToRates = (rates = [], destination, settings = defaultShippingPromotionSettings, context = {}) => {
  const normalizedSettings = normalizeShippingPromotionSettings(settings);
  const eligibility = getShippingPromotionEligibility(normalizedSettings, context.subtotal);
  if (!eligibility.eligible) {
    return rates;
  }

  return rates.map((rate) => {
    const originalCost = Math.max(Number(rate.cost || 0), 0);
    const areaInfo = getShippingDestinationArea(destination, rate);
    const adjustment = getAreaAdjustment({ settings: normalizedSettings, destination, rate, areaInfo });
    const adjustedCost = applyAdjustment(originalCost, adjustment);
    const promotionApplied = Boolean(adjustment && adjustedCost !== originalCost);

    return {
      ...rate,
      cost: adjustedCost,
      originalCost,
      promotionApplied,
      promotionLabel: promotionApplied ? adjustment.label : '',
      promotionSavings: Math.max(originalCost - adjustedCost, 0),
      promotionArea: areaInfo.area,
      promotionAreaMatchedBy: areaInfo.matchedBy,
    };
  });
};

export const getShippingPromotionPreview = (settings) => {
  const normalizedSettings = normalizeShippingPromotionSettings(settings);
  if (!normalizedSettings.enabled) {
    return 'Promo ongkir nonaktif. Checkout memakai tarif kurir normal.';
  }

  const javaAmount = formatRupiah(normalizedSettings.javaAmount);
  const otherAmount = formatRupiah(normalizedSettings.otherAmount);

  const minimumText = normalizedSettings.minimumSubtotal > 0
    ? ` Berlaku untuk belanja minimal ${formatRupiah(normalizedSettings.minimumSubtotal)}.`
    : '';
  const periodText = [
    normalizedSettings.startsAt ? `mulai ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(normalizedSettings.startsAt))}` : '',
    normalizedSettings.endsAt ? `sampai ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(normalizedSettings.endsAt))}` : '',
  ].filter(Boolean).join(' ');

  const suffix = `${minimumText}${periodText ? ` Periode ${periodText}.` : ''}`;

  switch (normalizedSettings.preset) {
    case SHIPPING_PROMOTION_PRESETS.FREE_JAVA:
      return `Pulau Jawa gratis ongkir. Luar Jawa memakai tarif kurir normal.${suffix}`;
    case SHIPPING_PROMOTION_PRESETS.FREE_JAVA_DISCOUNT_OTHER:
      return `Pulau Jawa gratis ongkir. Luar Jawa mendapat potongan ${otherAmount}.${suffix}`;
    case SHIPPING_PROMOTION_PRESETS.FLAT_JAVA:
      return `Pulau Jawa membayar ongkir maksimal ${javaAmount}. Luar Jawa normal.${suffix}`;
    case SHIPPING_PROMOTION_PRESETS.FLAT_JAVA_DISCOUNT_OTHER:
      return `Pulau Jawa membayar ongkir maksimal ${javaAmount}. Luar Jawa mendapat potongan ${otherAmount}.${suffix}`;
    case SHIPPING_PROMOTION_PRESETS.FREE_ALL:
      return `Semua area gratis ongkir.${suffix}`;
    case SHIPPING_PROMOTION_PRESETS.DISCOUNT_ALL:
      return `Semua area mendapat potongan ongkir ${otherAmount}.${suffix}`;
    default:
      return shippingPromotionPresetLabels[normalizedSettings.preset] || '';
  }
};
