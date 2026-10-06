import { usdPriceFor } from './usdPrice.js';

/**
 * What an export price is CALLED to an international buyer.
 *
 * The dollar, because that is the figure they are asked to send. The rupiah beside it is a different
 * number for a different purpose — Dekito's own export price, which the dollar was rounded UP from at a
 * rate held below the market — and printing the two together reads as a shop quoting one and charging
 * another. He did that division himself on 1 Oct 2026 before a buyer got the chance.
 *
 * Here rather than in each caller because there are THREE: the product page's action button and both
 * sticky bars. #362 fixed the button and left the bars, so the phone's bar — the only button most buyers
 * ever press — went on sending him a rupiah figure he had not offered them in the currency they pay in.
 *
 * When there is no export price the CALLER's own label stands in — the domestic one, for an Indonesian
 * reader asking about an overseas shipment. There is deliberately no rupiah branch for the export price
 * itself: usdPriceFor only answers null for an amount at or below zero, and at that point there is no
 * price to format either, so such a branch could never run. A sabotage proved it — dead code that reads
 * like a safeguard is worse than none, because the next reader trusts it.
 */
export const quotedInternationalPrice = (exportPrice, fallback = '') => {
  const usd = usdPriceFor(exportPrice);
  return usd ? `US$${usd}` : fallback;
};

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
 * ONE WORDING, BOTH SHOPS, since 2026-10-06. It split on the shop while the English one had no cart and
 * this button was the purchase there; both shops buy through the cart now, and this is the question
 * asked beside it in either language.
 *
 * It does not claim a bottle is held. Nothing is reserved until Dekito confirms on WhatsApp, and a draft
 * that implies otherwise makes a promise the atelier has not made.
 */
export const overseasDraftKeys = () => ({ labelKey: 'export.ask', draftKey: 'export.waDraft' });

/**
 * `quote` is the settled international total, as a message KEY and VARS from useInternationalQuote —
 * never rendered text, because text in a data object is Indonesian no scan for Indonesian can see.
 *
 * When it is present it REPLACES the price line rather than joining it. Both say what the bottle costs,
 * and a draft reading "the international price shown on your site: US$80" directly above "Perfume
 * US$80 · Shipping US$140 · Total US$220" makes Dekito read the same number twice to check it is the
 * same number. The quote is the better of the two: it is the figure the buyer was actually shown, with
 * the destination and the count that produced it, so the reply is a confirmation and not a calculation.
 */
export const buildOverseasDraft = ({
  t, name = '', size = '', price = '', quote = null,
} = {}) => {
  if (typeof t !== 'function' || !name) return '';
  const { draftKey } = overseasDraftKeys();
  const line = quote?.key
    ? t(quote.key, quote.vars || {})
    : (price ? t('export.waDraftPrice', { price }) : '');
  return t(draftKey, {
    item: `${name}${size ? ` (${size})` : ''}`,
    line,
  });
};

/**
 * The order an international buyer sends from the ENGLISH CART — every line, the destination, the
 * shipping, the total and the arrival estimate, in one message.
 *
 * Dekito's decision, 2026-10-06: the English shop takes a basket like the Indonesian one does. The
 * product page's WhatsApp button went back to being an enquiry that day; this is the purchase. It is
 * sent only when the quote is SETTLED — a destination picked and a rate found — because the whole point
 * of the basket is that the message arrives complete.
 */
export const buildInternationalCartDraft = ({ t, quote = null } = {}) => {
  if (typeof t !== 'function' || !quote?.key || !quote?.vars) return '';
  return t(quote.key, quote.vars);
};

export default buildOverseasDraft;
