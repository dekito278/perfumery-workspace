export const VOUCHER_DISCOUNT_ITEM_TYPE = 'voucher_discount';

const parseNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

export const formatOrderTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(parseNumber(value))}`;

export const getOrderProductItems = (order = {}) => (
  Array.isArray(order.items)
    ? order.items.filter((item) => item.type !== VOUCHER_DISCOUNT_ITEM_TYPE)
    : []
);

export const getOrderVoucherSnapshot = (order = {}) => {
  const voucherItem = Array.isArray(order.items)
    ? order.items.find((item) => item.type === VOUCHER_DISCOUNT_ITEM_TYPE)
    : null;
  const source = order.voucherSnapshot || order.voucher_snapshot || voucherItem?.voucherSnapshot || voucherItem;
  const code = String(source?.code || source?.voucherCode || source?.voucher_code || '').trim().toUpperCase();
  const discountAmount = Math.max(parseNumber(source?.discountAmount || source?.discount_amount), 0);
  if (!code || discountAmount <= 0) return null;

  return {
    code,
    discountType: source.discountType || source.discount_type || '',
    discountValue: parseNumber(source.discountValue || source.discount_value),
    discountAmount,
    subtotalBeforeDiscount: Math.max(parseNumber(source.subtotalBeforeDiscount || source.subtotal_before_discount), 0),
    subtotalAfterDiscount: Math.max(parseNumber(source.subtotalAfterDiscount || source.subtotal_after_discount), 0),
    eligibleSubtotal: Math.max(parseNumber(source.eligibleSubtotal || source.eligible_subtotal), 0),
    eligibleQuantity: Math.max(parseNumber(source.eligibleQuantity || source.eligible_quantity), 0),
    minimumOrder: Math.max(parseNumber(source.minimumOrder || source.minimum_order), 0),
    minimumQuantity: Math.max(parseNumber(source.minimumQuantity || source.minimum_quantity), 0),
    eligibleProductSlugs: source.eligibleProductSlugs || source.eligible_product_slugs || [],
    eligibleCategories: source.eligibleCategories || source.eligible_categories || [],
  };
};

export const getOrderProductsSubtotal = (order = {}) => {
  const voucherSnapshot = getOrderVoucherSnapshot(order);
  if (voucherSnapshot?.subtotalBeforeDiscount) return voucherSnapshot.subtotalBeforeDiscount;

  return getOrderProductItems(order).reduce((sum, item) => (
    sum + (parseNumber(item.priceNumber || item.totalPrice || item.price) * Math.max(parseNumber(item.quantity || 1), 1))
  ), 0);
};

export const getOrderSubtotalAfterVoucher = (order = {}) => {
  const voucherSnapshot = getOrderVoucherSnapshot(order);
  if (!voucherSnapshot) return getOrderProductsSubtotal(order);
  if (voucherSnapshot.subtotalAfterDiscount) return voucherSnapshot.subtotalAfterDiscount;
  return Math.max(getOrderProductsSubtotal(order) - voucherSnapshot.discountAmount, 0);
};

export const getOrderShippingFee = (order = {}) => {
  const total = parseNumber(order.subtotal || order.amount);
  const afterVoucher = getOrderSubtotalAfterVoucher(order);
  return Math.max(total - afterVoucher, 0);
};

export const getOrderShippingSummary = (order = {}) => {
  const directSummary = String(order.shippingSummary || order.shipping_summary || order.shipping || '').trim();
  if (directSummary) return directSummary;

  const notes = String(order.notes || order.customerNotes || order.customer_notes || '').trim();
  const match = notes.match(/^Shipping:\s*(.+)$/im);
  return match?.[1]?.trim() || '';
};

export const getOrderShippingPromotionLabel = (order = {}) => {
  const summary = getOrderShippingSummary(order);
  if (!summary) return '';

  const promoPart = summary
    .split('/')
    .map((part) => part.trim())
    .find((part) => /gratis|diskon|promo|maksimal/i.test(part));

  return promoPart || '';
};
