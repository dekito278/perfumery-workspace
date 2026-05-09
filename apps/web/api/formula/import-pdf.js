import { Buffer } from 'node:buffer';
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const jsonResponse = (response, status, body) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
};

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

let pdfRuntimePromise;

const ensurePdfDomMatrix = () => {
  if (typeof globalThis.DOMMatrix !== 'undefined') {
    return;
  }

  class PdfDOMMatrix {
    constructor(init) {
      const values = Array.isArray(init) || ArrayBuffer.isView(init) ? Array.from(init) : null;
      this.a = Number(values?.[0] ?? 1);
      this.b = Number(values?.[1] ?? 0);
      this.c = Number(values?.[2] ?? 0);
      this.d = Number(values?.[3] ?? 1);
      this.e = Number(values?.[4] ?? 0);
      this.f = Number(values?.[5] ?? 0);
      this.m11 = this.a;
      this.m12 = this.b;
      this.m21 = this.c;
      this.m22 = this.d;
      this.m41 = this.e;
      this.m42 = this.f;
      this.is2D = true;
    }

    multiplySelf() {
      return this;
    }

    preMultiplySelf() {
      return this;
    }

    translate() {
      return this;
    }

    scale() {
      return this;
    }

    invertSelf() {
      return this;
    }
  }

  globalThis.DOMMatrix = PdfDOMMatrix;
  globalThis.DOMMatrixReadOnly = PdfDOMMatrix;
};

const getPdfRuntime = async () => {
  if (!pdfRuntimePromise) {
    ensurePdfDomMatrix();
    globalThis.pdfjsWorker = { WorkerMessageHandler };
    pdfRuntimePromise = import('pdfjs-dist/legacy/build/pdf.mjs')
      .then((pdfjsModule) => ({ getDocument: pdfjsModule.getDocument }))
      .catch((error) => {
        pdfRuntimePromise = null;
        throw error;
      });
  }

  return pdfRuntimePromise;
};

const normalizeFragment = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeDecorativeSpacing = (line) => {
  if (/^(?:[\w*']\s+){2,}[\w*']$/.test(line)) {
    return line.replace(/\s+/g, '');
  }

  return line;
};

const extractPdfLines = async (buffer) => {
  const { getDocument } = await getPdfRuntime();
  const pdf = await getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const lines = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    let currentLine = '';

    for (const item of textContent.items) {
      const fragment = normalizeFragment(item.str);

      if (fragment) {
        currentLine += currentLine ? ` ${fragment}` : fragment;
      }

      if (item.hasEOL) {
        const normalizedLine = normalizeDecorativeSpacing(normalizeFragment(currentLine));
        if (normalizedLine) {
          lines.push(normalizedLine);
        }
        currentLine = '';
      }
    }

    const trailingLine = normalizeDecorativeSpacing(normalizeFragment(currentLine));
    if (trailingLine) {
      lines.push(trailingLine);
    }
  }

  return lines;
};

const normalizeExtractedLines = (lines) =>
  lines.filter((line) => {
    if (!line) {
      return false;
    }

    if (/^[=.\-]{8,}$/.test(line)) {
      return false;
    }

    if (/^\*+\s*\*+\s*\*+$/.test(line)) {
      return false;
    }

    if (/^ThePerfumer'?sWorkbook$/i.test(line.replace(/\s+/g, ''))) {
      return false;
    }

    return true;
  });

const parseHeader = (lines) => {
  const headerLine = lines.find((line) => line.includes('Code:')) || '';
  const metaLine = lines.find((line) => line.includes('Price:')) || '';
  const totalLine = lines.find((line) => line.startsWith('Total:')) || '';
  const dateLine = lines.find((line) => line.startsWith('Date:')) || '';

  return {
    formulaName: headerLine.replace(/\s+Code:.*$/, '').trim() || null,
    workbookFormulaCode: headerLine.match(/Code:\s*([^\s]+)/)?.[1] || null,
    workbookSheet: headerLine.match(/WS:\s*([^\s]+)/)?.[1] || null,
    pricePerGram: metaLine.match(/Price:\s*([0-9.]+\/g)/)?.[1] || null,
    rawMaterialSummary: metaLine.match(/RM:\s*([^\s]+)/)?.[1] || null,
    formulaDate: dateLine.replace(/^Date:\s*/, '').trim() || null,
    totalFromPdf: totalLine.match(/Total:\s*([0-9.]+)/)?.[1] || null,
  };
};

const parseItems = (lines) =>
  lines
    .map((line) => line.match(/^(\d+)\s+([A-Za-z0-9_-]{1,16}):\s*(.+?)\s*:\s*([0-9]+(?:[.,][0-9]+)?)$/))
    .filter(Boolean)
    .map((match) => ({
      lineNumber: Number.parseInt(match[1], 10),
      workbookCode: match[2],
      materialName: match[3].trim(),
      grams: Number.parseFloat(match[4].replace(',', '.')),
    }));

const parsePerfumeWorkbookPdfBuffer = async ({ buffer, fileName }) => {
  const extractedLines = await extractPdfLines(buffer);
  const lines = normalizeExtractedLines(extractedLines);
  const header = parseHeader(lines);
  const items = parseItems(lines);

  if (!items.length) {
    throw new Error('No formula items were detected in this PDF. Make sure it is a Perfume Workbook export.');
  }

  const totalGrams = items.reduce((sum, item) => sum + item.grams, 0);

  return {
    ...header,
    fileName,
    rawText: lines.join('\n'),
    totalGrams,
    items: items.map((item) => ({
      ...item,
      percentage: totalGrams > 0 ? Number(((item.grams / totalGrams) * 100).toFixed(3)) : 0,
    })),
  };
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return jsonResponse(response, 405, { message: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(await readBody(request));
    const fileName = String(body.fileName || 'formula.pdf').trim();
    const dataBase64 = String(body.dataBase64 || '').replace(/^data:application\/pdf;base64,/, '');

    if (!dataBase64) {
      return jsonResponse(response, 400, { message: 'PDF data is required' });
    }

    const buffer = Buffer.from(dataBase64, 'base64');
    if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) {
      return jsonResponse(response, 413, { message: 'PDF is empty or too large for mobile import fallback' });
    }

    const parseResult = await parsePerfumeWorkbookPdfBuffer({ buffer, fileName });
    return jsonResponse(response, 200, { parseResult });
  } catch (error) {
    return jsonResponse(response, 500, {
      message: error.message || 'Failed to parse PDF on server',
    });
  }
}
