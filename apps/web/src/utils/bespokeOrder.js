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

/**
 * What a bespoke option group starts on before the buyer has chosen anything: the CHEAPEST enabled
 * option, not the first one.
 *
 * It used to be whichever came first in sort_order, and sort_order is DISPLAY order — which option
 * Dekito wants seen first, a different question from what someone should be charged for a decision they
 * never made. Three of the four groups agreed by luck. The cap group did not: "Cap custom Abstrak"
 * (Rp 50.000) is shown first and "Cap Basic" (Rp 5.000) second, so a buyer who never opened the Cap tab
 * paid Rp 45.000 extra — and no option on that screen shows its price, so there was nothing to notice.
 * Measured on production: the subtotal started at Rp 300.000 instead of Rp 255.000.
 *
 * Display order is untouched. The hero option stays first on screen; it just stops being pre-bought.
 * Ties keep sort_order, so a group where everything is free starts exactly where it always did.
 */
/**
 * The least a bespoke bottle can cost, derived from the same option rows the flow already reads.
 *
 * Step 1 asked a buyer to name their perfume and describe a scent before showing any number at all —
 * not even "mulai dari" — on the most expensive thing this atelier sells.
 *
 * Summed from the CHEAPEST enabled option in each required group, so it is the true floor rather than a
 * marketing number, and it follows Dekito's own prices the moment he changes them in Studio. Nothing is
 * hardcoded: a figure typed into the copy would be a second source of truth, free to go stale.
 *
 * Exotic material is deliberately left out. It is the one group with no default — a buyer who picks
 * nothing pays nothing for it — so including it would quote a price nobody is obliged to pay.
 */
/**
 * What choosing THIS option adds, over the cheapest one in its own group.
 *
 * The floor price is built from the cheapest option of each group, so the arithmetic a buyer needs is
 * "mulai dari, plus what I picked". An absolute price on every card would double-count that floor.
 *
 * This is the missing half of the Rp 45.000 overcharge. The comment on cheapestEnabled records why the
 * bug was invisible: "no option on that screen shows its price, so there was nothing to notice." The
 * default is fixed on both pages now — but a buyer choosing Cap custom Abstrak over Cap Basic still
 * could not see that the choice costs Rp 45.000.
 */
export const optionExtraPrice = (option, group) => {
  // Array.isArray, not a default parameter: `null` is a value, so `group = []` does not catch it — and a
  // settings object that failed to load answers null, not undefined.
  const floor = Number(cheapestEnabled(Array.isArray(group) ? group : [])?.price || 0);
  const price = Number(option?.price || 0);
  return price > floor ? price - floor : 0;
};

export const bespokeFloorPrice = (settings = {}) => (
  [settings.bottleSizes, settings.bottleTypes, settings.capDesigns, settings.labelDesigns]
    .reduce((sum, group) => sum + Number(cheapestEnabled(group || []).price || 0), 0)
);

export const cheapestEnabled = (options = []) => {
  const enabled = options.filter((option) => option.enabled);
  if (!enabled.length) return options[0] || {};
  return enabled.reduce((best, option) => (
    Number(option.price || 0) < Number(best.price || 0) ? option : best
  ), enabled[0]);
};

/**
 * The WhatsApp message an overseas buyer sends instead of checking out.
 *
 * The English shop takes no payment for a bespoke bottle, and cannot: the prices in
 * storefront_bespoke_options are one domestic set with no international variant, and the shipping is
 * worked out by hand. The page used to hand that buyer a full checkout anyway — Indonesian couriers, a
 * domestic voucher box and a rupiah total — directly underneath a notice saying international orders
 * are not placed there.
 *
 * Every word comes from the message file, so it is written in the language the buyer was just reading.
 * It quotes NO price on purpose: there is not one to quote yet, and inventing one here would make
 * exactly the promise this path exists to avoid.
 */
/**
 * The occasion in the READER's language.
 *
 * The option list stores its value in Indonesian — 'Harian', 'Kantor' — because that is what the order
 * record keeps and what Dekito reads in Studio. The buyer's own WhatsApp brief was built from that raw
 * value, so an English reader sent "Occasion: Harian" in an otherwise English message, about a perfume
 * they were describing in English. Measured on the live English shop, 2026-09-21.
 *
 * The stored value stays Indonesian on purpose; only the sentence that leaves the site is translated.
 */
export const bespokeOccasionLabel = (t, value, options = []) => {
  const match = options.find((option) => option.value === value);
  const label = match?.labelKey && typeof t === 'function' ? t(match.labelKey) : '';
  return label || value || '';
};

export const buildBespokeEnquiryDraft = ({ t, perfumeName = '', scent = '', occasion = '', bottle = '' } = {}) => {
  if (typeof t !== 'function') return '';
  const filled = (value) => String(value || '').trim() || '-';
  return t('bsp.waOrderDraft', {
    name: filled(perfumeName),
    scent: filled(scent),
    occasion: filled(occasion),
    bottle: filled(bottle),
  });
};

/**
 * Where the bespoke flow stops, per shop.
 *
 * One answer for three surfaces — the desktop checkout panel, the phone's wizard, and the step list in
 * the hero — because the English shop stopping at the design is a RULE, not three separate conditions
 * that happened to be written the same way. Two of the three were gated one at a time first, and a
 * guard that only asked "does this file mention isInternational" passed while the till stayed open.
 *
 * The English shop takes no bespoke payment: the option prices are one domestic set with no
 * international variant, and the shipping is worked out by hand.
 */
export const bespokeTakesPayment = (isInternational) => !isInternational;

/** The steps a shop actually walks. The English one ends at the bottle. */
export const bespokeFlowSteps = (steps = [], isInternational = false) => (
  isInternational ? steps.filter((step) => !['delivery', 'payment'].includes(step?.key)) : steps
);

/** The same cut, for the numbered list in the hero: design, then nothing that needs an address. */
export const bespokeStepKeys = (stepKeys = [], isInternational = false) => (
  isInternational ? stepKeys.slice(0, 3) : stepKeys
);
