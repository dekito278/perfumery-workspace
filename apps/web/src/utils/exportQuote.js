// The quote Dekito copies and sends back to an overseas buyer.
//
// WRITTEN IN ENGLISH AND IN DOLLARS, and that is the whole point of this file rather than a detail of it.
// It is the one piece of copy that leaves the Studio and lands in front of a foreign customer — the same
// class as the storefront's WhatsApp drafts, and the same reason: a buyer who wrote in English and pays
// into a USD account was being sent "Subtotal produk: Rp 2.520.000". The shop learned English in
// September and moved its international prices to the dollar on 24 Sep; this message, the only one an
// international buyer ever receives from the Studio, was left in Indonesian rupiah until 2026-10-06.
//
// The dollar figures are built with the SAME rounding the storefront uses, so the quote agrees with the
// page the buyer was looking at when they wrote. A hand-sent figure that disagrees with the website by
// five dollars is the bait-and-switch this whole feature exists to prevent, arriving by WhatsApp instead.
//
// Import-free so a selfcheck can run it: this produces a price quoted to a real person, and reading the
// source is not the same as running it. The converter is passed in rather than reimplemented.

/**
 * @param destinationName  the country, as it will appear in the message
 * @param lines            [{ name, size, quantity, unitPrice, overseasPriceSet }] — unitPrice in rupiah
 * @param shipping         { total, label } — what the buyer is charged and where that figure came from,
 *                         or null when there is no figure yet. The label used to be the hardcoded string
 *                         "LTU Express", which stayed on the message long after the shop moved to
 *                         RaySpeed and then to a published rate card: a quote that names the wrong
 *                         carrier, and later the wrong basis, to a real buyer.
 * @param toUsd            rupiah -> whole dollars, the app's own rounding (usdPriceFor), passed in
 * @param eta              the arrival estimate the website already shows for this destination, or ''
 * @param formatMoney      the app's own Rupiah formatter — for the figures RETURNED to the Studio screen,
 *                         never for the message
 */
export const buildExportQuote = ({
  destinationName = '', lines = [], shipping = null, toUsd = () => 0, eta = '', formatMoney = String,
} = {}) => {
  const priced = lines
    .map((line) => ({ ...line, quantity: Math.max(0, Math.round(Number(line.quantity) || 0)) }))
    .filter((line) => line.name && line.quantity > 0);

  const bottles = priced.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = priced.reduce((sum, line) => sum + (Number(line.unitPrice) || 0) * line.quantity, 0);
  const shippingTotal = Number(shipping?.total) || 0;

  // Lines still priced at the domestic rate. Sending one of these is quoting an overseas buyer the
  // Indonesian price, which is the whole thing the overseas tier exists to prevent — so it is named,
  // not swallowed.
  const withoutOverseasPrice = priced.filter((line) => !line.overseasPriceSet).map((line) => line.name);

  // Per BOTTLE, then multiplied — the same order the storefront uses, because the rounding is per bottle.
  // Summing the rupiah first and converting once would hand the buyer a different total from the one the
  // product page showed them.
  const lineUsd = (line) => Number(toUsd((Number(line.unitPrice) || 0))) * line.quantity;
  const goodsUsd = priced.reduce((sum, line) => sum + lineUsd(line), 0);
  const shippingUsd = shippingTotal > 0 ? Number(toUsd(shippingTotal)) : 0;

  const message = [
    `SOLIVAGANT — estimate for a shipment to ${destinationName || 'your country'}`,
    '',
    ...priced.map((line) => (
      `${line.quantity} × ${line.name}${line.size ? ` ${line.size}` : ''} — US$${Number(toUsd(Number(line.unitPrice) || 0))} = US$${lineUsd(line)}`
    )),
    '',
    `Perfume: US$${goodsUsd}`,
    // Zero is an ANSWER here, not a missing number — Dekito can waive the freight on an order he chooses
    // to, and he can also decide to quote it after this message. Both are decisions and both are said.
    // (This branch was once justified by "the international price already carries the shipping". That
    // promise was retired on 2026-09-25: the carrier bills a one-kilo minimum, so it only ever held on a
    // full parcel. Nothing here may imply the freight is included.)
    shipping && shippingUsd > 0
      ? `Shipping: US$${shippingUsd}`
      : (shipping?.label
        ? `Shipping: ${shipping.label}`
        : 'Shipping: we are confirming the rate to your country and will send it shortly.'),
    `Total: US$${goodsUsd + shippingUsd}`,
    ...(eta ? ['', `Estimated delivery: ${eta}`] : []),
    '',
    // Both lines are promises this quote must not accidentally make.
    'Import duties and taxes in your country are charged to the recipient on arrival, separately from this total.',
    'This estimate does not reserve stock.',
  ].join('\n');

  return {
    bottles,
    subtotal,
    shippingTotal,
    total: subtotal + shippingTotal,
    goodsUsd,
    shippingUsd,
    totalUsd: goodsUsd + shippingUsd,
    withoutOverseasPrice,
    message: priced.length ? message : '',
    // Kept so the Studio screen can still print its own rupiah figures with the app's formatter.
    formattedTotal: formatMoney(subtotal + shippingTotal),
  };
};
