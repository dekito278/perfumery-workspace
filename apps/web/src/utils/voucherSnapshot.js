export const buildVoucherSnapshot = ({
  voucher,
  voucherCode,
  discountAmount,
  subtotalBeforeDiscount,
  subtotalAfterDiscount,
  eligibleSubtotal,
  eligibleQuantity,
}) => {
  const code = String(voucher?.code || voucherCode || '').trim().toUpperCase();
  const finalDiscount = Math.max(Number(discountAmount || 0), 0);
  if (!code || finalDiscount <= 0) return null;

  return {
    code,
    discountType: voucher?.discountType || voucher?.discount_type || '',
    discountValue: Number(voucher?.discountValue || voucher?.discount_value || 0),
    discountAmount: finalDiscount,
    subtotalBeforeDiscount: Math.max(Number(subtotalBeforeDiscount || 0), 0),
    subtotalAfterDiscount: Math.max(Number(subtotalAfterDiscount || 0), 0),
    eligibleSubtotal: Math.max(Number(eligibleSubtotal || 0), 0),
    eligibleQuantity: Math.max(Number(eligibleQuantity || 0), 0),
    minimumOrder: Number(voucher?.minimumOrder || voucher?.minimum_order || 0),
    minimumQuantity: Number(voucher?.minimumQuantity || voucher?.minimum_quantity || 0),
    eligibleProductSlugs: voucher?.eligibleProductSlugs || voucher?.eligible_product_slugs || [],
    eligibleCategories: voucher?.eligibleCategories || voucher?.eligible_categories || [],
    appliedAt: new Date().toISOString(),
  };
};
