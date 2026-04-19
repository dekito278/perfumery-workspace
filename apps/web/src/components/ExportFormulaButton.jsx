
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatGramAmount, formatNullable, formatPercentage, formatStatus } from '@/utils/formatting.js';
import { formatPrice, formatPricePerUnit } from '@/utils/pricingUtils.js';

const ExportFormulaButton = ({ formula, items }) => {
  const handleExport = async () => {
    try {
      const { exportWorkbookPdf } = await import('@/utils/workbookPdfExport.js');
      const totalGrams = items.reduce((sum, item) => sum + (parseFloat(item.gram_amount) || 0), 0);
      const totalCost = items.reduce((sum, item) => sum + Number(item.ingredient_cost || 0), 0);

      exportWorkbookPdf(
        {
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
            { key: 'amount', label: 'Amount', width: 22 },
            { key: 'percentage', label: '%', width: 18 },
            { key: 'dilution', label: 'Dilution', width: 34 },
            { key: 'unitPrice', label: 'Unit price', width: 28 },
            { key: 'cost', label: 'Cost', width: 22 },
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
          notes: formula.notes || '',
        },
        `${formula.code || 'formula'}_${formula.name.replace(/\s+/g, '_')}.pdf`
      );

      toast.success('Formula exported successfully');
    } catch (error) {
      toast.error('Failed to export formula');
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} className="gap-2 h-9">
      <Download className="w-4 h-4" />
      Export PDF
    </Button>
  );
};

export default ExportFormulaButton;
