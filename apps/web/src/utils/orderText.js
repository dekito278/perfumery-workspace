// The notes and the copyable draft stored on a storefront order, written by the SERVER from the figures it
// actually charges. Import-free so api/orders/create.js and the guard can both load it.
//
// Ninth visitor audit, 13 Nov 2026: the endpoint re-priced every line, the shipping and the voucher — and
// then stored the browser's own "Subtotal / Shipping fee / Total" text unchanged as the order's draft and
// notes. Whenever the two disagreed (a courier rate that moved, a member price, a crafted request), Studio
// showed staff a total the buyer was never charged. The buyer's own note is the one thing taken from them.

const rupiah = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(Number(value) || 0))}`;

const PAYMENT_LABELS = {
  manual_transfer_bca: 'Transfer manual BCA',
  manual: 'Transfer manual BCA',
  manual_transfer_usd: 'International transfer (USD)',
  doku: 'DOKU Checkout',
  'doku-qris': 'QRIS',
};
export const paymentLabelFor = (provider) => PAYMENT_LABELS[String(provider || '')] || String(provider || 'Manual confirmation');

/**
 * The buyer's own note: the dedicated field, else — for a tab still running the previous build — what
 * follows the "Notes:" key of its notes text. That key is always the last one cartService writes, and a
 * note can run over several lines, so everything after it is the note.
 */
export const buyerNoteFrom = (input = {}) => {
  if (typeof input.buyerNote === 'string') return input.buyerNote.trim().slice(0, 1000);
  const text = String(input.notes || '');
  const at = text.startsWith('Notes: ') ? 0 : text.lastIndexOf('\nNotes: ') + 1;
  if (at === 0 && !text.startsWith('Notes: ')) return '';
  return text.slice(at + 'Notes: '.length).trim().slice(0, 1000);
};

export const buildServerOrderText = ({
  customerName = '', customerCode = '', contact = '', address = '', area = '',
  shippingSummary = '', paymentProvider = '', lines = [], itemsSubtotal = 0,
  voucherCode = '', voucherDiscount = 0, shippingFee = 0, total = 0, buyerNote = '',
} = {}) => {
  const payment = paymentLabelFor(paymentProvider);
  const notes = [
    address ? `Address: ${address}` : '',
    area ? `Area: ${area}` : '',
    shippingSummary ? `Shipping: ${shippingSummary}` : '',
    payment ? `Payment: ${payment}` : '',
    buyerNote ? `Notes: ${buyerNote}` : '',
  ].filter(Boolean).join('\n');
  const quantity = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const checkoutDraft = [
    'Solivagant order draft',
    '',
    `Customer: ${customerName || '-'}`,
    customerCode ? `Customer code: ${customerCode}` : null,
    `Contact: ${contact || '-'}`,
    `Address: ${address || '-'}`,
    `Area: ${area || '-'}`,
    `Shipping: ${shippingSummary || '-'}`,
    `Payment: ${payment}`,
    '',
    'Items:',
    ...lines.map((line) => `- ${line.name} (${line.size || '-'}) x${line.quantity}: ${line.price}`),
    '',
    `Total items: ${quantity}`,
    `Subtotal: ${rupiah(itemsSubtotal)}`,
    voucherCode && voucherDiscount ? `Voucher ${voucherCode}: -${rupiah(voucherDiscount)}` : null,
    shippingFee ? `Shipping fee: ${rupiah(shippingFee)}` : null,
    `Total: ${rupiah(total)}`,
    buyerNote ? `Notes: ${buyerNote}` : 'Notes: -',
  ].filter((line) => line != null).join('\n');
  return { notes, checkoutDraft };
};
