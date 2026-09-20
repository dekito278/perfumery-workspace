import { getOrderProductItems, getOrderVoucherSnapshot } from '@/utils/orderTotals.js';
import { normalizeWhatsAppPhoneNumber } from '@/utils/phoneNumber.js';

// Studio's own event picker. Stays Indonesian: Dekito reads it, not the buyer.
const notificationEventLabels = {
  order_created: 'Order dibuat',
  paid: 'Pembayaran diterima',
  payment_proof_rejected: 'Bukti transfer ditolak',
  processing: 'Order diproses',
  shipped: 'Order dikirim',
  completed: 'Order selesai',
};

// The buyer's half of the same list — it goes out as the email subject line, so it follows the order.
const notificationEventLabelsEn = {
  order_created: 'Order received',
  paid: 'Payment confirmed',
  payment_proof_rejected: 'Transfer proof could not be verified',
  processing: 'Order in production',
  shipped: 'Order shipped',
  completed: 'Order complete',
};

/**
 * Which shop this order was placed in — and therefore which language its buyer reads.
 *
 * Taken off the order itself rather than from an argument: buildNotificationMessage has fifteen call
 * sites across Studio desktop and mobile, and a language passed in by each of them is a language
 * fourteen of them will forget. The order already carries the answer, recorded at checkout.
 *
 * Anything else — an order placed before the field existed, a local draft, a row the server refused the
 * hint on — is Indonesian, which is what every one of those orders actually was.
 */
const shopOf = (order) => (order?.clientContext?.shop === 'en' ? 'en' : 'id');

// The English shop lives at /en, so a link handed to an English buyer has to keep the prefix. Without
// it the invoice we just told them to open reloads in Indonesian.
const shopPrefix = (order) => (shopOf(order) === 'en' ? '/en' : '');

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const formatItemLines = (order = {}) => {
  const items = getOrderProductItems(order);
  const voucherSnapshot = getOrderVoucherSnapshot(order);
  const itemLines = items.length
    ? items.map((item) => `- ${item.name}${item.size ? ` (${item.size})` : ''} x${item.quantity || 1}`)
    : [shopOf(order) === 'en' ? '- Order item' : '- Item order'];
  return [
    ...itemLines,
    voucherSnapshot ? `Voucher ${voucherSnapshot.code}: -${formatTotal(voucherSnapshot.discountAmount)}` : '',
  ].filter(Boolean).join('\n');
};

const isEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());

/**
 * Where this buyer can look their order up.
 *
 * The customer dashboard is keyed by a customer code, and an export order has none: it is written for
 * someone who has no account here, and since #217 it deliberately creates no customer record — the one
 * that used to be created was the signed-in admin's own.
 *
 * So the fallback is the PUBLIC tracking page, which needs nothing but the order number. Measured on the
 * first real export order: the message went out with no link at all, which leaves a buyer abroad holding
 * an order number and nowhere to type it.
 */
const getTrackingUrl = (order) => {
  if (typeof window === 'undefined' || !order?.orderNumber) return '';
  return `${window.location.origin}${shopPrefix(order)}/track/${encodeURIComponent(order.orderNumber)}`;
};

const getCustomerDashboardUrl = (order) => {
  if (typeof window === 'undefined') return '';
  if (!order?.customerCode) return getTrackingUrl(order);
  return `${window.location.origin}${shopPrefix(order)}/mobile/customer?code=${encodeURIComponent(order.customerCode)}`;
};

const getInvoiceUrl = (order) => {
  if (typeof window === 'undefined' || !order?.orderNumber) return '';
  // The invoice page is behind the customer code too. Without one, the tracking page is what this buyer
  // can actually open — and a link they can use beats a line they cannot.
  if (!order?.customerCode) return getTrackingUrl(order);
  return `${window.location.origin}${shopPrefix(order)}/mobile/customer/invoice/${encodeURIComponent(order.orderNumber)}?code=${encodeURIComponent(order.customerCode)}`;
};

const getManualPaymentUploadUrl = (order) => {
  if (typeof window === 'undefined' || !order?.orderNumber) return '';
  return `${window.location.origin}${shopPrefix(order)}/payment?order=${encodeURIComponent(order.orderNumber)}&payment=manual`;
};

/**
 * The line that carries the link, named for what the link actually opens.
 *
 * An order with a customer code gets the invoice page; one without gets public tracking. Labelling a
 * tracking page "Invoice" would be a small lie that costs the buyer a click to discover.
 */
const linkLine = (order, invoiceLabel, trackingLabel) => {
  const url = getInvoiceUrl(order);
  if (!url) return null;
  return `${order?.customerCode ? invoiceLabel : trackingLabel}: ${url}`;
};

const buildGreeting = (order) => (shopOf(order) === 'en'
  ? `Hi ${order?.customerName || 'there'},`
  : `Halo ${order?.customerName || 'Kak'},`);

// Two shops, two sets of words. NOT a translation of each other line by line — the Indonesian says
// "Kak" to a stranger and "Tim Solivagant" of a one-person atelier, and neither reads right in English.
// What both must say is the same FACTS: which order, what it cost, what happens next, and where to look.
//
// Everything here is operational. Nothing promises a price, a shipping rate or a delivery date, because
// an English message goes to a buyer this checkout cannot quote international shipping for.
const templatesById = {
  order_created: (order) => [
    buildGreeting(order),
    '',
    `Order Solivagant kamu sudah kami terima: ${order.orderNumber}.`,
    '',
    'Detail order:',
    formatItemLines(order),
    `Total: ${formatTotal(order.subtotal)}`,
    `Status pembayaran: ${order.paymentStatus || '-'}`,
    order.customerCode ? `Kode customer: ${order.customerCode}` : null,
    linkLine(order, 'Invoice', 'Lacak pesanan'),
    '',
    'Kami akan update lagi setelah pembayaran terkonfirmasi. Terima kasih.',
  ],
  paid: (order) => [
    buildGreeting(order),
    '',
    `Pembayaran untuk order ${order.orderNumber} sudah terkonfirmasi.`,
    '',
    'Tim Solivagant akan lanjut proses order kamu. Kamu bisa cek progress di dashboard:',
    getCustomerDashboardUrl(order),
    '',
    'Terima kasih, order kamu sudah masuk antrean produksi/fulfillment.',
  ],
  payment_proof_rejected: (order) => [
    buildGreeting(order),
    '',
    `Bukti transfer untuk order ${order.orderNumber} belum bisa kami validasi.`,
    order.paymentProofNotes ? `Catatan admin: ${order.paymentProofNotes}` : null,
    '',
    'Mohon upload ulang bukti transfer yang jelas lewat link berikut:',
    getManualPaymentUploadUrl(order),
    '',
    `Total order: ${formatTotal(order.subtotal)}`,
    order.customerCode ? `Kode customer: ${order.customerCode}` : null,
    '',
    'Status order tetap pending sampai bukti transfer baru kami cek. Terima kasih.',
  ],
  processing: (order) => [
    buildGreeting(order),
    '',
    `Order ${order.orderNumber} sedang kami proses.`,
    '',
    'Tim Solivagant sedang menyiapkan pesanan kamu. Progress order bisa dicek di dashboard:',
    getCustomerDashboardUrl(order),
    '',
    'Kami akan kirim update lagi setelah paket masuk proses pengiriman.',
  ],
  shipped: (order) => [
    buildGreeting(order),
    '',
    `Order ${order.orderNumber} sudah dikirim.`,
    order.courierName ? `Kurir: ${order.courierName}` : null,
    order.trackingNumber ? `Resi: ${order.trackingNumber}` : null,
    order.trackingUrl ? `Tracking: ${order.trackingUrl}` : getCustomerDashboardUrl(order) ? `Cek progress: ${getCustomerDashboardUrl(order)}` : null,
    '',
    'Mohon cek paket saat diterima. Semoga aromanya sampai dengan aman.',
  ],
  completed: (order) => [
    buildGreeting(order),
    '',
    `Order ${order.orderNumber} sudah selesai. Terima kasih sudah memilih Solivagant.`,
    '',
    'Kalau ada feedback soal aroma, packaging, atau experience, boleh langsung balas pesan ini ya.',
    linkLine(order, 'Invoice/receipt', 'Lacak pesanan'),
  ],
};

const templatesByEn = {
  order_created: (order) => [
    buildGreeting(order),
    '',
    `We have your SOLIVAGANT order: ${order.orderNumber}.`,
    '',
    'Order details:',
    formatItemLines(order),
    `Total: ${formatTotal(order.subtotal)}`,
    `Payment status: ${order.paymentStatus || '-'}`,
    order.customerCode ? `Customer code: ${order.customerCode}` : null,
    linkLine(order, 'Invoice', 'Track your order'),
    '',
    'We will write again once the payment is confirmed. Thank you.',
  ],
  paid: (order) => [
    buildGreeting(order),
    '',
    `Payment for order ${order.orderNumber} is confirmed.`,
    '',
    'Your order is going into production. You can follow it here:',
    getCustomerDashboardUrl(order),
    '',
    'Thank you — it is in the queue now.',
  ],
  payment_proof_rejected: (order) => [
    buildGreeting(order),
    '',
    `We could not verify the transfer proof for order ${order.orderNumber}.`,
    order.paymentProofNotes ? `Note: ${order.paymentProofNotes}` : null,
    '',
    'Please upload a clearer transfer proof here:',
    getManualPaymentUploadUrl(order),
    '',
    `Order total: ${formatTotal(order.subtotal)}`,
    order.customerCode ? `Customer code: ${order.customerCode}` : null,
    '',
    'The order stays pending until we have checked the new proof. Thank you.',
  ],
  processing: (order) => [
    buildGreeting(order),
    '',
    `Order ${order.orderNumber} is being made.`,
    '',
    'Your bottles are being prepared. You can follow the order here:',
    getCustomerDashboardUrl(order),
    '',
    'We will write again when the parcel goes out.',
  ],
  shipped: (order) => [
    buildGreeting(order),
    '',
    `Order ${order.orderNumber} has been shipped.`,
    order.courierName ? `Courier: ${order.courierName}` : null,
    order.trackingNumber ? `Tracking number: ${order.trackingNumber}` : null,
    order.trackingUrl ? `Tracking: ${order.trackingUrl}` : getCustomerDashboardUrl(order) ? `Follow it here: ${getCustomerDashboardUrl(order)}` : null,
    '',
    'Please check the parcel when it arrives. We hope it reaches you safely.',
  ],
  completed: (order) => [
    buildGreeting(order),
    '',
    `Order ${order.orderNumber} is complete. Thank you for choosing SOLIVAGANT.`,
    '',
    'If you have anything to say about the scent, the packaging or the experience, just reply to this message.',
    linkLine(order, 'Invoice/receipt', 'Track your order'),
  ],
};

const templates = { id: templatesById, en: templatesByEn };

export const getNotificationEventLabels = () => notificationEventLabels;

export const buildNotificationMessage = (order, eventKey) => (
  templates[shopOf(order)][eventKey]?.(order || {})
    // Drop only the optional lines that were not applicable — they are null. An empty string here is a
    // deliberate paragraph break, and filtering those out too glued every message into one block: the
    // greeting ran straight into the order number and the closing sentence into the customer code.
    .filter((line) => line != null)
    .join('\n')
    .trim()
  || ''
);

export const buildNotificationSubject = (order, eventKey) => {
  const english = shopOf(order) === 'en';
  const labels = english ? notificationEventLabelsEn : notificationEventLabels;
  const label = labels[eventKey] || (english ? 'Order update' : 'Update order');
  return `Solivagant ${label} - ${order?.orderNumber || 'Order'}`;
};

// Hand the message off through whatever channel the customer actually gave us. Every caller used to open
// WhatsApp unconditionally, so an order whose contact is an email opened wa.me with no recipient while the
// toast said the message had been sent (audit round 7). Renamed from getNotificationHandoffUrl because it
// is no longer WhatsApp-only.
export const getNotificationHandoffUrl = (order, message, eventKey) => {
  const phone = normalizeWhatsAppPhoneNumber(order?.contact);
  if (phone) {
    return `https://wa.me/${phone}?text=${encodeURIComponent(message || '')}`;
  }
  if (isEmail(order?.contact)) {
    return getEmailNotificationUrl(order, eventKey, message);
  }
  return `https://wa.me/?text=${encodeURIComponent(message || '')}`;
};

export const getEmailNotificationUrl = (order, eventKey, message) => {
  const email = isEmail(order?.contact) ? String(order.contact).trim() : '';
  const subject = encodeURIComponent(buildNotificationSubject(order, eventKey));
  const body = encodeURIComponent(message || '');
  return `mailto:${email}?subject=${subject}&body=${body}`;
};

export const canSendEmailNotification = (order) => isEmail(order?.contact);
