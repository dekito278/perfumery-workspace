/**
 * The WhatsApp draft an overseas buyer sends, and the label on the button that opens it.
 *
 * Both come back as message KEYS, never as text: this repo forbids the storefront from reading a plain
 * `.label` off a data object, because Indonesian arriving at runtime is invisible to every scan for
 * Indonesian literals.
 *
 * One builder for three surfaces — the product page's action, the desktop sticky bar and the phone's
 * sticky bar. They used to differ: the two sticky bars sent a GENERIC message that named no perfume at
 * all, so an order placed from the bar arrived as "I'd like to ask about international shipping" with
 * nothing to ship. On the phone the sticky bar is the only button most buyers ever press.
 *
 * The wording splits on the shop, not on the reader:
 *   - Indonesian shop — this is an ENQUIRY beside a working Add to cart, for an Indonesian buyer who
 *     wants a bottle sent abroad.
 *   - English shop — there is no cart; this IS how you buy, so it says so.
 *
 * Neither version claims a bottle is held. Shipping is quoted by hand and nothing is reserved until
 * that conversation happens, and a draft that implies otherwise makes a promise the atelier has not
 * made.
 */
export const overseasDraftKeys = (isInternational) => (isInternational
  ? { labelKey: 'export.order', draftKey: 'export.waOrderDraft' }
  : { labelKey: 'export.ask', draftKey: 'export.waDraft' });

export const buildOverseasDraft = ({ t, isInternational = false, name = '', size = '', price = '' } = {}) => {
  if (typeof t !== 'function' || !name) return '';
  const { draftKey } = overseasDraftKeys(isInternational);
  return t(draftKey, {
    item: `${name}${size ? ` (${size})` : ''}`,
    line: price ? t('export.waDraftPrice', { price }) : '',
  });
};

export default buildOverseasDraft;
