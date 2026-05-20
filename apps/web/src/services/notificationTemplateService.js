import { getOrderProductItems, getOrderVoucherSnapshot } from '@/utils/orderTotals.js';
import { normalizeWhatsAppPhoneNumber } from '@/utils/phoneNumber.js';

const notificationEventLabels = {
  order_created: 'Order dibuat',
  paid: 'Pembayaran diterima',
  payment_proof_rejected: 'Bukti transfer ditolak',
  processing: 'Order diproses',
  shipped: 'Order dikirim',
  completed: 'Order selesai',
};

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const formatItemLines = (order = {}) => {
  const items = getOrderProductItems(order);
  const voucherSnapshot = getOrderVoucherSnapshot(order);
  const itemLines = items.length
    ? items.map((item) => `- ${item.name}${item.size ? ` (${item.size})` : ''} x${item.quantity || 1}`)
    : ['- Item order'];
  return [
    ...itemLines,
    voucherSnapshot ? `Voucher ${voucherSnapshot.code}: -${formatTotal(voucherSnapshot.discountAmount)}` : '',
  ].filter(Boolean).join('\n');
};

const isEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());

const getCustomerDashboardUrl = (order) => {
  if (typeof window === 'undefined' || !order?.customerCode) return '';
  return `${window.location.origin}/mobile/customer?code=${encodeURIComponent(order.customerCode)}`;
};

const getInvoiceUrl = (order) => {
  if (typeof window === 'undefined' || !order?.customerCode || !order?.orderNumber) return '';
  return `${window.location.origin}/mobile/customer/invoice/${encodeURIComponent(order.orderNumber)}?code=${encodeURIComponent(order.customerCode)}`;
};

const getManualPaymentUploadUrl = (order) => {
  if (typeof window === 'undefined' || !order?.orderNumber) return '';
  return `${window.location.origin}/payment?order=${encodeURIComponent(order.orderNumber)}&payment=manual`;
};

const buildGreeting = (order) => `Halo ${order?.customerName || 'Kak'},`;

const templates = {
  order_created: (order) => [
    buildGreeting(order),
    '',
    `Order Solivagant kamu sudah kami terima: ${order.orderNumber}.`,
    '',
    'Detail order:',
    formatItemLines(order),
    `Total: ${formatTotal(order.subtotal)}`,
    `Status pembayaran: ${order.paymentStatus || '-'}`,
    order.customerCode ? `Kode customer: ${order.customerCode}` : '',
    getInvoiceUrl(order) ? `Invoice: ${getInvoiceUrl(order)}` : '',
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
    order.paymentProofNotes ? `Catatan admin: ${order.paymentProofNotes}` : '',
    '',
    'Mohon upload ulang bukti transfer yang jelas lewat link berikut:',
    getManualPaymentUploadUrl(order),
    '',
    `Total order: ${formatTotal(order.subtotal)}`,
    order.customerCode ? `Kode customer: ${order.customerCode}` : '',
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
    order.courierName ? `Kurir: ${order.courierName}` : '',
    order.trackingNumber ? `Resi: ${order.trackingNumber}` : '',
    order.trackingUrl ? `Tracking: ${order.trackingUrl}` : getCustomerDashboardUrl(order) ? `Cek progress: ${getCustomerDashboardUrl(order)}` : '',
    '',
    'Mohon cek paket saat diterima. Semoga aromanya sampai dengan aman.',
  ],
  completed: (order) => [
    buildGreeting(order),
    '',
    `Order ${order.orderNumber} sudah selesai. Terima kasih sudah memilih Solivagant.`,
    '',
    'Kalau ada feedback soal aroma, packaging, atau experience, boleh langsung balas pesan ini ya.',
    getInvoiceUrl(order) ? `Invoice/receipt: ${getInvoiceUrl(order)}` : '',
  ],
};

export const getNotificationEventLabels = () => notificationEventLabels;

export const buildNotificationMessage = (order, eventKey) => (
  templates[eventKey]?.(order || {})
    .filter((line) => line !== '')
    .join('\n')
    .trim()
  || ''
);

export const buildNotificationSubject = (order, eventKey) => {
  const label = notificationEventLabels[eventKey] || 'Update order';
  return `Solivagant ${label} - ${order?.orderNumber || 'Order'}`;
};

export const getWhatsAppNotificationUrl = (order, message) => {
  const phone = normalizeWhatsAppPhoneNumber(order?.contact);
  const text = encodeURIComponent(message || '');
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
};

export const getEmailNotificationUrl = (order, eventKey, message) => {
  const email = isEmail(order?.contact) ? String(order.contact).trim() : '';
  const subject = encodeURIComponent(buildNotificationSubject(order, eventKey));
  const body = encodeURIComponent(message || '');
  return `mailto:${email}?subject=${subject}&body=${body}`;
};

export const canSendEmailNotification = (order) => isEmail(order?.contact);
