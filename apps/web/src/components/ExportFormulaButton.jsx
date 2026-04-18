
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

const ExportFormulaButton = ({ formula, items }) => {
  const handleExport = () => {
    try {
      const pyramidData = items.reduce((acc, item) => {
        const placement = item.pyramid_placement || 'unknown';
        acc[placement] = (acc[placement] || 0) + (item.percentage || 0);
        return acc;
      }, {});

      const totalGrams = items.reduce((sum, item) => sum + (parseFloat(item.gram_amount) || 0), 0);

      const exportData = {
        name: formula.name,
        code: formula.code,
        category: formula.category || null,
        status: formula.status || 'draft',
        version: formula.version || null,
        created: formula.created,
        notes: formula.notes || '',
        total_grams: totalGrams,
        ingredients: items.map(item => ({
          name: item.name,
          type: item.item_type,
          gram_amount: item.gram_amount,
          percentage: item.percentage,
          pyramid_placement: item.pyramid_placement || null
        })),
        pyramid_summary: {
          top: pyramidData.top || 0,
          middle: pyramidData.middle || 0,
          base: pyramidData.base || 0
        }
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${formula.code}_${formula.name.replace(/\s+/g, '_')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Formula exported successfully');
    } catch (error) {
      toast.error('Failed to export formula');
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} className="gap-2 h-9">
      <Download className="w-4 h-4" />
      Export
    </Button>
  );
};

export default ExportFormulaButton;
