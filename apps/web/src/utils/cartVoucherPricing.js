const toAmount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(numeric, 0) : 0;
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
