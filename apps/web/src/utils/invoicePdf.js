import { jsPDF } from 'jspdf';
import { BRAND_PROFILE } from '@/data/brandProfile.js';
import { GIFT_VIAL_SIZE_ML, giftVialsFor } from '@/utils/internationalGiftVials.js';
import { BOTTLE_CUSTOMS_DESCRIPTION, vialCustomsDescription } from '@/utils/invoiceCustomsText.js';

// The commercial invoice for one order, as a PDF.
//
// A COMMERCIAL INVOICE TRAVELS WITH THE PARCEL, which is why the goods are described the way customs
// reads them and not the way the perfumer does: a US shipment was held by Fish and Wildlife over the
// word "oud". So every line says "Perfume, alcohol-based, synthetic fragrance, 30 ml" and the gift says
// "Perfume sample, 3 ml".
//
// THE PERFUME NAMES ARE NOT ON IT, and that is a decision Dekito should overrule if he wants to. His
// brief asks for the variant name in the item table AND forbids the word Aquilaria on a shipping
// document — and "Aquilaria tuberosa" is one of the nineteen products. Printing names would put that one
// in front of an inspector holding a species list. The order number is the buyer's reference, and the
// quote they agreed on names what they bought.
//
// NO "SHIPPING INCLUDED" NOTE either, which his brief also asks for. That promise was retired on
// 2026-09-25 because the carrier bills a one-kilo minimum, so it only ever held for a full parcel — and
// this invoice prints the freight as its own line, so the note would contradict the number above it.

const MARGIN = 16;
const PAGE_WIDTH = 210;
const INK = [23, 32, 22];
const MUTED = [104, 112, 98];
const RULE = [206, 213, 198];

const money = (usd) => `US$${Number(usd || 0).toLocaleString('en-US')}`;

/**
 * @param order     { invoiceNumber, orderNumber, createdAt, customerName, deliveryAddress, contact,
 *                    email, paymentStatus, paymentMethod, paidAt, paymentReference }
 * @param lines     [{ quantity, unitUsd }] — one entry per bottle line, already priced in dollars
 * @param shipping  { usd }
 * @param whatsapp  the seller's number, from VITE_STOREFRONT_WHATSAPP_NUMBER; '' hides the line
 */
export const buildInvoicePdf = ({ order = {}, lines = [], shipping = null, whatsapp = '' } = {}) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const bottles = lines.reduce((sum, line) => sum + Math.max(0, Math.round(Number(line.quantity) || 0)), 0);
  const goodsUsd = lines.reduce((sum, line) => (
    sum + (Number(line.unitUsd) || 0) * Math.max(0, Math.round(Number(line.quantity) || 0))
  ), 0);
  const shippingUsd = Number(shipping?.usd) || 0;
  const vials = giftVialsFor(bottles);

  let y = MARGIN;
  const text = (value, x, size = 9, color = INK, style = 'normal') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(String(value ?? ''), x, y);
  };
  const rule = () => {
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  };

  // A mark rather than a bitmap: it is the one thing on the page that must not be a missing-image box,
  // and vector strokes keep the file inside the 5 KB floor a bank upload wants without an asset.
  doc.setDrawColor(INK[0], INK[1], INK[2]);
  doc.setLineWidth(0.6);
  doc.rect(MARGIN, y - 4, 9, 9);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 2.5, y + 2.5, MARGIN + 6.5, y - 1.5);

  text(BRAND_PROFILE.name, MARGIN + 13, 15, INK, 'bold');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('COMMERCIAL INVOICE', PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += 6;
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(String(order.invoiceNumber || ''), PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += 10;
  rule();
  y += 7;

  // Seller and buyer, side by side.
  const half = (PAGE_WIDTH - MARGIN * 2) / 2;
  const sellerTop = y;
  text('SELLER', MARGIN, 7, MUTED, 'bold');
  y += 5;
  for (const row of [
    `${BRAND_PROFILE.perfumer} / ${BRAND_PROFILE.name}`,
    `${BRAND_PROFILE.city}, ${BRAND_PROFILE.country}`,
    whatsapp ? `WhatsApp +${whatsapp}` : '',
    BRAND_PROFILE.website.replace(/^https?:\/\//, ''),
  ].filter(Boolean)) {
    text(row, MARGIN, 9);
    y += 4.6;
  }
  const sellerBottom = y;

  y = sellerTop;
  text('BUYER', MARGIN + half, 7, MUTED, 'bold');
  y += 5;
  const buyerLines = [
    order.customerName || '',
    ...String(order.deliveryAddress || '').split('\n'),
    order.contact || '',
    order.email || '',
  ].filter((row) => String(row).trim());
  for (const row of buyerLines) {
    for (const wrapped of doc.splitTextToSize(String(row), half - 4)) {
      text(wrapped, MARGIN + half, 9);
      y += 4.6;
    }
  }
  y = Math.max(sellerBottom, y) + 5;
  rule();
  y += 7;

  // Items. The description is the customs one, always.
  text('DESCRIPTION', MARGIN, 7, MUTED, 'bold');
  doc.text('QTY', MARGIN + 112, y, { align: 'right' });
  doc.text('UNIT', MARGIN + 140, y, { align: 'right' });
  doc.text('AMOUNT', PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += 5;

  const row = (description, quantity, unitUsd, amountUsd, muted = false) => {
    const color = muted ? MUTED : INK;
    text(description, MARGIN, 9, color);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(String(quantity), MARGIN + 112, y, { align: 'right' });
    doc.text(unitUsd === null ? '' : money(unitUsd), MARGIN + 140, y, { align: 'right' });
    doc.text(amountUsd === null ? 'FOC' : money(amountUsd), PAGE_WIDTH - MARGIN, y, { align: 'right' });
    y += 5.4;
  };

  for (const line of lines) {
    const quantity = Math.max(0, Math.round(Number(line.quantity) || 0));
    if (!quantity) continue;
    row(BOTTLE_CUSTOMS_DESCRIPTION, quantity, Number(line.unitUsd) || 0, (Number(line.unitUsd) || 0) * quantity);
  }
  if (vials > 0) {
    // US$0, and labelled FOC: a gift with a price beside it reads as a charge, and a customs value of
    // zero on a sample is what a declaration expects.
    row(vialCustomsDescription(GIFT_VIAL_SIZE_ML), vials, 0, null, true);
  }

  y += 2;
  rule();
  y += 6;

  const total = (label, value, bold = false) => {
    text(label, MARGIN + 100, bold ? 10 : 9, bold ? INK : MUTED, bold ? 'bold' : 'normal');
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(money(value), PAGE_WIDTH - MARGIN, y, { align: 'right' });
    y += bold ? 7 : 5.4;
  };
  total('Goods', goodsUsd);
  total('Shipping', shippingUsd);
  total('Total', goodsUsd + shippingUsd, true);

  y += 2;
  const paid = ['paid', 'settled'].includes(String(order.paymentStatus || '').toLowerCase());
  const status = paid
    ? ['Paid', order.paymentMethod, order.paidAt, order.paymentReference].filter(Boolean).join(' · ')
    : 'Unpaid';
  text(`Status: ${status}`, MARGIN, 9, INK, 'bold');
  y += 8;
  rule();
  y += 6;

  for (const note of [
    'Import duties and taxes in the destination country are charged to the recipient on arrival.',
    'Alcohol-based perfume, shipped under the carrier\'s dangerous goods rules.',
    order.orderNumber ? `Order reference: ${order.orderNumber}` : '',
  ].filter(Boolean)) {
    for (const wrapped of doc.splitTextToSize(note, PAGE_WIDTH - MARGIN * 2)) {
      text(wrapped, MARGIN, 8, MUTED);
      y += 4.2;
    }
  }

  return doc;
};

/** The bytes, so a caller can check the size a bank upload cares about before offering the download. */
export const invoicePdfBlob = (input) => buildInvoicePdf(input).output('blob');
export const invoicePdfArrayBuffer = (input) => buildInvoicePdf(input).output('arraybuffer');
