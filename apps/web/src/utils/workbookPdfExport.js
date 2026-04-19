import { jsPDF } from 'jspdf';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
const LINE_HEIGHT = 4.3;
const BRAND = {
  ink: [38, 31, 24],
  warm: [173, 126, 72],
  soft: [244, 236, 226],
  border: [214, 203, 189],
  muted: [118, 104, 91],
  row: [251, 248, 243],
};

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

const drawFooter = (doc) => {
  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...BRAND.border);
    doc.line(MARGIN, PAGE_HEIGHT - 10, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text('Perfumer Studio Workbook Export', MARGIN, PAGE_HEIGHT - 5.7);
    doc.text(`Page ${page} / ${totalPages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 5.7, { align: 'right' });
  }
};

const drawHeader = (doc, { typeLabel, title, subtitle }) => {
  let cursorY = MARGIN;

  doc.setFillColor(...BRAND.soft);
  doc.roundedRect(MARGIN, cursorY, CONTENT_WIDTH, 24, 4, 4, 'F');
  doc.setDrawColor(...BRAND.border);
  doc.roundedRect(MARGIN, cursorY, CONTENT_WIDTH, 24, 4, 4, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...BRAND.ink);
  doc.text('Perfumer Workbook', MARGIN + 5, cursorY + 8.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.warm);
  doc.text(asText(typeLabel), MARGIN + 5, cursorY + 14.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...BRAND.ink);
  doc.text(asText(title), MARGIN, cursorY + 34);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text(asText(subtitle), MARGIN, cursorY + 40);
  }

  return subtitle ? cursorY + 47 : cursorY + 39;
};

const drawSectionTitle = (doc, title, cursorY) => {
  const nextY = ensureSpace(doc, cursorY, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...BRAND.ink);
  doc.text(title, MARGIN, nextY);
  doc.setDrawColor(...BRAND.border);
  doc.line(MARGIN, nextY + 2.4, MARGIN + CONTENT_WIDTH, nextY + 2.4);
  return nextY + 8;
};

const drawSummary = (doc, entries, cursorY, columns = 2) => {
  const gap = 4;
  const rowHeight = 13;
  const columnWidth = (CONTENT_WIDTH - (gap * (columns - 1))) / columns;
  let y = cursorY;

  for (let index = 0; index < entries.length; index += columns) {
    y = ensureSpace(doc, y, rowHeight + 2);
    const rowEntries = entries.slice(index, index + columns);

    rowEntries.forEach((entry, entryIndex) => {
      const x = MARGIN + (entryIndex * (columnWidth + gap));
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...BRAND.border);
      doc.roundedRect(x, y, columnWidth, rowHeight, 2.5, 2.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(...BRAND.muted);
      doc.text(asText(entry.label).toUpperCase(), x + 3, y + 4.7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.4);
      doc.setTextColor(...BRAND.ink);
      const valueLines = doc.splitTextToSize(asText(entry.value), columnWidth - 6);
      doc.text(valueLines, x + 3, y + 9.4);
    });

    y += rowHeight + 2.5;
  }

  return y + 1;
};

const drawTable = (doc, columns, rows, cursorY, footerRows = []) => {
  const totalRequestedWidth = columns.reduce((sum, column) => sum + Number(column.width || 0), 0) || CONTENT_WIDTH;
  const normalizedColumns = columns.map((column) => ({
    ...column,
    computedWidth: (Number(column.width || 0) / totalRequestedWidth) * CONTENT_WIDTH,
  }));
  const headerHeight = 8;
  const padding = 2;
  let y = ensureSpace(doc, cursorY, headerHeight + 8);

  const drawHeaderRow = () => {
    doc.setFillColor(...BRAND.ink);
    doc.rect(MARGIN, y, CONTENT_WIDTH, headerHeight, 'F');
    doc.setTextColor(255, 255, 255);

    let x = MARGIN;
    normalizedColumns.forEach((column) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      const align = column.align === 'right' ? 'right' : 'left';
      const textX = align === 'right' ? x + column.computedWidth - padding : x + padding;
      doc.text(column.label, textX, y + 5.2, { align });
      x += column.computedWidth;
    });

    doc.setTextColor(...BRAND.ink);
    y += headerHeight;
  };

  const drawRow = (row, style = 'plain') => {
    const cellLines = normalizedColumns.map((column) => (
      doc.splitTextToSize(asText(row[column.key]), Math.max(column.computedWidth - (padding * 2), 10))
    ));
    const rowHeight = Math.max(8, ...cellLines.map((lines) => (lines.length * LINE_HEIGHT) + 3));

    if (y + rowHeight > PAGE_HEIGHT - MARGIN - 12) {
      doc.addPage();
      y = MARGIN;
      drawHeaderRow();
    }

    if (style === 'body') {
      doc.setFillColor(...BRAND.row);
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, 'F');
    }

    if (style === 'footer') {
      doc.setFillColor(...BRAND.soft);
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, 'F');
    }

    let x = MARGIN;
    normalizedColumns.forEach((column, columnIndex) => {
      doc.setDrawColor(...BRAND.border);
      doc.rect(x, y, column.computedWidth, rowHeight);
      doc.setFont('helvetica', style === 'footer' ? 'bold' : 'normal');
      doc.setFontSize(8.4);
      doc.setTextColor(...BRAND.ink);
      const align = column.align === 'right' ? 'right' : 'left';
      const textX = align === 'right' ? x + column.computedWidth - padding : x + padding;
      doc.text(cellLines[columnIndex], textX, y + 4.6, { align });
      x += column.computedWidth;
    });

    y += rowHeight;
  };

  drawHeaderRow();
  rows.forEach((row, rowIndex) => drawRow(row, rowIndex % 2 === 0 ? 'body' : 'plain'));
  footerRows.forEach((row) => drawRow(row, 'footer'));

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

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BRAND.border);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, boxHeight, 2.5, 2.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.3);
  doc.setTextColor(...BRAND.ink);
  doc.text(lines, MARGIN + 3, y + 5);
  return y + boxHeight + 4;
};

const drawTextSection = (doc, section, cursorY) => {
  let y = drawSectionTitle(doc, section.title, cursorY);
  const entries = Array.isArray(section.entries) ? section.entries : [];

  if (entries.length) {
    return drawSummary(doc, entries, y, section.columns || 2);
  }

  const lines = doc.splitTextToSize(asText(section.body), CONTENT_WIDTH - 6);
  const boxHeight = Math.max(16, (lines.length * LINE_HEIGHT) + 6);
  y = ensureSpace(doc, y, boxHeight + 2);
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BRAND.border);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, boxHeight, 2.5, 2.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.3);
  doc.setTextColor(...BRAND.ink);
  doc.text(lines, MARGIN + 3, y + 5);
  return y + boxHeight + 4;
};

const buildWorkbookPdf = ({
  typeLabel,
  title,
  subtitle,
  summaryEntries = [],
  summaryColumns = 2,
  tableTitle,
  columns = [],
  rows = [],
  footerRows = [],
  sections = [],
  notes,
}) => {
  const doc = createDocument();
  let cursorY = drawHeader(doc, { typeLabel, title, subtitle });

  if (summaryEntries.length) {
    cursorY = drawSectionTitle(doc, 'Summary', cursorY);
    cursorY = drawSummary(doc, summaryEntries, cursorY, summaryColumns);
  }

  if (tableTitle && columns.length) {
    cursorY = drawSectionTitle(doc, tableTitle, cursorY);
    cursorY = drawTable(doc, columns, rows, cursorY, footerRows);
  }

  sections.forEach((section) => {
    cursorY = drawTextSection(doc, section, cursorY);
  });

  drawNotes(doc, notes, cursorY);
  drawFooter(doc);
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
