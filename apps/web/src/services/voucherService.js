import supabase from '@/lib/supabaseClient.js';

export const VOUCHER_STORAGE_KEY = 'dekito.storefront.vouchers.v1';
export const APPLIED_VOUCHER_STORAGE_KEY = 'dekito.storefront.appliedVoucher.v1';
export const VOUCHER_USAGE_STORAGE_KEY = 'dekito.storefront.voucherUsage.v1';
export const VOUCHER_UPDATED_EVENT = 'dekito:vouchers-updated';
export const APPLIED_VOUCHER_UPDATED_EVENT = 'dekito:applied-voucher-updated';

export const VOUCHER_DISCOUNT_TYPES = {
  PERCENT: 'percent',
  FIXED: 'fixed',
};

export const VOUCHER_VALIDATION_REASONS = {
  VALID: 'valid',
  CODE_REQUIRED: 'code_required',
  NOT_FOUND: 'not_found',
  INACTIVE: 'inactive',
  EXPIRED: 'expired',
  MINIMUM_ORDER: 'minimum_order',
  MINIMUM_QUANTITY: 'minimum_quantity',
  USAGE_LIMIT_REACHED: 'usage_limit_reached',
  NOT_APPLICABLE: 'not_applicable',
  INVALID_DISCOUNT: 'invalid_discount',
};

const VALID_DISCOUNT_TYPES = new Set(Object.values(VOUCHER_DISCOUNT_TYPES));
const VOUCHER_TABLE = 'storefront_vouchers';
const VOUCHER_USAGE_TABLE = 'storefront_voucher_usage_records';
let voucherCache = null;

export const normalizeVoucherCode = (code) => String(code || '')
  .trim()
  .toUpperCase()
  .replace(/\s+/g, '');

const makeVoucherId = (code) => `voucher-${normalizeVoucherCode(code).toLowerCase() || Date.now()}`;
const isUuid = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());

const toAmount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(numeric, 0) : 0;
};

const formatNumber = (value) => new Intl.NumberFormat('id-ID').format(toAmount(value));
const formatRupiah = (value) => `Rp ${formatNumber(value)}`;
const formatVoucherDate = (value) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';
  const time = getExpiryTime(rawValue);
  if (!time) return '';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(time));
};

const normalizeTextList = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeSlugList = (value) => (
  normalizeTextList(value).map((item) => item.toLowerCase())
);

const normalizeCategoryList = (value) => (
  normalizeTextList(value).map((item) => item.toLowerCase())
);

const getItemProductKeys = (item = {}) => [
  item.slug,
  item.productSlug,
  item.product_slug,
  item.productId,
  item.product_id,
].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);

const itemMatchesVoucher = (voucher, item) => {
  const productSlugs = normalizeSlugList(voucher.eligibleProductSlugs);
  const categories = normalizeCategoryList(voucher.eligibleCategories);
  if (!productSlugs.length && !categories.length) return true;

  const productKeys = getItemProductKeys(item);
  const itemCategory = String(item?.category || '').trim().toLowerCase();
  return productSlugs.some((slug) => productKeys.includes(slug))
    || (itemCategory && categories.includes(itemCategory));
};

export const getVoucherEligibleItems = (voucher, items = []) => (
  (items || []).filter((item) => itemMatchesVoucher(voucher || {}, item))
);

export const getVoucherEligibleSubtotal = (voucher, items = [], fallbackSubtotal = 0) => {
  const productSlugs = normalizeSlugList(voucher?.eligibleProductSlugs);
  const categories = normalizeCategoryList(voucher?.eligibleCategories);
  if (!productSlugs.length && !categories.length) return toAmount(fallbackSubtotal);
  if (!items?.length) return toAmount(fallbackSubtotal);

  return getVoucherEligibleItems(voucher, items).reduce((sum, item) => (
    sum + (toAmount(item.priceNumber) * Math.max(toAmount(item.quantity), 0))
  ), 0);
};

export const getVoucherEligibleQuantity = (voucher, items = []) => (
  getVoucherEligibleItems(voucher, items).reduce((sum, item) => (
    sum + Math.max(toAmount(item.quantity), 0)
  ), 0)
);

const parseStoredVouchers = (value) => {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readStoredVouchers = () => {
  if (typeof window === 'undefined') return [];
  return parseStoredVouchers(window.localStorage.getItem(VOUCHER_STORAGE_KEY));
};

const writeStoredVouchers = (vouchers) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(VOUCHER_STORAGE_KEY, JSON.stringify(vouchers));
  window.dispatchEvent(new CustomEvent(VOUCHER_UPDATED_EVENT));
};

const dispatchVoucherUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VOUCHER_UPDATED_EVENT));
  }
};

const voucherToPayload = (voucher) => ({
  code: voucher.code,
  discount_type: voucher.discountType,
  discount_value: voucher.discountValue,
  minimum_order: voucher.minimumOrder,
  minimum_quantity: voucher.minimumQuantity,
  expires_at: voucher.expiresAt || null,
  active: voucher.active,
  usage_limit_total: voucher.usageLimitTotal,
  usage_count: voucher.usageCount,
  eligible_product_slugs: normalizeSlugList(voucher.eligibleProductSlugs),
  eligible_categories: normalizeTextList(voucher.eligibleCategories),
});

const normalizeVoucherRows = (rows = []) => rows.map((row, index, rowsList) => (
  normalizeVoucher(row, rowsList.slice(0, index))
));

const cacheVouchers = (vouchers) => {
  voucherCache = vouchers;
  return vouchers;
};

const persistCachedVouchers = (vouchers) => {
  const nextVouchers = cacheVouchers(vouchers);
  writeStoredVouchers(nextVouchers);
  return nextVouchers;
};

const parseStoredUsageRecords = (value) => {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readStoredUsageRecords = () => {
  if (typeof window === 'undefined') return [];
  return parseStoredUsageRecords(window.localStorage.getItem(VOUCHER_USAGE_STORAGE_KEY));
};

export const getAppliedVoucherCode = () => {
  if (typeof window === 'undefined') return '';
  return normalizeVoucherCode(window.localStorage.getItem(APPLIED_VOUCHER_STORAGE_KEY));
};

export const setAppliedVoucherCode = (code) => {
  const normalizedCode = normalizeVoucherCode(code);
  if (typeof window !== 'undefined') {
    if (normalizedCode) {
      window.localStorage.setItem(APPLIED_VOUCHER_STORAGE_KEY, normalizedCode);
    } else {
      window.localStorage.removeItem(APPLIED_VOUCHER_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent(APPLIED_VOUCHER_UPDATED_EVENT));
  }
  return normalizedCode;
};

export const clearAppliedVoucherCode = () => setAppliedVoucherCode('');

const getExpiryTime = (expiresAt) => {
  const rawValue = String(expiresAt || '').trim();
  if (!rawValue) return null;

  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
    ? `${rawValue}T23:59:59.999`
    : rawValue;
  const time = new Date(normalizedDate).getTime();
  return Number.isFinite(time) ? time : null;
};

export const normalizeVoucher = (input = {}, existingVouchers = []) => {
  const code = normalizeVoucherCode(input.code);
  const discountType = VALID_DISCOUNT_TYPES.has(input.discountType || input.discount_type)
    ? (input.discountType || input.discount_type)
    : VOUCHER_DISCOUNT_TYPES.FIXED;
  const currentVoucher = existingVouchers.find((voucher) => (
    voucher.id === input.id || normalizeVoucherCode(voucher.code) === code
  ));
  const createdAt = input.createdAt || input.created_at || currentVoucher?.createdAt || new Date().toISOString();

  return {
    id: input.id || currentVoucher?.id || makeVoucherId(code),
    code,
    discountType,
    discountValue: toAmount(input.discountValue ?? input.discount_value),
    minimumOrder: toAmount(input.minimumOrder ?? input.minimum_order),
    minimumQuantity: toAmount(input.minimumQuantity ?? input.minimum_quantity),
    expiresAt: String(input.expiresAt ?? input.expires_at ?? '').trim(),
    active: input.active === undefined ? true : Boolean(input.active),
    usageLimitTotal: toAmount(input.usageLimitTotal ?? input.usage_limit_total),
    usageCount: toAmount(input.usageCount ?? input.usage_count ?? currentVoucher?.usageCount),
    eligibleProductSlugs: normalizeSlugList(input.eligibleProductSlugs ?? input.eligible_product_slugs ?? currentVoucher?.eligibleProductSlugs),
    eligibleCategories: normalizeTextList(input.eligibleCategories ?? input.eligible_categories ?? currentVoucher?.eligibleCategories),
    createdAt,
    updatedAt: new Date().toISOString(),
  };
};

export const getLocalVouchers = () => readStoredVouchers().map((voucher, index, vouchers) => (
  normalizeVoucher(voucher, vouchers.slice(0, index))
));

export const getCachedVouchers = () => voucherCache || getLocalVouchers();

export const getVouchers = async () => {
  const { data, error } = await supabase
    .from(VOUCHER_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Gagal memuat voucher dari database');
  }

  return cacheVouchers(normalizeVoucherRows(data || []));
};

export const refreshVouchers = async () => {
  const vouchers = await getVouchers();
  dispatchVoucherUpdated();
  return vouchers;
};

export const migrateLocalVouchersToSupabase = async () => {
  const localVouchers = getLocalVouchers();
  if (!localVouchers.length) return [];

  const savedVouchers = [];
  for (const voucher of localVouchers) {
    const normalizedVoucher = normalizeVoucher(voucher, savedVouchers);
    if (!normalizedVoucher.code || normalizedVoucher.discountValue <= 0) continue;

    const { data, error } = await supabase
      .from(VOUCHER_TABLE)
      .upsert(voucherToPayload(normalizedVoucher), { onConflict: 'code' })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Gagal memindahkan voucher lokal ke Supabase');
    }
    savedVouchers.push(normalizeVoucher(data));
  }

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(VOUCHER_STORAGE_KEY);
  }
  cacheVouchers(savedVouchers);
  dispatchVoucherUpdated();
  return savedVouchers;
};

export const findVoucherByCode = (code, vouchers = getCachedVouchers()) => {
  const normalizedCode = normalizeVoucherCode(code);
  if (!normalizedCode) return null;
  return vouchers.find((voucher) => normalizeVoucherCode(voucher.code) === normalizedCode) || null;
};

export const findVoucherByCodeAsync = async (code) => {
  const normalizedCode = normalizeVoucherCode(code);
  if (!normalizedCode) return null;

  const { data, error } = await supabase
    .from(VOUCHER_TABLE)
    .select('*')
    .eq('code', normalizedCode)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Gagal mencari voucher');
  }

  return data ? normalizeVoucher(data) : null;
};

export const saveVoucher = async (input) => {
  const storedVouchers = getCachedVouchers();
  const voucher = normalizeVoucher(input, storedVouchers);

  if (!voucher.code) {
    throw new Error('Kode voucher wajib diisi');
  }
  if (voucher.discountValue <= 0) {
    throw new Error('Nilai diskon voucher wajib lebih dari 0');
  }

  const payload = voucherToPayload(voucher);
  const request = voucher.id && !String(voucher.id).startsWith('voucher-')
    ? supabase.from(VOUCHER_TABLE).update(payload).eq('id', voucher.id).select('*').single()
    : supabase.from(VOUCHER_TABLE).upsert(payload, { onConflict: 'code' }).select('*').single();

  const { data, error } = await request;
  if (error) {
    throw new Error(error.message || 'Gagal menyimpan voucher');
  }

  const savedVoucher = normalizeVoucher(data);
  persistCachedVouchers([
    savedVoucher,
    ...storedVouchers.filter((item) => (
      item.id !== savedVoucher.id && normalizeVoucherCode(item.code) !== savedVoucher.code
    )),
  ]);
  return savedVoucher;
};

export const deleteVoucher = async (idOrCode) => {
  const targetCode = normalizeVoucherCode(idOrCode);
  const idValue = String(idOrCode || '').trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idValue);
  const request = isUuid
    ? supabase.from(VOUCHER_TABLE).delete().eq('id', idValue)
    : supabase.from(VOUCHER_TABLE).delete().eq('code', targetCode);
  const { error } = await request;
  if (error) {
    throw new Error(error.message || 'Gagal menghapus voucher');
  }

  const nextVouchers = getCachedVouchers().filter((voucher) => (
    voucher.id !== idOrCode && normalizeVoucherCode(voucher.code) !== targetCode
  ));
  persistCachedVouchers(nextVouchers);
  return nextVouchers;
};

export const resetVouchers = async () => {
  const { error } = await supabase.from(VOUCHER_TABLE).delete().neq('code', '');
  if (error) {
    throw new Error(error.message || 'Gagal menghapus semua voucher');
  }
  cacheVouchers([]);
  writeStoredVouchers([]);
  return [];
};

export const calculateVoucherDiscount = (voucher, subtotal) => {
  const normalizedVoucher = normalizeVoucher(voucher);
  const orderSubtotal = toAmount(subtotal);

  if (orderSubtotal <= 0 || normalizedVoucher.discountValue <= 0) {
    return 0;
  }

  const rawDiscount = normalizedVoucher.discountType === VOUCHER_DISCOUNT_TYPES.PERCENT
    ? orderSubtotal * (Math.min(normalizedVoucher.discountValue, 100) / 100)
    : normalizedVoucher.discountValue;

  return Math.min(Math.round(rawDiscount), orderSubtotal);
};

export const validateVoucher = ({
  code,
  voucher,
  subtotal = 0,
  items = [],
  vouchers,
  now = new Date(),
} = {}) => {
  const normalizedCode = normalizeVoucherCode(code || voucher?.code);
  if (!normalizedCode) {
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.CODE_REQUIRED,
      message: 'Masukkan kode voucher dulu.',
      voucher: null,
      discountAmount: 0,
    };
  }

  const matchedVoucher = voucher ? normalizeVoucher(voucher) : findVoucherByCode(normalizedCode, vouchers);
  if (!matchedVoucher) {
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.NOT_FOUND,
      message: `Kode voucher ${normalizedCode} tidak ditemukan. Cek lagi penulisannya.`,
      voucher: null,
      discountAmount: 0,
    };
  }

  if (normalizeVoucherCode(matchedVoucher.code) !== normalizedCode) {
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.NOT_FOUND,
      message: `Kode voucher ${normalizedCode} tidak ditemukan. Cek lagi penulisannya.`,
      voucher: null,
      discountAmount: 0,
    };
  }

  if (!matchedVoucher.active) {
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.INACTIVE,
      message: `Voucher ${matchedVoucher.code} sedang nonaktif dan belum bisa dipakai.`,
      voucher: matchedVoucher,
      discountAmount: 0,
    };
  }

  const expiryTime = getExpiryTime(matchedVoucher.expiresAt);
  if (expiryTime && expiryTime < now.getTime()) {
    const expiryLabel = formatVoucherDate(matchedVoucher.expiresAt);
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.EXPIRED,
      message: `Voucher ${matchedVoucher.code} sudah expired${expiryLabel ? ` pada ${expiryLabel}` : ''}.`,
      voucher: matchedVoucher,
      discountAmount: 0,
    };
  }

  const orderSubtotal = toAmount(subtotal);
  const eligibleItems = getVoucherEligibleItems(matchedVoucher, items);
  const eligibleSubtotal = getVoucherEligibleSubtotal(matchedVoucher, items, orderSubtotal);
  const eligibleQuantity = getVoucherEligibleQuantity(matchedVoucher, items);
  const hasRestrictions = normalizeSlugList(matchedVoucher.eligibleProductSlugs).length > 0
    || normalizeCategoryList(matchedVoucher.eligibleCategories).length > 0;

  if (hasRestrictions && eligibleSubtotal <= 0) {
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.NOT_APPLICABLE,
      message: 'Voucher tidak berlaku untuk produk di keranjang ini',
      voucher: matchedVoucher,
      discountAmount: 0,
      eligibleItems: [],
      eligibleSubtotal: 0,
      eligibleQuantity: 0,
    };
  }

  if (eligibleSubtotal < matchedVoucher.minimumOrder) {
    const shortage = matchedVoucher.minimumOrder - eligibleSubtotal;
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.MINIMUM_ORDER,
      message: `Minimum belanja untuk voucher ${matchedVoucher.code} adalah ${formatRupiah(matchedVoucher.minimumOrder)}. Subtotal yang memenuhi syarat baru ${formatRupiah(eligibleSubtotal)}, kurang ${formatRupiah(shortage)}.`,
      voucher: matchedVoucher,
      discountAmount: 0,
      eligibleItems,
      eligibleSubtotal,
      eligibleQuantity,
    };
  }

  if (eligibleQuantity < matchedVoucher.minimumQuantity) {
    const quantityShortage = matchedVoucher.minimumQuantity - eligibleQuantity;
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.MINIMUM_QUANTITY,
      message: `Minimum quantity untuk voucher ${matchedVoucher.code} adalah ${formatNumber(matchedVoucher.minimumQuantity)} item. Quantity yang memenuhi syarat baru ${formatNumber(eligibleQuantity)} item, kurang ${formatNumber(quantityShortage)} item.`,
      voucher: matchedVoucher,
      discountAmount: 0,
      eligibleItems,
      eligibleSubtotal,
      eligibleQuantity,
    };
  }

  if (matchedVoucher.usageLimitTotal > 0 && matchedVoucher.usageCount >= matchedVoucher.usageLimitTotal) {
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.USAGE_LIMIT_REACHED,
      message: `Kuota voucher ${matchedVoucher.code} sudah habis (${formatNumber(matchedVoucher.usageCount)}/${formatNumber(matchedVoucher.usageLimitTotal)} terpakai).`,
      voucher: matchedVoucher,
      discountAmount: 0,
    };
  }

  const discountAmount = calculateVoucherDiscount(matchedVoucher, eligibleSubtotal);
  if (discountAmount <= 0) {
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.INVALID_DISCOUNT,
      message: 'Voucher belum memiliki nilai diskon yang valid',
      voucher: matchedVoucher,
      discountAmount: 0,
      eligibleItems,
      eligibleSubtotal,
      eligibleQuantity,
    };
  }

  return {
    valid: true,
    reason: VOUCHER_VALIDATION_REASONS.VALID,
    message: 'Voucher berhasil diterapkan',
    voucher: matchedVoucher,
    discountAmount,
    subtotalAfterDiscount: Math.max(orderSubtotal - discountAmount, 0),
    eligibleItems,
    eligibleSubtotal,
    eligibleQuantity,
  };
};

export const applyVoucherToSubtotal = ({ code, voucher, subtotal = 0, items = [], vouchers, now } = {}) => {
  const validation = validateVoucher({ code, voucher, subtotal, items, vouchers, now });
  const orderSubtotal = toAmount(subtotal);

  return {
    ...validation,
    subtotal: orderSubtotal,
    discountAmount: validation.valid ? validation.discountAmount : 0,
    subtotalAfterDiscount: validation.valid ? Math.max(orderSubtotal - validation.discountAmount, 0) : orderSubtotal,
  };
};

export const applyVoucherToSubtotalAsync = async ({ code, voucher, subtotal = 0, items = [], vouchers, now } = {}) => {
  const normalizedCode = normalizeVoucherCode(code || voucher?.code);
  const matchedVoucher = voucher || findVoucherByCode(normalizedCode, vouchers || getCachedVouchers()) || await findVoucherByCodeAsync(normalizedCode);
  const validation = validateVoucher({
    code: normalizedCode,
    voucher: matchedVoucher,
    subtotal,
    items,
    vouchers,
    now,
  });
  const orderSubtotal = toAmount(subtotal);

  return {
    ...validation,
    subtotal: orderSubtotal,
    discountAmount: validation.valid ? validation.discountAmount : 0,
    subtotalAfterDiscount: validation.valid ? Math.max(orderSubtotal - validation.discountAmount, 0) : orderSubtotal,
  };
};

export const incrementVoucherUsage = async (idOrCode, amount = 1) => {
  const targetCode = normalizeVoucherCode(idOrCode);
  const usageAmount = Math.max(toAmount(amount), 1);
  const voucher = await findVoucherByCodeAsync(targetCode || idOrCode);
  if (!voucher) throw new Error('Voucher tidak ditemukan');
  const nextUsageCount = toAmount(voucher.usageCount) + usageAmount;
  if (voucher.usageLimitTotal > 0 && nextUsageCount > voucher.usageLimitTotal) {
    throw new Error('Kuota voucher sudah habis');
  }

  const { data, error } = await supabase
    .from(VOUCHER_TABLE)
    .update({ usage_count: nextUsageCount })
    .eq('id', voucher.id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Gagal memperbarui pemakaian voucher');
  }

  const updatedVoucher = normalizeVoucher(data);
  cacheVouchers(getCachedVouchers().map((item) => (
    item.id === updatedVoucher.id || normalizeVoucherCode(item.code) === updatedVoucher.code
      ? updatedVoucher
      : item
  )));
  dispatchVoucherUpdated();
  return updatedVoucher;
};

export const getVoucherUsageRecords = async () => {
  const { data, error } = await supabase
    .from(VOUCHER_USAGE_TABLE)
    .select('*')
    .order('used_at', { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message || 'Gagal memuat riwayat voucher');
  }

  return (data || []).map((record) => ({
    id: record.id,
    voucherCode: normalizeVoucherCode(record.voucher_code || record.voucherCode || record.code),
    orderId: String(record.order_id || record.orderId || '').trim(),
    orderNumber: String(record.order_number || record.orderNumber || '').trim(),
    amount: Math.max(toAmount(record.amount), 1),
    usedAt: record.used_at || record.usedAt || new Date().toISOString(),
  }));
};

export const getLocalVoucherUsageRecords = () => readStoredUsageRecords().map((record) => ({
  id: record.id || `${normalizeVoucherCode(record.voucherCode || record.code)}-${record.orderNumber || record.orderId || record.order_id || Date.now()}`,
  voucherCode: normalizeVoucherCode(record.voucherCode || record.code),
  orderId: String(record.orderId || record.order_id || '').trim(),
  orderNumber: String(record.orderNumber || record.order_number || '').trim(),
  amount: Math.max(toAmount(record.amount), 1),
  usedAt: record.usedAt || record.used_at || new Date().toISOString(),
})).filter((record) => record.voucherCode && (record.orderId || record.orderNumber));

export const recordVoucherUsageForOrder = async ({
  orderId = '',
  orderNumber = '',
  voucherCode = '',
  voucherSnapshot = null,
  items = [],
  amount = 1,
} = {}) => {
  const code = normalizeVoucherCode(voucherCode || voucherSnapshot?.code);
  const orderIdValue = String(orderId || '').trim();
  const orderNumberValue = String(orderNumber || '').trim();
  const orderKey = orderNumberValue || orderIdValue;
  if (!code || !orderKey) {
    return { tracked: false, alreadyTracked: false, voucher: null };
  }

  const subtotal = toAmount(voucherSnapshot?.subtotalBeforeDiscount || voucherSnapshot?.subtotal_before_discount);
  const validation = await applyVoucherToSubtotalAsync({ code, subtotal, items });
  if (!validation.valid) {
    throw new Error(validation.message || 'Voucher tidak bisa digunakan');
  }

  const { data, error } = await supabase.rpc('storefront_record_voucher_usage', {
    p_voucher_code: code,
    p_order_id: isUuid(orderIdValue) ? orderIdValue : null,
    p_order_number: orderNumberValue || null,
    p_amount: Math.max(toAmount(amount), 1),
  });
  if (error) {
    throw new Error(error.message || 'Gagal mencatat pemakaian voucher');
  }

  const payload = Array.isArray(data) ? data[0] : data;
  const updatedVoucher = payload?.voucher ? normalizeVoucher(payload.voucher) : await findVoucherByCodeAsync(code);
  const record = payload?.record ? {
    id: payload.record.id,
    voucherCode: normalizeVoucherCode(payload.record.voucher_code),
    orderId: String(payload.record.order_id || '').trim(),
    orderNumber: String(payload.record.order_number || '').trim(),
    amount: Math.max(toAmount(payload.record.amount), 1),
    usedAt: payload.record.used_at || new Date().toISOString(),
  } : null;

  if (updatedVoucher) {
    persistCachedVouchers(getCachedVouchers().map((item) => (
      item.id === updatedVoucher.id || normalizeVoucherCode(item.code) === updatedVoucher.code
        ? updatedVoucher
        : item
    )));
  }

  return {
    tracked: Boolean(payload?.tracked),
    alreadyTracked: Boolean(payload?.already_tracked),
    record,
    voucher: updatedVoucher,
  };
};
