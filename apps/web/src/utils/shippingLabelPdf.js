import { jsPDF } from 'jspdf';

const PAGE_WIDTH = 105;
const PAGE_HEIGHT = 148;
const MARGIN = 8;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
const BRAND = {
  ink: [23, 32, 22],
  muted: [91, 103, 83],
  soft: [238, 242, 232],
  border: [202, 211, 194],
  accent: [38, 61, 39],
};

const asText = (value, fallback = '-') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return '-';
  }
};

const safeFilename = (value) => (
  `${asText(value, 'order')}_resi.pdf`
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '_')
);

const parseNoteField = (notes = '', label) => {
  const prefix = `${label}:`;
  return String(notes || '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith(prefix.toLowerCase()))
    ?.slice(prefix.length)
    .trim() || '';
};

const getOrderAddress = (order) => parseNoteField(order?.notes, 'Address');
const getOrderArea = (order) => parseNoteField(order?.notes, 'Area');
const getOrderShipping = (order) => parseNoteField(order?.notes, 'Shipping');

export const canExportShippingLabel = (order) => Boolean(
  order
    && order.paymentStatus === 'paid'
    && !['cancelled'].includes(order.status)
);

const drawDivider = (doc, y) => {
  doc.setDrawColor(...BRAND.border);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
};

const drawLabelValue = (doc, label, value, x, y, width = CONTENT_WIDTH) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...BRAND.muted);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.ink);
  const lines = doc.splitTextToSize(asText(value), width);
  doc.text(lines, x, y + 4.2);
  return y + 5 + (lines.length * 3.7);
};

export const exportShippingLabelPdf = (order) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a6', orientation: 'portrait' });
  const address = getOrderAddress(order);
  const area = getOrderArea(order);
  const shipping = getOrderShipping(order);
  const itemSummary = (order.items || [])
    .map((item) => `${item.name} x${item.quantity}${item.size ? ` / ${item.size}` : ''}`)
    .join('\n');

  doc.setFillColor(...BRAND.soft);
  doc.rect(0, 0, PAGE_WIDTH, 22, 'F');
  doc.setTextColor(...BRAND.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SOLIVAGANT', MARGIN, 10);
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text('Shipping label / resi print', MARGIN, 15.3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.accent);
  doc.text(asText(order.orderNumber), PAGE_WIDTH - MARGIN, 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(formatDate(order.updatedAt || order.createdAt), PAGE_WIDTH - MARGIN, 15.3, { align: 'right' });

  let y = 29;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text('KIRIM KE', MARGIN, y);
  y += 6;
  doc.setFontSize(15);
  doc.setTextColor(...BRAND.ink);
  doc.text(doc.splitTextToSize(asText(order.customerName, 'Customer'), CONTENT_WIDTH), MARGIN, y);
  y += 11;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Telp: ${asText(order.contact)}`, MARGIN, y);
  y += 7;
  doc.setFontSize(9.2);
  doc.text(doc.splitTextToSize(asText(address, 'Alamat belum tersedia'), CONTENT_WIDTH), MARGIN, y);
  y += Math.max(12, doc.splitTextToSize(asText(address, 'Alamat belum tersedia'), CONTENT_WIDTH).length * 4.4);
  if (area) {
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(area, CONTENT_WIDTH), MARGIN, y);
    y += 8;
  }

  drawDivider(doc, y);
  y += 8;
  const leftWidth = 43;
  const rightX = MARGIN + leftWidth + 5;
  y = Math.max(
    drawLabelValue(doc, 'Kurir', order.courierName || shipping || 'Belum dipilih', MARGIN, y, leftWidth),
    drawLabelValue(doc, 'Nomor resi', order.trackingNumber || 'Belum ada resi', rightX, y, CONTENT_WIDTH - leftWidth - 5),
  );

  y += 2;
  drawDivider(doc, y);
  y += 7;
  y = drawLabelValue(doc, 'Isi paket', itemSummary || `${order.quantity || 0} item`, MARGIN, y);

  y = Math.min(y + 2, PAGE_HEIGHT - 33);
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BRAND.ink);
  doc.roundedRect(MARGIN, PAGE_HEIGHT - 27, CONTENT_WIDTH, 18, 2, 2, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...BRAND.ink);
  doc.text(asText(order.orderNumber), PAGE_WIDTH / 2, PAGE_HEIGHT - 16, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.muted);
  doc.text('Scan/check order di admin sebelum serah ke kurir', PAGE_WIDTH / 2, PAGE_HEIGHT - 10.7, { align: 'center' });

  doc.save(safeFilename(order.orderNumber));
};
