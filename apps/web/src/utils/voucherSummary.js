// What a voucher card says about a voucher.
//
// There are two cards — VoucherManagementPage and MobileVoucherManagementPage — and they each carried
// their own copy of these helpers, comment included. The copies had not drifted yet; the point is that
// nothing stopped them, and the badge they produce is the one place Dekito reads a code's state before
// handing it to a buyer.
//
// Import-free so the guard can run the rules rather than read them.

import { getExpiryTime } from './voucherValidation.js';

export const voucherRestrictionLabel = (voucher = {}) => {
  const products = voucher.eligibleProductSlugs || [];
  const categories = voucher.eligibleCategories || [];
  if (!products.length && !categories.length) return 'Semua produk';
  return [
    products.length ? `${products.length} produk` : '',
    categories.length ? `${categories.length} kategori` : '',
  ].filter(Boolean).join(' / ');
};

export const voucherStatus = (voucher = {}) => {
  if (!voucher.active) return { key: 'inactive', label: 'Nonaktif', className: 'bg-stone-100 text-stone-700' };
  // The same parser the checkout validates against. Read in the reader's own zone, this badge said
  // "Aktif" on a code the checkout had already refused, for the whole of the expiry day.
  const expiryTime = getExpiryTime(voucher.expiresAt);
  if (expiryTime && expiryTime < Date.now()) {
    return { key: 'expired', label: 'Expired', className: 'bg-rose-50 text-rose-700' };
  }
  if (voucher.usageLimitTotal > 0 && voucher.usageCount >= voucher.usageLimitTotal) {
    return { key: 'limit_reached', label: 'Limit habis', className: 'bg-amber-50 text-amber-800' };
  }
  return { key: 'active', label: 'Aktif', className: 'bg-emerald-50 text-emerald-700' };
};

/**
 * The per-account limit, which neither card showed.
 *
 * It is not a detail. Above zero it changes WHO can use the code at all: validateVoucher refuses an
 * anonymous buyer outright ("hanya untuk pembeli yang masuk ke akunnya"), because a limit counted per
 * account is bypassable by not signing in. So a code with this set behaves completely differently from
 * one without, and the only place that said so was the input's help text on the edit form.
 *
 * Live on 14 Oct 2026: of seven vouchers, one active code has it (DARIATELIER, 1 per account). The two
 * codes buyers actually used do not, and one signed-in account has taken SOLI10's 10% three times —
 * allowed by that configuration, and invisible on the screen where the configuration is reviewed.
 */
export const voucherAccountLimitLabel = (voucher = {}) => {
  const limit = Math.max(0, Math.round(Number(voucher.usageLimitPerAccount) || 0));
  if (!limit) return 'Tanpa batas akun';
  return limit === 1 ? '1x per akun · wajib login' : `${limit}x per akun · wajib login`;
};

export default voucherAccountLimitLabel;
