// Turning an export quote into a real order.
//
// Most international sales come through the checkout now. This tool is for the ones that cannot: a
// country the shipping table does not cover, a bespoke bottle, a conversation that started on WhatsApp
// and ended in a price. RajaOngkir still cannot quote a foreign address, so those orders are written
// down from this side, and they carry three things the domestic checkout would get wrong:
//
//   1. the OVERSEAS unit price, not the Indonesian one,
//   2. shipping that was quoted by hand (or by the LTU table on this page), not by a domestic courier,
//   3. the shop it belongs to, so every message about it afterwards is written in English.
//
// Import-free so a selfcheck can RUN it. This produces the number a real person is charged; reading the
// source is not the same as running it.

const round = (value) => Math.max(0, Math.round(Number(value) || 0));

/**
 * @param lines            the calculator's priced lines: { product, variant, name, size, quantity,
 *                         unitPrice, overseasPriceSet }
 * @param shippingTotal    the shipping actually being charged, already resolved by the caller
 * @param destinationName  the country, as it goes into the order's notes
 * @param formatMoney      the app's own Rupiah formatter, passed in rather than reimplemented
 *
 * Returns { ok, reason, warnings, orderData }. `reason` is shown to Dekito, so it names what is
 * missing rather than saying the form is invalid.
 */
export const buildExportOrderData = ({
  lines = [],
  shippingTotal = 0,
  destinationName = '',
  customerName = '',
  contact = '',
  deliveryAddress = '',
  notes = '',
  formatMoney = String,
} = {}) => {
  const priced = lines
    .map((line) => ({ ...line, quantity: round(line.quantity) }))
    .filter((line) => line.product && line.name && line.quantity > 0);

  if (!priced.length) return { ok: false, reason: 'Pilih produk dan jumlahnya dulu.', warnings: [], orderData: null };
  if (!customerName.trim()) return { ok: false, reason: 'Isi nama pembelinya.', warnings: [], orderData: null };
  if (!contact.trim()) return { ok: false, reason: 'Isi kontak pembelinya — nomor WhatsApp atau email.', warnings: [], orderData: null };
  if (!deliveryAddress.trim()) return { ok: false, reason: 'Isi alamat kirimnya, lengkap dengan negara.', warnings: [], orderData: null };

  // Lines still on the domestic price. NOT refused: Dekito is allowed to sell at whatever price he
  // agreed to. But it is the exact mistake the overseas tier exists to prevent, so it is named on the
  // screen and written into the order rather than passing silently.
  const domesticPriced = priced.filter((line) => !line.overseasPriceSet).map((line) => line.name);

  const items = priced.map((line) => ({
    ...line.product,
    cartSlug: `${line.product.slug}-${line.variant?.id || line.size}`,
    variantId: line.variant?.id || '',
    size: line.size,
    quantity: line.quantity,
    price: formatMoney(line.unitPrice),
    priceNumber: round(line.unitPrice),
  }));

  const productsSubtotal = items.reduce((sum, item) => sum + item.priceNumber * item.quantity, 0);
  const shipping = round(shippingTotal);

  return {
    ok: true,
    reason: '',
    warnings: domesticPriced,
    orderData: {
      customerName: customerName.trim(),
      contact: contact.trim(),
      deliveryAddress: deliveryAddress.trim(),
      deliveryArea: destinationName || 'Luar negeri',
      items,
      quantity: items.reduce((sum, item) => sum + item.quantity, 0),
      // The same meaning the checkout gives it: what the customer owes, shipping included. Studio reads
      // this as the order total everywhere, so leaving shipping out would under-bill by the one number
      // this whole page exists to compute.
      subtotal: productsSubtotal + shipping,
      shippingFee: shipping,
      productsSubtotal,
      // Manual transfer: nothing has been paid, and payment_status starts 'pending' rather than 'unpaid'.
      paymentProvider: 'manual',
      // The point of the whole exercise. Every message about this order is written from this field.
      clientContext: { shop: 'en' },
      // This order is written FOR someone else. Without this the customer upsert falls back to the
      // signed-in account — Dekito's own row — and replaces his name, contact and address with the
      // buyer's. It did exactly that on the first real attempt.
      skipCustomerRecord: true,
      notesLines: [
        `Order luar negeri, disepakati lewat WhatsApp${destinationName ? ` — ${destinationName}` : ''}.`,
        `Ongkir: ${formatMoney(shipping)}${shipping > 0 ? '' : ' (belum dihitung)'}`,
        domesticPriced.length ? `Harga domestik dipakai untuk: ${domesticPriced.join(', ')}` : '',
        notes.trim(),
      ].filter(Boolean),
    },
  };
};

export default buildExportOrderData;
