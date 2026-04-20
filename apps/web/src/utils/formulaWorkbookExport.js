import {
  formatDate,
  formatGramAmount,
  formatNullable,
  formatPercentage,
  formatStatus,
} from '@/utils/formatting.js';
import { formatPrice, formatPricePerUnit } from '@/utils/pricingUtils.js';

const buildMachineReadableLines = (formula, items, totalGrams) => [
  `${formula.name} Code: ${formula.code || '-'} WS: -`,
  `Price: - RM: ${items.length}`,
  `Date: ${formatDate(formula.created)}`,
  `Total: ${totalGrams.toFixed(4)}`,
  ...items.map((item, index) => {
    const workbookCode = String(item.workbook_code || `RM${String(index + 1).padStart(2, '0')}`)
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 4) || `RM${String(index + 1).padStart(2, '0')}`;
    const materialName = item.dilution_percentage
      ? `${item.name} ${item.dilution_percentage}% in ${item.dilution_solvent_name || 'Unknown solvent'}`
      : item.name;

    return `${index + 1} ${workbookCode}: ${materialName} : ${(Number(item.gram_amount) || 0).toFixed(4)}`;
  }),
];

const buildReferenceSummarySection = (items) => {
  const linkedItems = items.filter((item) => item.reference_profile);
  const advisories = linkedItems.flatMap((item) => item.advisories || []);

  return {
    title: 'Reference Guidance',
    entries: [
      { label: 'Linked profiles', value: String(linkedItems.length) },
      { label: 'IFRA alerts', value: String(advisories.filter((item) => item.type === 'ifra').length) },
      { label: 'Max use alerts', value: String(advisories.filter((item) => item.type === 'max').length) },
      { label: 'Typical use alerts', value: String(advisories.filter((item) => item.type === 'typical').length) },
    ],
    columns: 2,
  };
};

const buildReferenceDetailSection = (items) => {
  const lines = items
    .filter((item) => item.reference_profile)
    .map((item) => {
      const reference = item.reference_profile;
      const advisorySummary = (item.advisories || []).length
        ? `Alerts: ${(item.advisories || []).map((advisory) => advisory.label).join(', ')}.`
        : 'Alerts: none.';

      return [
        item.name,
        reference.reference_code ? `Ref ${reference.reference_code}` : null,
        reference.abc_primary_family ? `Family ${reference.abc_primary_family}` : null,
        item.effectivePercentage !== null && item.effectivePercentage !== undefined
          ? `Effective ${formatPercentage(item.effectivePercentage, 2)}`
          : null,
        reference.use_level_max_percent !== null && reference.use_level_max_percent !== undefined
          ? `Max ${formatPercentage(reference.use_level_max_percent, 2)}`
          : null,
        reference.ifra_limit_percent !== null && reference.ifra_limit_percent !== undefined
          ? `IFRA ${formatPercentage(reference.ifra_limit_percent, 2)}`
          : null,
        advisorySummary,
      ].filter(Boolean).join(' · ');
    });

  if (!lines.length) {
    return {
      title: 'Reference Detail',
      body: 'No workbook or manual reference profiles are linked to this formula yet.',
    };
  }

  return {
    title: 'Reference Detail',
    body: lines.join('\n'),
  };
};

export const buildFormulaWorkbookExportConfig = ({ formula, items, totalGrams, totalCost }) => ({
  typeLabel: 'Formula Sheet',
  title: formula.name,
  subtitle: `Code ${formula.code}`,
  summaryEntries: [
    { label: 'Code', value: formula.code },
    { label: 'By', value: formatNullable(formula.author_name) },
    { label: 'Status', value: formatStatus(formula.status || 'draft') },
    { label: 'Version', value: formatNullable(formula.version) },
    { label: 'Total amount', value: formatGramAmount(totalGrams) },
    { label: 'Material cost', value: formatPrice(totalCost) },
    { label: 'Created', value: formatDate(formula.created) },
    { label: 'Category', value: formatNullable(formula.category) },
  ],
  tableTitle: 'Composition',
  columns: [
    { key: 'material', label: 'Material', width: 54 },
    { key: 'type', label: 'Type', width: 22 },
    { key: 'amount', label: 'Amount', width: 24, align: 'right' },
    { key: 'percentage', label: '%', width: 18, align: 'right' },
    { key: 'dilution', label: 'Dilution', width: 34 },
    { key: 'unitPrice', label: 'Unit price', width: 26, align: 'right' },
    { key: 'cost', label: 'Cost', width: 18, align: 'right' },
  ],
  rows: items.map((item) => ({
    material: item.name,
    type: formatStatus(item.item_type),
    amount: formatGramAmount(item.gram_amount),
    percentage: formatPercentage(item.percentage),
    dilution: item.dilution_percentage ? `${item.dilution_percentage}%${item.dilution_solvent_name ? ` in ${item.dilution_solvent_name}` : ''}` : '-',
    unitPrice: formatPricePerUnit(item.unit_price, item.unit),
    cost: formatPrice(item.ingredient_cost || 0),
  })),
  footerRows: [
    {
      material: 'TOTAL',
      type: '',
      amount: formatGramAmount(totalGrams),
      percentage: '100%',
      dilution: '',
      unitPrice: '',
      cost: formatPrice(totalCost),
    },
  ],
  sections: [
    buildReferenceSummarySection(items),
    buildReferenceDetailSection(items),
  ],
  machineReadableLines: buildMachineReadableLines(formula, items, totalGrams),
  notes: formula.notes || '',
});
