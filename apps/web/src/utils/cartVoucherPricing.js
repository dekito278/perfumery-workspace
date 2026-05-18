const toAmount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(numeric, 0) : 0;
};

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const getItemProductKeys = (item = {}) => [
  item.slug,
  item.productSlug,
  item.product_slug,
  item.productId,
  item.product_id,
].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);

export const isVoucherEligibleCartItem = (voucher = {}, item = {}) => {
  const productSlugs = normalizeList(voucher.eligibleProductSlugs || voucher.eligible_product_slugs);
  const categories = normalizeList(voucher.eligibleCategories || voucher.eligible_categories);
  if (!productSlugs.length && !categories.length) return true;

  const productKeys = getItemProductKeys(item);
  const itemCategory = String(item.category || '').trim().toLowerCase();
  return productSlugs.some((slug) => productKeys.includes(slug))
    || (itemCategory && categories.includes(itemCategory));
};

export const getCartItemLineTotal = (item = {}) => (
  toAmount(item.priceNumber) * Math.max(toAmount(item.quantity), 0)
);

export const getDiscountedCartLines = (items = [], discountAmount = 0) => {
  const originalLines = items.map((item) => ({
    item,
    originalTotal: getCartItemLineTotal(item),
  }));
  const subtotal = originalLines.reduce((sum, line) => sum + line.originalTotal, 0);
  const totalDiscount = Math.min(toAmount(discountAmount), subtotal);

  if (!subtotal || !totalDiscount) {
    return originalLines.map((line) => ({
      ...line,
      discount: 0,
      discountedTotal: line.originalTotal,
      discountedUnitPrice: toAmount(line.item.priceNumber),
    }));
  }

  let allocatedDiscount = 0;

  return originalLines.map((line, index) => {
    const isLastLine = index === originalLines.length - 1;
    const discount = isLastLine
      ? totalDiscount - allocatedDiscount
      : Math.min(Math.round(totalDiscount * (line.originalTotal / subtotal)), line.originalTotal);
    allocatedDiscount += discount;
    const discountedTotal = Math.max(line.originalTotal - discount, 0);
    const quantity = Math.max(toAmount(line.item.quantity), 1);

    return {
      ...line,
      discount,
      discountedTotal,
      discountedUnitPrice: Math.round(discountedTotal / quantity),
    };
  });
};

export const getDiscountedCartLineMap = (items = [], discountAmount = 0) => new Map(
  getDiscountedCartLines(items, discountAmount).map((line) => [line.item.slug, line])
);

export const getVoucherDiscountEligibleItems = (items = [], voucher = {}) => (
  (items || []).filter((item) => isVoucherEligibleCartItem(voucher, item))
);

export const getDiscountedVoucherCartLines = (items = [], voucher = {}, discountAmount = voucher?.discountAmount || voucher?.discount_amount || 0) => {
  const eligibleItems = getVoucherDiscountEligibleItems(items, voucher);
  const discountedEligibleLines = getDiscountedCartLines(eligibleItems, discountAmount);
  const discountedLineByItem = new Map(discountedEligibleLines.map((line) => [line.item, line]));

  return (items || []).map((item) => {
    const discountedLine = discountedLineByItem.get(item);
    if (discountedLine) return discountedLine;

    const originalTotal = getCartItemLineTotal(item);
    return {
      item,
      originalTotal,
      discount: 0,
      discountedTotal: originalTotal,
      discountedUnitPrice: toAmount(item.priceNumber),
    };
  });
};

export const getDiscountedVoucherCartLineMap = (items = [], voucher = {}, discountAmount) => new Map(
  getDiscountedVoucherCartLines(items, voucher, discountAmount).map((line) => [line.item.slug, line])
);
