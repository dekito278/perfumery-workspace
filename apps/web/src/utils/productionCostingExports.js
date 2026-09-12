import { formatCurrency, formatPercentage, formatQuantity } from '@/utils/formatting.js';
import { formatPrice, formatPricePerUnit } from '@/utils/pricingUtils.js';

const buildPackagingRows = (retailComputed) => ([
  ...retailComputed.packagingLineItems.unitItems.map((item) => ({
    item: item.label,
    quantity: `${item.quantity} bottles`,
    unitCost: formatCurrency(item.unitCost),
    totalCost: formatPrice(item.totalCost),
    notes: 'Per bottle component',
  })),
  ...retailComputed.packagingLineItems.batchItems.map((item) => ({
    item: item.label,
    quantity: '1 batch',
    unitCost: formatCurrency(item.unitCost),
    totalCost: formatPrice(item.totalCost),
    notes: 'Batch-level overhead',
  })),
]);

const buildRetailScenarioEntries = (retailComputed) => retailComputed.scenarioResults.flatMap((scenario) => ([
  { label: `${scenario.label || 'Manual retail'} sell price`, value: formatCurrency(scenario.salePrice) },
  { label: `${scenario.label || 'Manual retail'} net profit / bottle`, value: formatCurrency(scenario.profitPerBottle) },
  { label: `${scenario.label || 'Manual retail'} batch profit`, value: formatPrice(scenario.batchProfit) },
  { label: `${scenario.label || 'Manual retail'} net margin`, value: formatPercentage(scenario.profitMargin) },
]));

const buildBulkScenarioEntries = (bulkComputed) => bulkComputed.rows.flatMap((row) => ([
  { label: `${row.label} COGS`, value: formatPrice(row.totalCogs) },
  { label: `${row.label} sell price`, value: formatPrice(row.sellPrice) },
  { label: `${row.label} profit`, value: formatPrice(row.profit) },
  { label: `${row.label} margin`, value: formatPercentage(row.margin) },
]));

export const buildProductionCostExportConfig = ({
  bulkComputed,
  formulaProfile,
  retailComputed,
  selectedFormula,
  selectedSolvent,
}) => ({
  typeLabel: 'Production Cost Sheet',
  title: selectedFormula.name,
  subtitle: 'Retail bottle costing and bulk brand pricing',
  summaryEntries: [
    { label: 'Formula', value: `${selectedFormula.name} (${selectedFormula.code})` },
    { label: 'Solvent', value: selectedSolvent?.name || '-' },
    { label: 'Retail target fill', value: `${formatQuantity(retailComputed.targetFillVolume)} ml` },
    { label: 'Concentration', value: formatPercentage(retailComputed.concentration) },
    { label: 'Retail COGS / bottle', value: formatCurrency(retailComputed.costPerBottle) },
    { label: 'Bulk COGS / liter', value: formatCurrency(bulkComputed.allInBulkCogsPerLiter) },
  ],
  tableTitle: 'Retail Material, Packaging, And Overhead Breakdown',
  columns: [
    { key: 'item', label: 'Item', width: 58 },
    { key: 'quantity', label: 'Quantity', width: 28, align: 'right' },
    { key: 'unitCost', label: 'Unit cost', width: 28, align: 'right' },
    { key: 'totalCost', label: 'Total cost', width: 28, align: 'right' },
    { key: 'notes', label: 'Notes', width: 48 },
  ],
  rows: [
    {
      item: 'Formula concentrate',
      quantity: `${formatQuantity(retailComputed.formulaVolumeNeeded)} ml`,
      unitCost: formatCurrency(formulaProfile.costPerMl),
      totalCost: formatPrice(retailComputed.formulaMaterialCost),
      notes: 'Based on saved raw material prices',
    },
    {
      item: selectedSolvent?.name || 'Batch solvent',
      quantity: `${formatQuantity(retailComputed.solventVolumeNeeded)} ml`,
      unitCost: selectedSolvent ? formatPricePerUnit(selectedSolvent.cost_per_unit, selectedSolvent.unit) : '-',
      totalCost: formatPrice(retailComputed.solventMaterialCost),
      notes: 'Main solvent for this batch',
    },
    ...buildPackagingRows(retailComputed),
  ],
  footerRows: [
    {
      item: 'TOTAL RETAIL PRODUCTION COST',
      quantity: '',
      unitCost: '',
      totalCost: formatPrice(retailComputed.totalProductionCost),
      notes: `${formatCurrency(retailComputed.costPerBottle)} per bottle`,
    },
  ],
  sections: [
    {
      title: 'Retail Scenario Details',
      entries: [
        { label: 'Formula needed', value: `${formatQuantity(retailComputed.formulaVolumeNeeded)} ml` },
        { label: 'Solvent needed', value: `${formatQuantity(retailComputed.solventVolumeNeeded)} ml` },
        { label: 'Packaging / bottle', value: formatCurrency(retailComputed.perBottlePackagingCost) },
        { label: 'Batch overhead', value: formatPrice(retailComputed.totalBatchOverhead) },
        { label: 'Material cost / bottle', value: formatCurrency(retailComputed.materialCostPerBottle) },
        { label: 'COGS / ml', value: formatCurrency(retailComputed.cogsPerMl) },
      ],
      columns: 2,
    },
    {
      title: 'Retail Selling Price Scenarios',
      entries: buildRetailScenarioEntries(retailComputed),
      columns: 2,
    },
    {
      title: 'Bulk Brand Pricing',
      entries: [
        { label: 'Bulk material COGS / ml', value: formatCurrency(bulkComputed.materialCogsPerMl) },
        { label: 'Bulk COGS / liter', value: formatCurrency(bulkComputed.allInBulkCogsPerLiter) },
        ...buildBulkScenarioEntries(bulkComputed),
      ],
      columns: 2,
    },
  ],
});

export const buildProductionQuotationExportConfig = ({
  bulkComputed,
  parseNumberInput,
  quotationInputs,
  selectedFormula,
  selectedQuotationRow,
  selectedSolvent,
}) => {
  const validDays = Math.max(parseNumberInput(quotationInputs.validDays), 0);
  // This document is sent to the brand. It used to carry our COGS per ml and per litre, total COGS,
  // handling and overhead, the markup percentage and the quoted margin — everything a buyer needs to know
  // exactly how far we can be pushed. The brand needs one number, the total; the rest stays on the
  // internal costing export, which is the one that should have it.
  return {
    // The internal exports keep the workbook heading; a document going to a client should not carry the
    // name of the tool that made it.
    brandLine: 'SOLIVAGANT',
    typeLabel: 'Brand Quotation',
    title: quotationInputs.brandName || selectedFormula.name,
    subtitle: 'Quotation for bulk perfume formula supply',
    summaryEntries: [
      { label: 'Quotation no', value: quotationInputs.quotationNumber || '-' },
      { label: 'Brand', value: quotationInputs.brandName || '-' },
      { label: 'Attention', value: quotationInputs.attentionName || '-' },
      { label: 'Valid for', value: validDays > 0 ? `${validDays} days` : '-' },
      { label: 'Formula', value: `${selectedFormula.name} (${selectedFormula.code})` },
      { label: 'Solvent', value: selectedSolvent?.name || '-' },
      { label: 'Concentration', value: formatPercentage(bulkComputed.concentration) },
      { label: 'Volume', value: `${selectedQuotationRow.volumeValue} ${selectedQuotationRow.volumeUnit}` },
      { label: 'Total harga', value: formatPrice(selectedQuotationRow.sellPrice) },
    ],
    tableTitle: 'Quotation Details',
    columns: [
      { key: 'item', label: 'Item', width: 70 },
      { key: 'value', label: 'Value', width: 70 },
      { key: 'notes', label: 'Notes', width: 56 },
    ],
    rows: [
      {
        item: 'Formula',
        value: `${selectedFormula.name} (${selectedFormula.code})`,
        notes: 'Perfume concentrate formula',
      },
      {
        item: 'Blend concentration',
        value: formatPercentage(bulkComputed.concentration),
        notes: 'Formula ratio in finished juice',
      },
      {
        item: 'Base solvent',
        value: selectedSolvent?.name || '-',
        notes: 'Main solvent used for this quote',
      },
      {
        item: 'Quote volume',
        value: `${selectedQuotationRow.volumeValue} ${selectedQuotationRow.volumeUnit}`,
        notes: `${formatQuantity(selectedQuotationRow.volumeMl)} ml equivalent`,
      },
    ],
    footerRows: [
      {
        item: 'TOTAL QUOTATION',
        value: formatPrice(selectedQuotationRow.sellPrice),
        notes: validDays > 0 ? `Berlaku ${validDays} hari sejak tanggal quotation` : 'Harga berlaku sesuai kesepakatan',
      },
    ],
    sections: [
      {
        title: 'Commercial Notes',
        body: quotationInputs.notes || 'No additional notes.',
      },
      {
        title: 'Terms',
        body: quotationInputs.terms || 'No additional terms.',
      },
    ],
  };
};
