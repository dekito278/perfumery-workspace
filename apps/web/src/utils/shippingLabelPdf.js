import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { buildPublicTrackingUrl } from '@/services/publicTrackingService.js';
import { getOrderNoteField } from './orderNotes.js';

const PAGE_WIDTH = 105;
const PAGE_HEIGHT = 148;
const MARGIN = 8;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
// The QR block is pinned to the bottom of the label. Everything above it has to respect that, which is
// what the brief did not do: its loop had no bound, so a long aroma wrote straight through the box and
// came out overlapping the order number, cut mid-word.
const QR_BLOCK_TOP = PAGE_HEIGHT - 28;
const BRIEF_BOTTOM = QR_BLOCK_TOP - 4;
const BRIEF_LINE = 3.8;
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

const safeBatchFilename = (count) => (
  `batch_resi_${count || 0}_orders.pdf`
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
);

const getOrderAddress = (order) => getOrderNoteField(order?.notes, 'Address');
const getOrderArea = (order) => getOrderNoteField(order?.notes, 'Area');
const getOrderShipping = (order) => getOrderNoteField(order?.notes, 'Shipping');

const getBespokeBriefItem = (order) => (order?.items || []).find((item) => item.type === 'bespoke_request');

// What the person packing the box needs to identify and assemble it: which perfume, which bottle, which
// cap and label, which material. Deliberately NOT the scent composition — that is the formula, it is no
// help at the packing table, and a courier label is the last place it should be travelling.
const bespokeBriefRows = (item) => [
  ['Nama parfum', item.perfumeName || 'Belum diberi nama'],
  ['Botol', [item.size, item.bottleType].filter(Boolean).join(' / ')],
  ['Cap / label', [item.capDesign, item.labelDesign].filter(Boolean).join(' / ')],
  ['Material', item.exoticMaterial],
].filter(([, value]) => String(value || '').trim());

export const canExportShippingLabel = (order) => Boolean(
  order
    && order.paymentStatus === 'paid'
    && !['cancelled'].includes(order.status)
);

const drawDivider = (doc, y) => {
  doc.setDrawColor(...BRAND.border);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
};

const drawLabelValue = (doc, label, value, x, y, width = CONTENT_WIDTH, maxY = Infinity) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...BRAND.muted);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.ink);
  const lines = doc.splitTextToSize(asText(value), width);
  // maxY is the last line the caller can afford; without it a long packing list ran under the QR block.
  const room = Math.floor((maxY - (y + 4.2)) / 3.7) + 1;
  const shown = Number.isFinite(maxY) ? lines.slice(0, Math.max(room, 1)) : lines;
  if (shown.length < lines.length) {
    shown[shown.length - 1] = `${String(shown[shown.length - 1]).replace(/[\s,.;/]+$/, '')}...`;
  }
  doc.text(shown, x, y + 4.2);
  return y + 5 + (shown.length * 3.7);
};

const createTrackingQrDataUrl = async (value) => {
  try {
    return await QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 180,
    });
  } catch {
    return '';
  }
};

const drawShippingLabel = async (doc, order) => {
  const address = getOrderAddress(order);
  const area = getOrderArea(order);
  const shipping = getOrderShipping(order);
  const publicTrackingUrl = buildPublicTrackingUrl(order.orderNumber);
  const publicTrackingQr = await createTrackingQrDataUrl(publicTrackingUrl);
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
  doc.setFontSize(13.5);
  doc.setTextColor(...BRAND.ink);
  doc.text(doc.splitTextToSize(asText(order.customerName, 'Customer'), CONTENT_WIDTH), MARGIN, y);
  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Telp: ${asText(order.contact)}`, MARGIN, y);
  y += 7;
  doc.setFontSize(9.2);
  doc.text(doc.splitTextToSize(asText(address, 'Alamat belum tersedia'), CONTENT_WIDTH), MARGIN, y);
  y += Math.max(10, doc.splitTextToSize(asText(address, 'Alamat belum tersedia'), CONTENT_WIDTH).length * 4.1);
  if (area) {
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(area, CONTENT_WIDTH), MARGIN, y);
    y += 6.5;
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
  const bespokeItem = getBespokeBriefItem(order);
  if (bespokeItem) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...BRAND.muted);
    doc.text('BRIEF BESPOKE', MARGIN, y);
    y += 4.4;
    let clipped = false;
    for (const [label, value] of bespokeBriefRows(bespokeItem)) {
      const lines = doc.splitTextToSize(asText(value), CONTENT_WIDTH - 24);
      // How many lines still fit above the QR block. Nothing is drawn — not even the label — for a row
      // with no room, so the label can never end up stranded over the box on its own.
      const room = Math.floor((BRIEF_BOTTOM - y) / BRIEF_LINE) + 1;
      if (room < 1) {
        clipped = true;
        break;
      }

      const shown = lines.slice(0, room);
      if (shown.length < lines.length) {
        clipped = true;
        shown[shown.length - 1] = `${String(shown[shown.length - 1]).replace(/[\s,.;/]+$/, '')}...`;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.4);
      doc.setTextColor(...BRAND.accent);
      doc.text(`${label}:`, MARGIN, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...BRAND.ink);
      doc.text(shown, MARGIN + 24, y);
      y += Math.max(4.4, shown.length * BRIEF_LINE);
    }

    // Pinned just above the QR block rather than after the last row, so it is there whenever the brief
    // was cut — otherwise the one case that needs the note is the case with no room left to print it.
    if (clipped) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.4);
      doc.setTextColor(...BRAND.muted);
      doc.text('Brief dipotong — selengkapnya di app.', MARGIN, QR_BLOCK_TOP - 2.2);
    }
  } else {
    y = drawLabelValue(doc, 'Isi paket', itemSummary || `${order.quantity || 0} item`, MARGIN, y, CONTENT_WIDTH, BRIEF_BOTTOM);
  }

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BRAND.ink);
  doc.roundedRect(MARGIN, QR_BLOCK_TOP, CONTENT_WIDTH, 20, 2, 2, 'S');
  if (publicTrackingQr) {
    doc.addImage(publicTrackingQr, 'PNG', MARGIN + 2, QR_BLOCK_TOP + 1.6, 16.8, 16.8);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(...BRAND.ink);
  doc.text(asText(order.orderNumber), PAGE_WIDTH - MARGIN - 3, QR_BLOCK_TOP + 7, { align: 'right' });
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.muted);
  doc.text('Scan QR / cek publik:', PAGE_WIDTH - MARGIN - 3, QR_BLOCK_TOP + 11.4, { align: 'right' });
  doc.setFontSize(6.2);
  doc.text(doc.splitTextToSize(publicTrackingUrl.replace(/^https?:\/\//, ''), CONTENT_WIDTH - 26), PAGE_WIDTH - MARGIN - 3, QR_BLOCK_TOP + 15, { align: 'right' });
};

export const exportShippingLabelPdf = async (order) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a6', orientation: 'portrait' });
  await drawShippingLabel(doc, order);

  doc.save(safeFilename(order.orderNumber));
};

export const exportShippingLabelsPdf = async (orders = []) => {
  const printableOrders = orders.filter(canExportShippingLabel);
  if (!printableOrders.length) return 0;

  const doc = new jsPDF({ unit: 'mm', format: 'a6', orientation: 'portrait' });
  for (const [index, order] of printableOrders.entries()) {
    if (index > 0) {
      doc.addPage('a6', 'portrait');
    }
    await drawShippingLabel(doc, order);
  }

  doc.save(safeBatchFilename(printableOrders.length));
  return printableOrders.length;
};
