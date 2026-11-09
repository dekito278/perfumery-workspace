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

// Top / middle / base, Dekito's own answer. The workbook's resolver prefers this over its own inference
// from class distribution and life hours, and that inference disagrees with the stated answers on 256 of
// the 551 materials that have one -- 46%. Before this select existed the column could not be set from
// anywhere in the app, so the remaining 223 materials had no way to stop being guessed (#445).
const pyramidPlacementOptions = [
  { value: '', label: 'Otomatis (ditebak workbook)' },
  { value: 'top', label: 'Atas' },
  { value: 'middle', label: 'Tengah' },
  { value: 'base', label: 'Dasar' },
];

const dataStatusOptions = [
  { value: 'active', label: 'Aktif' },
  { value: 'needs_review', label: 'Perlu ditinjau' },
  { value: 'archived', label: 'Diarsipkan' },
];

const modeCopy = {
  create: {
    title: 'Bahan baku baru',
    description: 'Catat profil bahan, panduan, dan pengaturan pengenceran untuk pustaka formulasi.',
    submitLabel: 'Simpan bahan baku',
    workbookGuidanceDescription: 'Impor panduan ala workbook untuk melengkapi kekuatan, ketahanan, CAS, IFRA, dan takaran pakai.',
    manualGuidanceDescription: 'Opsional. Isi bila bahan ini belum tertaut ke data acuan workbook.',
  },
  edit: {
    title: 'Edit bahan baku',
    description: 'Perbarui data pustaka, panduan, dan pengaturan pengenceran bahan ini.',
    submitLabel: 'Simpan perubahan',
    workbookGuidanceDescription: 'Impor panduan workbook untuk melengkapi CAS, keluarga aroma, kekuatan, ketahanan, dan takaran pakai.',
    manualGuidanceDescription: 'Opsional. Nilai ini menjaga profil acuan manual tetap sinkron selama data workbook belum tertaut.',
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
              label="Nama bahan"
              value={form.formData.name}
              onChange={(event) => form.handleChange('name', event.target.value)}
              onBlur={() => form.handleBlur('name')}
              error={form.errors.name}
              required
              placeholder="mis. Bergamot Essential Oil"
              maxLength={160}
            />

            <FormField
              label="Kode workbook"
              value={form.formData.workbook_code}
              onChange={(event) => form.handleChange('workbook_code', event.target.value)}
              onBlur={() => form.handleBlur('workbook_code')}
              error={form.errors.workbook_code}
              placeholder="mis. 3JJ00005"
              maxLength={40}
            />

            <FormSelect
              label="Kategori"
              value={form.formData.category}
              onChange={(value) => form.handleChange('category', value)}
              onBlur={() => form.handleBlur('category')}
              options={form.categoryOptions}
              error={form.errors.category}
              required
              searchable
              searchPlaceholder="Cari kategori..."
              placeholder={form.categoryOptions.length ? 'Pilih kategori' : 'Buat kategori dulu'}
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
                  Bahan ini diencerkan
                </Label>
              </div>

              {form.formData.is_diluted ? (
                <div className="space-y-3 pl-6 border-l-2 border-primary/20">
                  <FormSelect
                    label="Pelarut pengencer"
                    value={form.formData.dilution_solvent_id}
                    onChange={(value) => form.handleChange('dilution_solvent_id', value)}
                    onBlur={() => form.handleBlur('dilution_solvent_id')}
                    options={form.solvents}
                    error={form.errors.dilution_solvent_id}
                    required
                    placeholder="Pilih pelarut"
                  />

                  <FormNumber
                    label="Persentase pengenceran"
                    value={form.formData.dilution_percentage}
                    onChange={(event) => form.handleChange('dilution_percentage', event.target.value)}
                    onBlur={() => form.handleBlur('dilution_percentage')}
                    error={form.errors.dilution_percentage}
                    required
                    placeholder="mis. 50"
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
                  <p className="text-sm font-medium">Impor panduan workbook</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {copy.workbookGuidanceDescription}
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-background px-3 py-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <Label htmlFor={`${idPrefix}-perfumersworld-url`}>PerfumersWorld URL</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tempel link produk PerfumersWorld untuk mengimpor kode workbook, kekuatan, ketahanan, CAS, dan takaran pakai.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={form.handleImportPerfumersWorldUrl} className="rounded-2xl" disabled={form.importingUrl}>
                      <Link2 className="mr-2 h-4 w-4" />
                      {form.importingUrl ? 'Mengimpor...' : 'Impor URL'}
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
                        Tempel URL bahan dari ScenTree untuk mengimpor keluarga aroma, CAS, IFRA, volatilitas, dan deskriptor ringkas.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={form.handleImportScentreeUrl} className="rounded-2xl" disabled={form.importingUrl}>
                      <Link2 className="mr-2 h-4 w-4" />
                      {form.importingUrl ? 'Mengimpor...' : 'Impor URL'}
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
                        Tempel URL The Good Scents Company untuk mengimpor CAS, profil bau, perkiraan kekuatan, dan ketahanan dari substantivitas.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={form.handleImportTgscUrl} className="rounded-2xl" disabled={form.importingUrl}>
                      <Link2 className="mr-2 h-4 w-4" />
                      {form.importingUrl ? 'Mengimpor...' : 'Impor URL'}
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
                      Catatan impor
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
            <FormSelect
              label="Posisi piramida"
              value={form.formData.pyramid_placement || ''}
              onChange={(value) => form.handleChange('pyramid_placement', value)}
              options={pyramidPlacementOptions}
              helperText="Menentukan porsi bahan ini di keseimbangan Atas / Tengah / Dasar, dan skor Pembuka, Inti, Jejak akhir, serta Ketahanan yang dibangun di atasnya. Kalau dibiarkan Otomatis, workbook yang menebak."
            />
            <div className="grid grid-cols-2 gap-3">
              <FormSelect
                label="Satuan"
                value={form.formData.unit}
                onChange={(value) => form.handleChange('unit', value)}
                onBlur={() => form.handleBlur('unit')}
                options={UNIT_OPTIONS}
                error={form.errors.unit}
                required
              />
              <div className="space-y-1.5">
                <FormNumber
                  label={`Harga per 10 ${form.formData.unit || 'ml'}`}
                  value={form.formData.cost_per_unit}
                  onChange={(value) => form.handleChange('cost_per_unit', value === '' ? '' : String(value))}
                  localized
                  onBlur={() => form.handleBlur('cost_per_unit')}
                  error={form.errors.cost_per_unit}
                  placeholder="mis. 25000"
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormNumber
                label="Stok tersedia"
                value={form.formData.stock_quantity}
                onChange={(value) => form.handleChange('stock_quantity', value === '' ? '' : String(value))}
                localized
                onBlur={() => form.handleBlur('stock_quantity')}
                error={form.errors.stock_quantity}
                placeholder="0"
                min="0"
                step="0.001"
                unit={form.formData.unit || 'ml'}
              />
              <FormNumber
                label="Stok minimum"
                value={form.formData.minimum_stock}
                onChange={(value) => form.handleChange('minimum_stock', value === '' ? '' : String(value))}
                localized
                onBlur={() => form.handleBlur('minimum_stock')}
                error={form.errors.minimum_stock}
                placeholder="0"
                min="0"
                step="0.001"
                unit={form.formData.unit || 'ml'}
              />
              <FormNumber
                label="Peringatan stok menipis"
                value={form.formData.low_stock_threshold}
                onChange={(value) => form.handleChange('low_stock_threshold', value === '' ? '' : String(value))}
                localized
                onBlur={() => form.handleBlur('low_stock_threshold')}
                error={form.errors.low_stock_threshold}
                placeholder="Opsional"
                min="0"
                step="0.001"
                unit={form.formData.unit || 'ml'}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-data-status`}>Status kerapian</Label>
                <Select
                  value={form.formData.data_status || 'active'}
                  onValueChange={(value) => form.handleChange('data_status', value)}
                >
                  <SelectTrigger id={`${idPrefix}-data-status`} className="h-10 rounded-xl">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {dataStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormField
                label="Catatan tinjauan"
                value={form.formData.review_notes}
                onChange={(event) => form.handleChange('review_notes', event.target.value)}
                placeholder="Kenapa bahan ini perlu dirapikan, ditinjau, atau diarsipkan"
              />
            </div>
          </div>

          {form.isSolvent ? (
            <div className="border-t pt-3 space-y-3">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium">Kalibrasi pelarut</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Atur seberapa jauh pembawa ini menggeser kekuatan dan ketahanan saat dipakai sebagai pelarut pengencer. Nilai positif menaikkan, nilai negatif menurunkan.
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
                    Kosongkan
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormNumber
                    label="Geser kekuatan"
                    value={form.formData.solvent_impact_shift_percent}
                    onChange={(event) => form.handleChange('solvent_impact_shift_percent', event.target.value)}
                    onBlur={() => form.handleBlur('solvent_impact_shift_percent')}
                    error={form.errors.solvent_impact_shift_percent}
                    placeholder="mis. -12"
                    min="-100"
                    max="100"
                    step="0.1"
                    unit="%"
                  />
                  <FormNumber
                    label="Geser ketahanan"
                    value={form.formData.solvent_life_shift_percent}
                    onChange={(event) => form.handleChange('solvent_life_shift_percent', event.target.value)}
                    onBlur={() => form.handleBlur('solvent_life_shift_percent')}
                    error={form.errors.solvent_life_shift_percent}
                    placeholder="mis. 5"
                    min="-100"
                    max="100"
                    step="0.1"
                    unit="%"
                  />
                </div>

                <div className="rounded-xl border border-dashed border-border/70 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                  Preset ini hanya titik awal. Angkanya tetap bisa dikoreksi agar sesuai karakter pelarut yang sebenarnya di lab.
                </div>
              </div>
            </div>
          ) : null}

          <div className="border-t pt-3 space-y-3">
            <FormField
              label="Supplier"
              value={form.formData.vendor}
              onChange={(event) => form.handleChange('vendor', event.target.value)}
              placeholder="mis. PerfumersWorld"
            />

            <FormField
              label="Nomor CAS"
              value={form.formData.cas_number}
              onChange={(event) => form.handleChange('cas_number', event.target.value)}
              onBlur={() => form.handleBlur('cas_number')}
              error={form.errors.cas_number}
              placeholder="mis. 8007-75-8"
            />

            <FormNumber
              label="Batas IFRA"
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
                <p className="text-sm font-medium">Panduan acuan manual</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {copy.manualGuidanceDescription}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-workbook-family`}>Keluarga aroma / kelas workbook</Label>
                <Select
                  value={form.formData.reference_abc_primary_family || '__none__'}
                  onValueChange={(value) => form.handleChange('reference_abc_primary_family', value === '__none__' ? '' : value)}
                >
                  <SelectTrigger id={`${idPrefix}-workbook-family`} className="h-10 rounded-xl">
                    <SelectValue placeholder="Pilih keluarga aroma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tanpa keluarga aroma</SelectItem>
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
                  label="Kekuatan"
                  value={form.formData.reference_impact}
                  onChange={(event) => form.handleChange('reference_impact', event.target.value)}
                  onBlur={() => form.handleBlur('reference_impact')}
                  error={form.errors.reference_impact}
                  min="0"
                  step="0.1"
                />
                <FormNumber
                  label="Ketahanan di strip (jam)"
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
                  label="Takaran umum"
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
                  label="Takaran maks"
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
              <Label htmlFor={`${idPrefix}-description`}>Deskripsi</Label>
              <Textarea
                id={`${idPrefix}-description`}
                value={form.formData.description}
                onChange={(event) => form.handleChange('description', event.target.value)}
                rows={3}
                placeholder="Deskripsi singkat atau profil bau"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-notes`}>Catatan</Label>
              <Textarea
                id={`${idPrefix}-notes`}
                value={form.formData.notes}
                onChange={(event) => form.handleChange('notes', event.target.value)}
                rows={3}
                placeholder="Catatan opsional, asal sumber, atau hasil evaluasi"
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
              Batal
            </Button>
            <Button type="submit" disabled={loading || form.hasErrors}>
              {loading ? 'Menyimpan...' : copy.submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RawMaterialFormDialog;
