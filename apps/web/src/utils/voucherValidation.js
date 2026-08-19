// Isomorphic voucher validation — pure logic with ZERO browser/supabase imports so it can run in the
// client AND in a Node serverless endpoint (the authoritative order-creation path). All DB/localStorage
// access lives in services/voucherService.js, which re-exports these. Keep this file import-free.

import { shopEndOfDay } from './localDay.js';

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

export const VALID_DISCOUNT_TYPES = new Set(Object.values(VOUCHER_DISCOUNT_TYPES));

export const normalizeVoucherCode = (code) => String(code || '')
  .trim()
  .toUpperCase()
  .replace(/\s+/g, '');

export const makeVoucherId = (code) => `voucher-${normalizeVoucherCode(code).toLowerCase() || Date.now()}`;

export const toAmount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(numeric, 0) : 0;
};

export const formatNumber = (value) => new Intl.NumberFormat('id-ID').format(toAmount(value));
export const formatRupiah = (value) => `Rp ${formatNumber(value)}`;

export const getExpiryTime = (expiresAt) => {
  const rawValue = String(expiresAt || '').trim();
  if (!rawValue) return null;

  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
    ? shopEndOfDay(rawValue)
    : rawValue;
  const time = new Date(normalizedDate).getTime();
  return Number.isFinite(time) ? time : null;
};

export const formatVoucherDate = (value) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';
  const time = getExpiryTime(rawValue);
  if (!time) return '';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(time));
};

export const normalizeTextList = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const normalizeSlugList = (value) => (
  normalizeTextList(value).map((item) => item.toLowerCase())
);

export const normalizeCategoryList = (value) => (
  normalizeTextList(value).map((item) => item.toLowerCase())
);

const getItemProductKeys = (item = {}) => [
  item.slug,
  item.productSlug,
  item.product_slug,
  item.productId,
  item.product_id,
].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);

export const itemMatchesVoucher = (voucher, item) => {
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
  // A restricted voucher with no item list to check against is NOT a whole-order voucher. Falling back to
  // the full subtotal let a product/category-restricted voucher discount an order it should never touch —
  // the authoritative endpoint hits this on every bespoke order, where the catalog item list is empty
  // (audit round 7).
  if (!items?.length) return 0;

  return getVoucherEligibleItems(voucher, items).reduce((sum, item) => (
    sum + (toAmount(item.priceNumber) * Math.max(toAmount(item.quantity), 0))
  ), 0);
};

export const getVoucherEligibleQuantity = (voucher, items = []) => (
  getVoucherEligibleItems(voucher, items).reduce((sum, item) => (
    sum + Math.max(toAmount(item.quantity), 0)
  ), 0)
);

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

// NOTE: no cache default here (the client wrapper in voucherService adds getCachedVouchers()).
export const findVoucherByCode = (code, vouchers = []) => {
  const normalizedCode = normalizeVoucherCode(code);
  if (!normalizedCode) return null;
  return vouchers.find((voucher) => normalizeVoucherCode(voucher.code) === normalizedCode) || null;
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
      eligibleItems,
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
