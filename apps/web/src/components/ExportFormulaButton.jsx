
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

const getCompositionLabel = (item) => {
  if (item.item_type === 'accord') {
    return item.category || 'Accord';
  }

  if (item.item_type === 'solvent') {
    return item.name || 'Solvent';
  }

  return item.component_family || item.scent_family || item.category || 'Material';
};

const ExportFormulaButton = ({ formula, items }) => {
  const handleExport = () => {
    try {
      const compositionProfile = items.reduce((acc, item) => {
        const label = getCompositionLabel(item);
        acc[label] = (acc[label] || 0) + Number(item.percentage || 0);
        return acc;
      }, {});
      const itemTypeTotals = items.reduce((acc, item) => {
        const type = item.item_type || 'unknown';
        acc[type] = (acc[type] || 0) + Number(item.percentage || 0);
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
          category: item.category || null,
          family: item.component_family || item.scent_family || null,
          gram_amount: item.gram_amount,
          percentage: item.percentage,
          unit_price: item.unit_price || 0,
          ingredient_cost: item.ingredient_cost || 0,
        })),
        composition_profile: compositionProfile,
        item_type_summary: itemTypeTotals,
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
