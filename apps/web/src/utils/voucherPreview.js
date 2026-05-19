import {
  calculateVoucherDiscount,
  getVoucherEligibleItems,
  getVoucherEligibleQuantity,
  getVoucherEligibleSubtotal,
  normalizeVoucher,
} from '@/services/voucherService.js';

const toAmount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(numeric, 0) : 0;
};

const getExpiryTime = (expiresAt) => {
  const rawValue = String(expiresAt || '').trim();
  if (!rawValue) return null;
  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
    ? `${rawValue}T23:59:59.999`
    : rawValue;
  const time = new Date(normalizedDate).getTime();
  return Number.isFinite(time) ? time : null;
};

const productToPreviewItem = (product = {}) => {
  const primaryVariant = Array.isArray(product.variants) ? product.variants[0] : null;
  const priceNumber = toAmount(primaryVariant?.priceNumber || product.priceNumber || product.price);

  return {
    id: product.id || product.slug,
    slug: product.slug,
    productSlug: product.slug,
    productId: product.id,
    name: product.name || product.title || product.slug || 'Produk tanpa nama',
    category: product.category || '',
    priceNumber,
    quantity: 1,
    size: primaryVariant?.size || product.size || '',
    stock: toAmount(product.stock),
  };
};

export const buildVoucherPreview = (draft = {}, products = [], now = new Date()) => {
  const voucher = normalizeVoucher({
    ...draft,
    discountValue: toAmount(draft.discountValue),
    minimumOrder: toAmount(draft.minimumOrder),
    minimumQuantity: toAmount(draft.minimumQuantity),
    usageLimitTotal: toAmount(draft.usageLimitTotal),
    eligibleProductSlugs: draft.eligibleProductSlugs,
    eligibleCategories: draft.eligibleCategories,
  });
  const previewItems = (products || [])
    .map(productToPreviewItem)
    .filter((item) => item.priceNumber > 0);
  const totalSubtotal = previewItems.reduce((sum, item) => sum + item.priceNumber, 0);
  const eligibleItems = getVoucherEligibleItems(voucher, previewItems);
  const eligibleSubtotal = getVoucherEligibleSubtotal(voucher, previewItems, totalSubtotal);
  const eligibleQuantity = getVoucherEligibleQuantity(voucher, previewItems);
  const expiryTime = getExpiryTime(voucher.expiresAt);
  const hasRestrictions = voucher.eligibleProductSlugs.length > 0 || voucher.eligibleCategories.length > 0;
  const hasEligibleProducts = !hasRestrictions || eligibleItems.length > 0;
  const isExpired = Boolean(expiryTime && expiryTime < now.getTime());
  const limitReached = voucher.usageLimitTotal > 0 && voucher.usageCount >= voucher.usageLimitTotal;
  const minimumOrderShortage = Math.max(voucher.minimumOrder - eligibleSubtotal, 0);
  const minimumQuantityShortage = Math.max(voucher.minimumQuantity - eligibleQuantity, 0);
  const canEstimateDiscount = Boolean(
    voucher.code
      && voucher.active
      && !isExpired
      && !limitReached
      && hasEligibleProducts
      && minimumOrderShortage <= 0
      && minimumQuantityShortage <= 0
      && voucher.discountValue > 0
      && eligibleSubtotal > 0,
  );
  const estimatedDiscount = canEstimateDiscount ? calculateVoucherDiscount(voucher, eligibleSubtotal) : 0;
  const rules = [
    {
      key: 'code',
      label: 'Kode voucher',
      detail: voucher.code ? voucher.code : 'Belum diisi',
      pass: Boolean(voucher.code),
      blocking: true,
    },
    {
      key: 'status',
      label: 'Status',
      detail: voucher.active ? 'Aktif' : 'Nonaktif',
      pass: voucher.active,
      blocking: true,
    },
    {
      key: 'expiry',
      label: 'Expiry',
      detail: voucher.expiresAt ? (isExpired ? 'Sudah expired' : 'Masih berlaku') : 'Tanpa expiry',
      pass: !isExpired,
      blocking: true,
    },
    {
      key: 'usage-limit',
      label: 'Kuota',
      detail: voucher.usageLimitTotal > 0
        ? `${voucher.usageCount}/${voucher.usageLimitTotal} terpakai`
        : 'Tanpa limit',
      pass: !limitReached,
      blocking: true,
    },
    {
      key: 'eligibility',
      label: 'Produk eligible',
      detail: hasRestrictions ? `${eligibleItems.length} produk cocok` : 'Semua produk eligible',
      pass: hasEligibleProducts,
      blocking: true,
    },
    {
      key: 'minimum-order',
      label: 'Minimum order',
      detail: voucher.minimumOrder > 0
        ? (minimumOrderShortage > 0 ? `Kurang ${minimumOrderShortage}` : 'Terpenuhi')
        : 'Tanpa minimum',
      pass: minimumOrderShortage <= 0,
      blocking: true,
    },
    {
      key: 'minimum-quantity',
      label: 'Minimum quantity',
      detail: voucher.minimumQuantity > 0
        ? (minimumQuantityShortage > 0 ? `Kurang ${minimumQuantityShortage} item` : 'Terpenuhi')
        : 'Tanpa minimum',
      pass: minimumQuantityShortage <= 0,
      blocking: true,
    },
    {
      key: 'discount',
      label: 'Nilai diskon',
      detail: voucher.discountValue > 0 ? 'Valid' : 'Belum diisi',
      pass: voucher.discountValue > 0,
      blocking: true,
    },
  ];

  return {
    voucher,
    previewItems,
    eligibleItems,
    eligibleSubtotal,
    eligibleQuantity,
    estimatedDiscount,
    subtotalAfterDiscount: Math.max(eligibleSubtotal - estimatedDiscount, 0),
    minimumOrderShortage,
    minimumQuantityShortage,
    hasRestrictions,
    canEstimateDiscount,
    rules,
    blockingIssues: rules.filter((rule) => rule.blocking && !rule.pass),
  };
};
