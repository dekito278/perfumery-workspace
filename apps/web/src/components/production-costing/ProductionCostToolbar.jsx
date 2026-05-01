import React from 'react';
import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ProductionCostToolbar = ({
  formulas,
  onExportPdf,
  onPrint,
  retailInputs,
  selectedFormulaId,
  selectedSolventId,
  setSelectedFormulaId,
  setSelectedSolventId,
  solventOptions,
  updateRetailInput,
}) => (
  <div className="rounded-xl border bg-card p-5">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2">
        <Label>Formula</Label>
        <Select value={selectedFormulaId} onValueChange={setSelectedFormulaId}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select formula" />
          </SelectTrigger>
          <SelectContent>
            {formulas.map((formula) => (
              <SelectItem key={formula.id} value={formula.id}>
                {formula.name} ({formula.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Main solvent</Label>
        <Select value={selectedSolventId} onValueChange={setSelectedSolventId}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select solvent" />
          </SelectTrigger>
          <SelectContent>
            {solventOptions.map((material) => (
              <SelectItem key={material.id} value={material.id}>
                {material.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Concentration %</Label>
        <Input
          value={retailInputs.formulaPercentage}
          onChange={(event) => updateRetailInput('formulaPercentage', event.target.value)}
          type="number"
          min="0"
          max="100"
          step="0.01"
        />
      </div>

      <div className="space-y-2">
        <Label>Print / export</Label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onPrint} className="h-9 gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={onExportPdf} className="h-9 gap-2">
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>
    </div>
  </div>
);

export default ProductionCostToolbar;
