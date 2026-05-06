let pdfRuntimePromise;

const getPdfRuntime = async () => {
  if (!pdfRuntimePromise) {
    pdfRuntimePromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.mjs?url'),
    ]).then(([pdfjsModule, workerModule]) => {
      const { GlobalWorkerOptions, getDocument } = pdfjsModule;
      GlobalWorkerOptions.workerSrc = workerModule.default;
      return { getDocument };
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

const extractPdfLines = async (file) => {
  const { getDocument } = await getPdfRuntime();
  const data = new Uint8Array(await file.arrayBuffer());
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

export const parsePerfumeWorkbookPdf = async (file) => {
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
