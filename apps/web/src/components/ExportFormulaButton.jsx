
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { buildFormulaWorkbookExportConfig } from '@/utils/formulaWorkbookExport.js';

const ExportFormulaButton = ({ formula, items }) => {
  const handleExport = async () => {
    try {
      const { exportWorkbookPdf } = await import('@/utils/workbookPdfExport.js');
      const totalGrams = items.reduce((sum, item) => sum + (parseFloat(item.gram_amount) || 0), 0);
      const totalCost = items.reduce((sum, item) => sum + Number(item.ingredient_cost || 0), 0);

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
