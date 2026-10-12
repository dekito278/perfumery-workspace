
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { buildFormulaWorkbookExportConfig } from '@/utils/formulaWorkbookExport.js';
import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { calculateTotalCost } from '@/utils/pricingUtils.js';

const ExportFormulaButton = ({ formula, items }) => {
  const handleExport = async () => {
    try {
      const { exportWorkbookPdf } = await import('@/utils/workbookPdfExport.js');
      // The same two helpers the page's own PDF action uses. This button and that action sit on the SAME
      // screen (FormulaDetailPage renders both), so two definitions of "what does this formula weigh and
      // cost" would be two documents of one formula. They happened to agree -- summing each row's stored
      // ingredient_cost lands on the same number as calculateTotalCost, because its dilution branch
      // divides by the same base quantity of 10 and the dilution percentage never reaches the cost -- but
      // agreeing by a coincidence of constants is not the same as having one answer.
      const totalGrams = calculateTotalAmount(items);
      const totalCost = calculateTotalCost(items);

      exportWorkbookPdf(
        buildFormulaWorkbookExportConfig({ formula, items, totalGrams, totalCost }),
        `${formula.code || 'formula'}_${formula.name.replace(/\s+/g, '_')}.pdf`
      );

      toast.success('Formula exported successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to export formula');
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
