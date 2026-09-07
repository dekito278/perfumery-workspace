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

// Exact-code lookup through an RPC: storefront_vouchers SELECT is admin-only, so the public can no longer
// list every code, value, quota and expiry (audit round 9, V-1). One code in, that row or null out.
export const findVoucherByCodeAsync = async (code) => {
  const normalizedCode = normalizeVoucherCode(code);
  if (!normalizedCode) return null;

  const { data, error } = await supabase.rpc('storefront_voucher_lookup', { p_code: normalizedCode });
  if (error) {
    throw new Error(error.message || 'Gagal mencari voucher');
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ? normalizeVoucher(row) : null;
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
  // An RLS refusal on DELETE is not an error. PostgREST answers 200 with zero rows and error === null,
  // so without .select() this cleared the local cache, returned normally, and the studio said "dihapus"
  // while the row survived — and checkout validates the code against that row, not the cache. The admin
  // would only find out when a customer redeemed a voucher they had already retired.
  const request = isUuid
    ? supabase.from(VOUCHER_TABLE).delete().eq('id', idValue).select('id')
    : supabase.from(VOUCHER_TABLE).delete().eq('code', targetCode).select('id');
  const { data: deleted, error } = await request;
  if (error) {
    throw new Error(error.message || 'Gagal menghapus voucher');
  }

  // Re-reading to tell "already gone" from "refused" does not work: a session that cannot delete usually
  // cannot select either, so both answer zero rows. Both call sites delete a voucher they are rendering
  // from the loaded list, so zero rows here means the delete was refused.
  if (!deleted?.length) {
    throw new Error(`Voucher ${targetCode || idValue} tidak terhapus di server dan masih bisa dipakai pembeli. Sesi admin mungkin belum terverifikasi authenticator — muat ulang, verifikasi, lalu coba lagi.`);
  }

  const nextVouchers = getCachedVouchers().filter((voucher) => (
    voucher.id !== idOrCode && normalizeVoucherCode(voucher.code) !== targetCode
  ));
  persistCachedVouchers(nextVouchers);
  return nextVouchers;
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

// Usage is recorded by api/orders/create.js (service role) at creation, never from the browser.

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
