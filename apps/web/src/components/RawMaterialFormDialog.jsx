import React from 'react';
import { AlertCircle, Link2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FormField from '@/components/FormField.jsx';
import FormSelect from '@/components/FormSelect.jsx';
import FormNumber from '@/components/FormNumber.jsx';
import { formatCurrency } from '@/utils/formatting.js';
import { formatDilutionInfo } from '@/utils/calculateDilutionCost.js';
import { UNIT_OPTIONS } from '@/utils/constants.js';
import { WORKBOOK_ABC_CLASSIFICATIONS } from '@/utils/workbookAbcClassification.js';

const familyOptions = WORKBOOK_ABC_CLASSIFICATIONS.map((entry) => ({
  value: entry.familyName,
  label: `${entry.letter} - ${entry.familyName}`,
}));

const modeCopy = {
  create: {
    title: 'Add new material',
    description: 'Capture a material profile, guidance, and dilution setup for the formulation library.',
    submitLabel: 'Add material',
    workbookGuidanceDescription: 'Import workbook-style guidance to enrich impact, life, CAS, IFRA, and use-level data.',
    manualGuidanceDescription: 'Optional. Fill this if the material is not linked to workbook reference data yet.',
  },
  edit: {
    title: 'Edit material',
    description: 'Update library metadata, guidance, and dilution setup for this material.',
    submitLabel: 'Save changes',
    workbookGuidanceDescription: 'Import workbook guidance for CAS, family, impact, life, and use-level enrichment.',
    manualGuidanceDescription: 'Optional. These values keep a manual reference profile in sync when workbook data is not yet linked.',
  },
};

const RawMaterialFormDialog = ({
  mode = 'create',
  open,
  onOpenChange,
  loading,
  form,
  onSubmit,
}) => {
  const copy = modeCopy[mode] || modeCopy.create;
  const idPrefix = mode === 'edit' ? 'edit-material' : 'add-material';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] max-h-[90vh] overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle className="text-lg">{copy.title}</DialogTitle>
          <DialogDescription className="text-xs">{copy.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="space-y-3">
            <FormField
              label="Name"
              value={form.formData.name}
              onChange={(event) => form.handleChange('name', event.target.value)}
              onBlur={() => form.handleBlur('name')}
              error={form.errors.name}
              required
              placeholder="e.g., Bergamot Essential Oil"
              maxLength={160}
            />

            <FormField
              label="Workbook code"
              value={form.formData.workbook_code}
              onChange={(event) => form.handleChange('workbook_code', event.target.value)}
              onBlur={() => form.handleBlur('workbook_code')}
              error={form.errors.workbook_code}
              placeholder="e.g., 3JJ00005"
              maxLength={40}
            />

            <FormSelect
              label="Category"
              value={form.formData.category}
              onChange={(value) => form.handleChange('category', value)}
              onBlur={() => form.handleBlur('category')}
              options={form.categoryOptions}
              error={form.errors.category}
              required
              searchable
              searchPlaceholder="Find category..."
              placeholder={form.categoryOptions.length ? 'Select category' : 'Create category first'}
              disabled={!form.categoryOptions.length}
            />
          </div>

          {!form.isSolvent ? (
            <div className="border-t pt-3 space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`${idPrefix}-is-diluted`}
                  checked={form.formData.is_diluted}
                  onCheckedChange={(checked) => form.handleChange('is_diluted', checked)}
                />
                <Label htmlFor={`${idPrefix}-is-diluted`} className="text-sm font-medium cursor-pointer">
                  This material is diluted
                </Label>
              </div>

              {form.formData.is_diluted ? (
                <div className="space-y-3 pl-6 border-l-2 border-primary/20">
                  <FormSelect
                    label="Dilution solvent"
                    value={form.formData.dilution_solvent_id}
                    onChange={(value) => form.handleChange('dilution_solvent_id', value)}
                    onBlur={() => form.handleBlur('dilution_solvent_id')}
                    options={form.solvents}
                    error={form.errors.dilution_solvent_id}
                    required
                    placeholder="Select solvent"
                  />

                  <FormNumber
                    label="Dilution percentage"
                    value={form.formData.dilution_percentage}
                    onChange={(event) => form.handleChange('dilution_percentage', event.target.value)}
                    onBlur={() => form.handleBlur('dilution_percentage')}
                    error={form.errors.dilution_percentage}
                    required
                    placeholder="e.g., 50"
                    min="0"
                    max="100"
                    step="0.1"
                    unit="%"
                  />

                  {form.formData.dilution_percentage ? (
                    <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-lg">
                      <p className="text-xs text-primary font-medium">
                        {formatDilutionInfo(parseFloat(form.formData.dilution_percentage))}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {!form.isSolvent ? (
            <div className="border-t pt-3 space-y-3">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium">Workbook guidance import</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {copy.workbookGuidanceDescription}
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-background px-3 py-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <Label htmlFor={`${idPrefix}-perfumersworld-url`}>PerfumersWorld URL</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tempel link produk PerfumersWorld untuk import workbook code, impact, life, CAS, dan use level.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={form.handleImportPerfumersWorldUrl} className="rounded-2xl" disabled={form.importingUrl}>
                      <Link2 className="mr-2 h-4 w-4" />
                      {form.importingUrl ? 'Importing...' : 'Import URL'}
                    </Button>
                  </div>
                  <Input
                    id={`${idPrefix}-perfumersworld-url`}
                    value={form.perfumersWorldUrl}
                    onChange={(event) => form.setPerfumersWorldUrl(event.target.value)}
                    placeholder="https://www.perfumersworld.com/view.php?pro_id=..."
                    className="h-11 rounded-2xl"
                  />
                </div>

                <div className="rounded-xl border border-border/60 bg-background px-3 py-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <Label htmlFor={`${idPrefix}-scentree-url`}>ScenTree URL</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tempel URL ingredient dari ScenTree untuk import family, CAS, IFRA, volatility, dan descriptor ringkas.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={form.handleImportScentreeUrl} className="rounded-2xl" disabled={form.importingUrl}>
                      <Link2 className="mr-2 h-4 w-4" />
                      {form.importingUrl ? 'Importing...' : 'Import URL'}
                    </Button>
                  </div>
                  <Input
                    id={`${idPrefix}-scentree-url`}
                    value={form.scentreeUrl}
                    onChange={(event) => form.setScentreeUrl(event.target.value)}
                    placeholder="https://www.scentree.co/en/..."
                    className="h-11 rounded-2xl"
                  />
                </div>

                <div className="rounded-xl border border-border/60 bg-background px-3 py-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <Label htmlFor={`${idPrefix}-tgsc-url`}>TGSC URL</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tempel URL The Good Scents Company untuk import CAS, odor profile, impact heuristic, dan life dari substantivity.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={form.handleImportTgscUrl} className="rounded-2xl" disabled={form.importingUrl}>
                      <Link2 className="mr-2 h-4 w-4" />
                      {form.importingUrl ? 'Importing...' : 'Import URL'}
                    </Button>
                  </div>
                  <Input
                    id={`${idPrefix}-tgsc-url`}
                    value={form.tgscUrl}
                    onChange={(event) => form.setTgscUrl(event.target.value)}
                    placeholder="https://www.thegoodscentscompany.com/data/..."
                    className="h-11 rounded-2xl"
                  />
                </div>

                {form.inferenceLines.length > 0 ? (
                  <div className="rounded-xl border border-border/60 bg-background px-3 py-3 text-xs text-muted-foreground">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
                      Import notes
                    </div>
                    <div className="space-y-1">
                      {form.inferenceLines.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="border-t pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormSelect
                label="Unit"
                value={form.formData.unit}
                onChange={(value) => form.handleChange('unit', value)}
                onBlur={() => form.handleBlur('unit')}
                options={UNIT_OPTIONS}
                error={form.errors.unit}
                required
              />
              <div className="space-y-1.5">
                <FormNumber
                  label={`Unit price (per 10 ${form.formData.unit || 'ml'})`}
                  value={form.formData.cost_per_unit}
                  onChange={(event) => form.handleChange('cost_per_unit', event.target.value)}
                  onBlur={() => form.handleBlur('cost_per_unit')}
                  error={form.errors.cost_per_unit}
                  placeholder="e.g., 25000"
                  min="0"
                  step="0.01"
                />
                {form.formData.cost_per_unit ? (
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(parseFloat(form.formData.cost_per_unit))} per 10 {form.formData.unit || 'ml'}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {form.isSolvent ? (
            <div className="border-t pt-3 space-y-3">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium">Solvent calibration</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Atur bagaimana carrier ini menggeser impact dan life saat dipakai sebagai dilution solvent. Nilai positif menaikkan, nilai negatif menurunkan.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {form.solventCalibrationPresets.map((preset) => (
                    <Button
                      key={preset.key}
                      type="button"
                      variant="outline"
                      className="rounded-full px-3 py-1 text-[11px]"
                      onClick={() => form.applySolventCalibrationPreset(preset.key)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full px-3 py-1 text-[11px]"
                    onClick={form.clearSolventCalibrationPreset}
                  >
                    Clear
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormNumber
                    label="Impact shift"
                    value={form.formData.solvent_impact_shift_percent}
                    onChange={(event) => form.handleChange('solvent_impact_shift_percent', event.target.value)}
                    onBlur={() => form.handleBlur('solvent_impact_shift_percent')}
                    error={form.errors.solvent_impact_shift_percent}
                    placeholder="e.g., -12"
                    min="-100"
                    max="100"
                    step="0.1"
                    unit="%"
                  />
                  <FormNumber
                    label="Life shift"
                    value={form.formData.solvent_life_shift_percent}
                    onChange={(event) => form.handleChange('solvent_life_shift_percent', event.target.value)}
                    onBlur={() => form.handleBlur('solvent_life_shift_percent')}
                    error={form.errors.solvent_life_shift_percent}
                    placeholder="e.g., 5"
                    min="-100"
                    max="100"
                    step="0.1"
                    unit="%"
                  />
                </div>

                <div className="rounded-xl border border-dashed border-border/70 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                  Preset ini dipakai sebagai starting point. Anda tetap bisa koreksi angkanya agar sesuai karakter solvent aktual di lab.
                </div>
              </div>
            </div>
          ) : null}

          <div className="border-t pt-3 space-y-3">
            <FormField
              label="Vendor"
              value={form.formData.vendor}
              onChange={(event) => form.handleChange('vendor', event.target.value)}
              placeholder="e.g., PerfumersWorld"
            />

            <FormField
              label="CAS number"
              value={form.formData.cas_number}
              onChange={(event) => form.handleChange('cas_number', event.target.value)}
              onBlur={() => form.handleBlur('cas_number')}
              error={form.errors.cas_number}
              placeholder="e.g., 8007-75-8"
            />

            <FormNumber
              label="IFRA limit"
              value={form.formData.ifra_limit}
              onChange={(event) => form.handleChange('ifra_limit', event.target.value)}
              onBlur={() => form.handleBlur('ifra_limit')}
              error={form.errors.ifra_limit}
              placeholder="0.0"
              min="0"
              max="100"
              step="0.1"
              unit="%"
            />

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
              <div>
                <p className="text-sm font-medium">Manual reference guidance</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {copy.manualGuidanceDescription}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-workbook-family`}>Workbook family / class</Label>
                <Select
                  value={form.formData.reference_abc_primary_family || '__none__'}
                  onValueChange={(value) => form.handleChange('reference_abc_primary_family', value === '__none__' ? '' : value)}
                >
                  <SelectTrigger id={`${idPrefix}-workbook-family`} className="h-10 rounded-xl">
                    <SelectValue placeholder="Select workbook family" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No family selected</SelectItem>
                    {familyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormNumber
                  label="Impact"
                  value={form.formData.reference_impact}
                  onChange={(event) => form.handleChange('reference_impact', event.target.value)}
                  onBlur={() => form.handleBlur('reference_impact')}
                  error={form.errors.reference_impact}
                  min="0"
                  step="0.1"
                />
                <FormNumber
                  label="Life hours"
                  value={form.formData.reference_life_hours}
                  onChange={(event) => form.handleChange('reference_life_hours', event.target.value)}
                  onBlur={() => form.handleBlur('reference_life_hours')}
                  error={form.errors.reference_life_hours}
                  min="0"
                  step="0.1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormNumber
                  label="Typical use level"
                  value={form.formData.reference_use_level_typical_percent}
                  onChange={(event) => form.handleChange('reference_use_level_typical_percent', event.target.value)}
                  onBlur={() => form.handleBlur('reference_use_level_typical_percent')}
                  error={form.errors.reference_use_level_typical_percent}
                  min="0"
                  max="100"
                  step="0.1"
                  unit="%"
                />
                <FormNumber
                  label="Max use level"
                  value={form.formData.reference_use_level_max_percent}
                  onChange={(event) => form.handleChange('reference_use_level_max_percent', event.target.value)}
                  onBlur={() => form.handleBlur('reference_use_level_max_percent')}
                  error={form.errors.reference_use_level_max_percent}
                  min="0"
                  max="100"
                  step="0.1"
                  unit="%"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-description`}>Description</Label>
              <Textarea
                id={`${idPrefix}-description`}
                value={form.formData.description}
                onChange={(event) => form.handleChange('description', event.target.value)}
                rows={3}
                placeholder="Short description or odour profile"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
              <Textarea
                id={`${idPrefix}-notes`}
                value={form.formData.notes}
                onChange={(event) => form.handleChange('notes', event.target.value)}
                rows={3}
                placeholder="Optional notes, source context, or evaluation remarks"
              />
            </div>
          </div>

          {Object.keys(form.warnings).length > 0 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <div className="space-y-1">
                  {Object.values(form.warnings).map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || form.hasErrors}>
              {loading ? 'Saving...' : copy.submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RawMaterialFormDialog;
