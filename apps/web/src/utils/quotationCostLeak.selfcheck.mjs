// `node src/utils/quotationCostLeak.selfcheck.mjs`
//
// The brand quotation is the PDF that goes to the client. It used to print our cost structure next to the
// price we were asking: COGS per quote and per litre in the summary, "30% markup" as the pricing mode,
// COGS again in the total row, and a whole Quote Breakdown section with formula and solvent COGS per ml,
// handling, overhead, total COGS and the quoted margin. A buyer reading it knows exactly how far we can
// be pushed before we walk away.
//
// The internal costing export is where those numbers belong, so this checks both directions: gone from
// the quotation, still present in the costing sheet.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const shim = join(here, `.quotation.selfcheck.${process.pid}.mjs`);
writeFileSync(shim, `${readFileSync(join(here, 'productionCostingExports.js'), 'utf8')
  .replace(/^import .*?;$/gm, '')
  .replace(/^export /gm, '')}
export { buildProductionQuotationExportConfig, buildProductionCostExportConfig };
`);

globalThis.formatPrice = (v) => `Rp ${Math.round(Number(v) || 0).toLocaleString('id-ID')}`;
globalThis.formatCurrency = globalThis.formatPrice;
globalThis.formatPercentage = (v, d = 1) => `${(Number(v) || 0).toFixed(d)}%`;
globalThis.formatQuantity = (v) => String(Math.round(Number(v) || 0));
globalThis.formatPricePerUnit = (v, unit) => `Rp ${Math.round(Number(v) || 0)} / ${unit || 'ml'}`;

const { buildProductionQuotationExportConfig, buildProductionCostExportConfig } = await import(shim);
unlinkSync(shim);

// Values chosen so each one is unmistakable if it shows up anywhere in the document.
const COGS_TOTAL = 2500000;
const COGS_PER_LITRE = 500000;
const FORMULA_COGS_PER_ML = 412;
const OVERHEAD_PER_LITRE = 40000;
const MARGIN_PERCENT = 23.1;
const MARKUP_PERCENT = 30;

const bulkComputed = {
  concentration: 20,
  formulaCogsPerMl: FORMULA_COGS_PER_ML,
  solventCogsPerMl: 38,
  handlingCostPerLiter: 25000,
  overheadPerLiter: OVERHEAD_PER_LITRE,
  allInBulkCogsPerLiter: COGS_PER_LITRE,
  materialCogsPerMl: 450,
  rows: [],
};
const selectedQuotationRow = {
  id: 'q1',
  volumeValue: '5',
  volumeUnit: 'liter',
  volumeMl: 5000,
  sellPrice: 3250000,
  totalCogs: COGS_TOTAL,
  cogsPerLiter: COGS_PER_LITRE,
  markupPercent: MARKUP_PERCENT,
  margin: MARGIN_PERCENT,
  label: 'Quote 1',
};

const quotation = buildProductionQuotationExportConfig({
  bulkComputed,
  parseNumberInput: (v) => Number(v) || 0,
  quotationInputs: { validDays: '14', quotationNumber: 'Q-1', brandName: 'Rania Beauty Group', attentionName: 'Ibu Rania', notes: '', terms: '' },
  selectedFormula: { name: 'Youzu 08', code: 'YZ-08' },
  selectedQuotationRow,
  selectedSolvent: { name: 'Ethanol 96%' },
});

const printed = JSON.stringify(quotation);
const leaks = [
  ['total COGS', String(COGS_TOTAL)],
  ['COGS per litre', String(COGS_PER_LITRE)],
  ['formula COGS per ml', String(FORMULA_COGS_PER_ML)],
  ['overhead per litre', String(OVERHEAD_PER_LITRE)],
  ['quoted margin', String(MARGIN_PERCENT)],
  ['markup percent', `${MARKUP_PERCENT}%`],
  ['the word COGS', 'COGS'],
  ['the word margin', 'margin'],
  ['the word markup', 'markup'],
].filter(([, needle]) => printed.includes(needle)).map(([what]) => what);

assert.deepEqual(
  leaks,
  [],
  `the brand quotation carries our cost structure: ${leaks.join(', ')}. That document is sent to the `
  + 'client — only the price we are asking belongs in it. The internal costing export keeps these.',
);

// The other direction: the costing sheet is the owner's, and must still show the numbers.
const costing = JSON.stringify(buildProductionCostExportConfig({
  bulkComputed,
  retailChampion: null,
  retailComputed: { costPerBottle: 90000, cogsPerMl: 3000, totalProductionCost: 900000, bottleCount: 10, scenarioResults: [], packagingLineItems: { unitItems: [], batchItems: [] }, totalMaterialCost: 1, totalPackagingCost: 1, totalBatchOverhead: 1, targetFillVolume: 1000, requiredProductionVolume: 1030, formulaVolumeNeeded: 200, solventVolumeNeeded: 800, unitBottleSize: 30, remainingVolume: 0, materialCostPerBottle: 1, perBottlePackagingCost: 1, lossPercent: 3, concentration: 20 },
  formulaProfile: { items: [], totalGrams: 0, totalMaterialCost: 0, costPerMl: 0 },
  selectedFormula: { name: 'Youzu 08', code: 'YZ-08' },
  selectedSolvent: { name: 'Ethanol 96%' },
  retailInputs: {},
  bulkInputs: {},
}));
assert.ok(costing.includes('COGS'), 'the internal costing export must still report COGS — that is its job');

console.log(`quotationCostLeak selfcheck OK (client quotation carries price only, costing sheet keeps its numbers)`);
