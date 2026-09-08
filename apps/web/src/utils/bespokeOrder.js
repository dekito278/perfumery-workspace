// Pure, import-free builders for a bespoke order's item + notes + checkout draft.
// Shared by the browser (services/orderService.js) and the authoritative server endpoint
// (api/orders/create.js) so both shape the brief identically. No browser/supabase imports — keep it that way.

export const BESPOKE_SOURCE = 'bespoke_request';

const rupiah = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

export const formatLine = (label, value) => `${label}: ${value || '-'}`;

// The structured order-line for a bespoke request. `price*` come from an authoritative source
// (client estimate today; DB recompute once api/orders/create is wired).
export const buildBespokeItem = (request = {}) => {
  const perfumeName = String(request.perfumeName || '').trim();
  const aromaBrief = request.preferredNotes || request.scentDescription || request.mood || 'Custom aroma brief';
  const totalPrice = Number(request.totalPrice || request.estimatedTotal || 0);
  const itemPrice = Number(request.itemPrice || request.estimatedTotal || totalPrice || 0);

  return {
    slug: 'bespoke-perfume-request',
    type: BESPOKE_SOURCE,
    name: perfumeName ? `Bespoke perfume: ${perfumeName}` : 'Bespoke perfume request',
    category: 'Bespoke',
    quantity: 1,
    price: itemPrice ? rupiah(itemPrice) : (request.budget || 'Custom quote'),
    priceNumber: itemPrice,
    size: request.size || '-',
    notes: aromaBrief,
    mood: request.mood || '',
    perfumeName,
    occasion: request.occasion || '',
    budget: request.budget || '',
    totalPrice: itemPrice,
    preferredNotes: request.preferredNotes || request.scentDescription || '',
    avoidedNotes: request.avoidedNotes || '',
    story: request.story || '',
    bottleType: request.bottleType || '',
    capDesign: request.capDesign || '',
    labelDesign: request.labelDesign || '',
    exoticMaterial: request.exoticMaterial || '',
    // Stable option ids alongside labels, so the price can be re-verified server-side against
    // storefront_bespoke_options (see docs/server-side-drafts/05_create_order_design.md).
    optionIds: request.optionIds || {},
    preorderAcknowledged: Boolean(request.preorderAcknowledged),
    referenceProductName: request.referenceProductName || '',
    referenceProductSlug: request.referenceProductSlug || '',
  };
};

export const buildBespokeCheckoutDraft = (request = {}) => [
  'Solivagant Bespoke Request',
  request.customerCode ? formatLine('Customer code', request.customerCode) : '',
  formatLine('Customer', request.customerName),
  formatLine('Contact', request.contact),
  formatLine('Address', request.deliveryAddress),
  formatLine('Area', request.deliveryArea),
  formatLine('Perfume name', request.perfumeName),
  formatLine('Reference scent', request.referenceProductName),
  formatLine('Mood', request.mood),
  formatLine('Occasion', request.occasion),
  formatLine('Budget', request.budget),
  formatLine('Size', request.size),
  formatLine('Preferred aroma', request.preferredNotes || request.scentDescription),
  formatLine('Avoided notes', request.avoidedNotes),
  formatLine('Story', request.story),
  formatLine('Bottle type', request.bottleType),
  formatLine('Cap design', request.capDesign),
  formatLine('Label design', request.labelDesign),
  formatLine('Exotic material', request.exoticMaterial),
  formatLine('Shipping', request.shippingSummary),
  request.shippingFee ? formatLine('Shipping fee', rupiah(request.shippingFee)) : '',
  request.voucherCode ? formatLine('Voucher', request.voucherCode) : '',
  request.voucherDiscount ? formatLine('Voucher discount', rupiah(request.voucherDiscount)) : '',
  request.totalPrice ? formatLine('Estimated total', rupiah(request.totalPrice)) : '',
  formatLine('Pre-order acknowledgement', request.preorderAcknowledged ? 'Accepted, 7-14 days after brief confirmation' : 'Not accepted'),
  formatLine('Payment rail', request.paymentProvider || 'manual'),
].filter((line) => line !== '').join('\n');

// The rows a customer was asked for but left blank used to print one "Label: -" each — six of the
// twenty-one rows on a realistic brief, so a third of the document you read was placeholder. They are
// collapsed into a single line now, which keeps the signal that the question was asked and answered with
// nothing, without spending a line on each. 'Tidak diisi' is registered in ORDER_NOTE_KEYS: an
// unregistered label would be glued onto the previous row's value by parseOrderNoteRows.
export const buildBespokeNotes = (request = {}) => {
  const rows = [
    ['Address', request.deliveryAddress],
    ['Area', request.deliveryArea],
    ['Perfume name', request.perfumeName],
    ['Mood', request.mood],
    ['Occasion', request.occasion],
    ['Budget', request.budget],
    ['Size', request.size],
    ['Preferred aroma', request.preferredNotes || request.scentDescription],
    ['Avoided notes', request.avoidedNotes],
    ['Story', request.story],
    ['Bottle type', request.bottleType],
    ['Cap design', request.capDesign],
    ['Label design', request.labelDesign],
    ['Exotic material', request.exoticMaterial],
    ['Shipping', request.shippingSummary],
    ['Shipping fee', request.shippingFee ? rupiah(request.shippingFee) : ''],
    ['Voucher', request.voucherCode],
    ['Voucher discount', request.voucherDiscount ? rupiah(request.voucherDiscount) : ''],
    ['Estimated total', request.totalPrice ? rupiah(request.totalPrice) : ''],
    ['Pre-order acknowledgement', request.preorderAcknowledged ? 'Accepted, 7-14 days after brief confirmation' : 'Not accepted'],
    ['Reference scent', request.referenceProductName],
  ];

  const filled = rows.filter(([, value]) => String(value ?? '').trim());
  // Only the rows the customer fills are worth naming as missing. Voucher, fee and total are absent
  // because the order had none, not because anybody declined to answer.
  const optional = new Set(['Voucher', 'Voucher discount', 'Shipping fee', 'Estimated total']);
  const blank = rows
    .filter(([label, value]) => !String(value ?? '').trim() && !optional.has(label))
    .map(([label]) => label);

  return [
    ...filled.map(([label, value]) => formatLine(label, value)),
    blank.length ? formatLine('Tidak diisi', blank.join(', ')) : null,
  ].filter(Boolean).join('\n');
};
