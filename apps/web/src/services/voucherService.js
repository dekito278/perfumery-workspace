import supabase from '@/lib/supabaseClient.js';
import {
  VOUCHER_DISCOUNT_TYPES,
  VOUCHER_VALIDATION_REASONS,
  calculateVoucherDiscount,
  findVoucherByCode as coreFindVoucherByCode,
  getVoucherEligibleItems,
  getVoucherEligibleQuantity,
  getVoucherEligibleSubtotal,
  normalizeSlugList,
  normalizeTextList,
  normalizeVoucher,
  normalizeVoucherCode,
  toAmount,
  validateVoucher,
} from '@/utils/voucherValidation.js';

// Re-export the pure validation API so existing importers of voucherService keep working unchanged.
export {
  VOUCHER_DISCOUNT_TYPES,
  VOUCHER_VALIDATION_REASONS,
  calculateVoucherDiscount,
  getVoucherEligibleItems,
  getVoucherEligibleQuantity,
  getVoucherEligibleSubtotal,
  normalizeVoucher,
  normalizeVoucherCode,
  validateVoucher,
};

export const VOUCHER_STORAGE_KEY = 'dekito.storefront.vouchers.v1';
export const APPLIED_VOUCHER_STORAGE_KEY = 'dekito.storefront.appliedVoucher.v1';
export const VOUCHER_USAGE_STORAGE_KEY = 'dekito.storefront.voucherUsage.v1';
export const VOUCHER_UPDATED_EVENT = 'dekito:vouchers-updated';
export const APPLIED_VOUCHER_UPDATED_EVENT = 'dekito:applied-voucher-updated';

const VOUCHER_TABLE = 'storefront_vouchers';
const VOUCHER_USAGE_TABLE = 'storefront_voucher_usage_records';
let voucherCache = null;

const isUuid = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());

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

// Client-side default: fall back to the cached vouchers. The pure core (no cache) lives in
// voucherValidation.js for isomorphic use.
export const findVoucherByCode = (code, vouchers = getCachedVouchers()) => coreFindVoucherByCode(code, vouchers);

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

export const applyVoucherToSubtotal = ({ code, voucher, subtotal = 0, items = [], vouchers, now } = {}) => {
  // Resolve vouchers from the cache here (the pure validateVoucher no longer defaults to the cache).
  const validation = validateVoucher({ code, voucher, subtotal, items, vouchers: vouchers || getCachedVouchers(), now });
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

// Release voucher quota reserved at order creation when the order is cancelled or its
// payment fails/expires. Safe to call unconditionally (idempotent; no-op when the order
// used no voucher) and never throws — a missing RPC (not deployed yet) or transient error
// must not block the cancel/expire flow.
export const releaseVoucherUsageForOrder = async ({ orderId = '', orderNumber = '' } = {}) => {
  const orderIdValue = String(orderId || '').trim();
  const orderNumberValue = String(orderNumber || '').trim();
  if (!orderIdValue && !orderNumberValue) {
    return { released: false, count: 0 };
  }

  try {
    const { data, error } = await supabase.rpc('storefront_release_voucher_usage', {
      p_order_id: isUuid(orderIdValue) ? orderIdValue : null,
      p_order_number: orderNumberValue || null,
    });
    if (error) {
      console.warn('Failed to release voucher usage:', error.message || error);
      return { released: false, count: 0 };
    }
    const payload = Array.isArray(data) ? data[0] : data;
    if (payload?.released) {
      dispatchVoucherUpdated();
    }
    return { released: Boolean(payload?.released), count: toAmount(payload?.count) };
  } catch (error) {
    console.warn('Failed to release voucher usage:', error.message || error);
    return { released: false, count: 0 };
  }
};
