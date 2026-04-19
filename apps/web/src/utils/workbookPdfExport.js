import { jsPDF } from 'jspdf';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
const LINE_HEIGHT = 4.4;

const asText = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return String(value);
};

const createDocument = () => new jsPDF({ unit: 'mm', format: 'a4' });

const ensureSpace = (doc, cursorY, requiredHeight = 12) => {
  if (cursorY + requiredHeight <= PAGE_HEIGHT - MARGIN) {
    return cursorY;
  }

  doc.addPage();
  return MARGIN;
};

const drawHeader = (doc, { typeLabel, title, subtitle }) => {
  let cursorY = MARGIN;

  doc.setFillColor(245, 247, 250);
  doc.roundedRect(MARGIN, cursorY, CONTENT_WIDTH, 22, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Perfumer Workbook', MARGIN + 5, cursorY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(asText(typeLabel), MARGIN + 5, cursorY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(asText(title), MARGIN, cursorY + 31);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(asText(subtitle), MARGIN, cursorY + 37);
  }

  return subtitle ? cursorY + 44 : cursorY + 38;
};

const drawSectionTitle = (doc, title, cursorY) => {
  const nextY = ensureSpace(doc, cursorY, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text(title, MARGIN, nextY);
  doc.setDrawColor(200, 205, 212);
  doc.line(MARGIN, nextY + 2, MARGIN + CONTENT_WIDTH, nextY + 2);
  return nextY + 8;
};

const drawSummary = (doc, entries, cursorY) => {
  const columnWidth = (CONTENT_WIDTH - 4) / 2;
  const rowHeight = 12;
  let y = cursorY;

  for (let index = 0; index < entries.length; index += 2) {
    y = ensureSpace(doc, y, rowHeight + 2);
    const rowEntries = entries.slice(index, index + 2);

    rowEntries.forEach((entry, entryIndex) => {
      const x = MARGIN + (entryIndex * (columnWidth + 4));
      doc.setFillColor(250, 250, 251);
      doc.roundedRect(x, y, columnWidth, rowHeight, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(asText(entry.label), x + 3, y + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(asText(entry.value), x + 3, y + 9.2);
    });

    y += rowHeight + 2;
  }

  return y + 1;
};

const drawTable = (doc, columns, rows, cursorY) => {
  const headerHeight = 8;
  const padding = 2;
  let y = ensureSpace(doc, cursorY, headerHeight + 8);

  const drawHeaderRow = () => {
    doc.setFillColor(29, 32, 40);
    doc.rect(MARGIN, y, CONTENT_WIDTH, headerHeight, 'F');
    doc.setTextColor(255, 255, 255);

    let x = MARGIN;
    columns.forEach((column) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(column.label, x + padding, y + 5.2);
      x += column.width;
    });

    doc.setTextColor(0, 0, 0);
    y += headerHeight;
  };

  drawHeaderRow();

  rows.forEach((row, rowIndex) => {
    const cellLines = columns.map((column) => (
      doc.splitTextToSize(asText(row[column.key]), Math.max(column.width - (padding * 2), 10))
    ));
    const rowHeight = Math.max(8, ...cellLines.map((lines) => (lines.length * LINE_HEIGHT) + 3));

    if (y + rowHeight > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
      drawHeaderRow();
    }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(250, 250, 251);
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, 'F');
    }

    let x = MARGIN;
    columns.forEach((column, columnIndex) => {
      doc.setDrawColor(228, 231, 236);
      doc.rect(x, y, column.width, rowHeight);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(cellLines[columnIndex], x + padding, y + 4.6);
      x += column.width;
    });

    y += rowHeight;
  });

  return y + 4;
};

const drawNotes = (doc, notes, cursorY) => {
  if (!notes) {
    return cursorY;
  }

  let y = drawSectionTitle(doc, 'Notes', cursorY);
  const lines = doc.splitTextToSize(asText(notes), CONTENT_WIDTH - 6);
  const boxHeight = Math.max(16, (lines.length * LINE_HEIGHT) + 6);
  y = ensureSpace(doc, y, boxHeight + 2);

  doc.setFillColor(250, 250, 251);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, boxHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(lines, MARGIN + 3, y + 5);
  return y + boxHeight + 4;
};

const buildWorkbookPdf = ({ typeLabel, title, subtitle, summaryEntries, tableTitle, columns, rows, notes }) => {
  const doc = createDocument();
  let cursorY = drawHeader(doc, { typeLabel, title, subtitle });
  cursorY = drawSectionTitle(doc, 'Summary', cursorY);
  cursorY = drawSummary(doc, summaryEntries, cursorY);
  cursorY = drawSectionTitle(doc, tableTitle, cursorY);
  cursorY = drawTable(doc, columns, rows, cursorY);
  drawNotes(doc, notes, cursorY);
  return doc;
};

export const printWorkbookPdf = (config) => {
  const doc = buildWorkbookPdf(config);
  doc.autoPrint();
  const url = doc.output('bloburl');
  const printWindow = window.open(url, '_blank', 'noopener,noreferrer');

  if (!printWindow) {
    doc.save('workbook-print.pdf');
  }
};

export const exportWorkbookPdf = (config, filename) => {
  const doc = buildWorkbookPdf(config);
  doc.save(filename);
};
