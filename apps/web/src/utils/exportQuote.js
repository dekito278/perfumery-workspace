// Turning an overseas enquiry into one number Dekito can send back. Import-free so a selfcheck can run
// it: this produces a price quoted to a real person, and reading the source is not the same as running
// it. The shipping cost is passed in already computed — exportShipping.js owns that.

/**
 * @param destinationName  the country, as it will appear in the message
 * @param lines            [{ name, size, quantity, unitPrice, overseasPriceSet }]
 * @param shipping         the quoteExportShipping() result, or null when the country is not served
 * @param formatMoney      the app's own Rupiah formatter, passed in rather than reimplemented
 */
export const buildExportQuote = ({ destinationName = '', lines = [], shipping = null, formatMoney = String } = {}) => {
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

  const message = [
    `SOLIVAGANT — perkiraan kiriman ke ${destinationName || 'luar negeri'}`,
    '',
    ...priced.map((line) => (
      `${line.quantity} × ${line.name}${line.size ? ` ${line.size}` : ''} — ${formatMoney(line.unitPrice)} = ${formatMoney((Number(line.unitPrice) || 0) * line.quantity)}`
    )),
    '',
    `Subtotal produk: ${formatMoney(subtotal)}`,
    shipping
      ? `Ongkir (LTU Express, ${shipping.chargeableKg} kg): ${formatMoney(shippingTotal)}`
      : 'Ongkir: negara ini belum ada di daftar tujuan kurir — saya cek dulu ya.',
    `Total: ${formatMoney(subtotal + shippingTotal)}`,
    '',
    // Both lines are promises this quote must not accidentally make.
    'Pajak masuk di negara tujuan ditagih ke penerima saat barang tiba, terpisah dari total ini.',
    'Perkiraan ini belum memesan stok.',
  ].join('\n');

  return {
    bottles,
    subtotal,
    shippingTotal,
    total: subtotal + shippingTotal,
    withoutOverseasPrice,
    message: priced.length ? message : '',
  };
};
