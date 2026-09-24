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
 * It used to split on the shop: an enquiry in the Indonesian shop, beside a working Add to cart — and in
 * the English shop "Order this on WhatsApp", because there was no cart and this IS how you bought.
 *
 * Both shops sell through the cart now, so that second button sat directly under "Add to cart — US$95"
 * offering a second, slower way to buy the same bottle. Two tills on one page, and the one we spent this
 * project building was the one without a verb on it.
 *
 * So there is one errand in both shops: ask. Each language's draft already addresses its own reader —
 * the Indonesian one asks about sending a bottle abroad, the English one asks about a bottle reaching
 * "my country" — which is why one key serves both.
 *
 * Neither version claims a bottle is held. Shipping is quoted by hand for the destinations the checkout
 * cannot price, nothing is reserved until that conversation happens, and a draft that implies otherwise
 * makes a promise the atelier has not made.
 */
export const overseasDraftKeys = () => ({ labelKey: 'export.ask', draftKey: 'export.waDraft' });

export const buildOverseasDraft = ({ t, name = '', size = '', price = '' } = {}) => {
  if (typeof t !== 'function' || !name) return '';
  const { draftKey } = overseasDraftKeys();
  return t(draftKey, {
    item: `${name}${size ? ` (${size})` : ''}`,
    line: price ? t('export.waDraftPrice', { price }) : '',
  });
};

export default buildOverseasDraft;
