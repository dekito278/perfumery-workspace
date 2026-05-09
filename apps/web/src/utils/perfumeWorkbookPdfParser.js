let pdfRuntimePromise;

const ensurePdfDomMatrix = () => {
  if (typeof globalThis.DOMMatrix !== 'undefined') {
    return;
  }

  if (typeof globalThis.WebKitCSSMatrix !== 'undefined') {
    globalThis.DOMMatrix = globalThis.WebKitCSSMatrix;
    globalThis.DOMMatrixReadOnly = globalThis.WebKitCSSMatrix;
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

const shouldPreferServerPdfParsing = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(userAgent) || window.navigator.standalone === true;
};

const getPdfRuntime = async () => {
  if (!pdfRuntimePromise) {
    ensurePdfDomMatrix();
    pdfRuntimePromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.mjs?url'),
    ]).then(([pdfjsModule, workerModule]) => {
      const { GlobalWorkerOptions, getDocument } = pdfjsModule;
      GlobalWorkerOptions.workerSrc = workerModule.default;
      return { getDocument };
    }).catch((error) => {
      pdfRuntimePromise = null;
      throw error;
    });
  }

  return pdfRuntimePromise;
};

const readFileArrayBuffer = (file) => {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }

  if (typeof FileReader === 'undefined') {
    throw new Error('This mobile browser cannot read PDF files locally because FileReader is unavailable.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Failed to read PDF file on this device.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsArrayBuffer(file);
  });
};

const arrayBufferToBase64 = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
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

const extractPdfLines = async (file) => {
  const { getDocument } = await getPdfRuntime();
  const data = new Uint8Array(await readFileArrayBuffer(file));
  const pdf = await getDocument({
    data,
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

const parsePerfumeWorkbookPdfLocally = async (file) => {
  const extractedLines = await extractPdfLines(file);
  const lines = normalizeExtractedLines(extractedLines);
  const header = parseHeader(lines);
  const items = parseItems(lines);

  if (!items.length) {
    throw new Error('No formula items were detected in this PDF. Make sure it is a Perfume Workbook export.');
  }

  const totalGrams = items.reduce((sum, item) => sum + item.grams, 0);

  return {
    ...header,
    fileName: file.name,
    rawText: lines.join('\n'),
    totalGrams,
    items: items.map((item) => ({
      ...item,
      percentage: totalGrams > 0 ? Number(((item.grams / totalGrams) * 100).toFixed(3)) : 0,
    })),
  };
};

const parsePerfumeWorkbookPdfOnServer = async (file, localError) => {
  const dataBase64 = arrayBufferToBase64(await readFileArrayBuffer(file));
  const response = await fetch('/api/formula/import-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: file.name,
      dataBase64,
      localError: localError?.message || String(localError || ''),
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || 'Failed to parse PDF on server');
  }

  if (!payload.parseResult?.items?.length) {
    throw new Error('No formula items were detected in this PDF.');
  }

  return payload.parseResult;
};

export const parsePerfumeWorkbookPdf = async (file) => {
  if (shouldPreferServerPdfParsing()) {
    try {
      return await parsePerfumeWorkbookPdfOnServer(file, new Error('iOS server-first PDF parsing'));
    } catch (serverError) {
      try {
        return await parsePerfumeWorkbookPdfLocally(file);
      } catch (localError) {
        throw serverError?.message ? serverError : localError;
      }
    }
  }

  try {
    return await parsePerfumeWorkbookPdfLocally(file);
  } catch (localError) {
    return parsePerfumeWorkbookPdfOnServer(file, localError);
  }
};
