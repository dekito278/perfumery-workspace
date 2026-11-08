
export const UNIT_OPTIONS = [
  { value: 'ml', label: 'ml' },
  { value: 'g', label: 'g' },
  { value: 'l', label: 'l' },
  { value: 'kg', label: 'kg' },
  { value: 'oz', label: 'oz' },
  { value: 'lb', label: 'lb' }
];

export const FORMULA_STATUSES = [
  { value: 'draft', label: 'Draf' },
  { value: 'in_review', label: 'Ditinjau' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'ready_for_batch', label: 'Siap batch' },
  { value: 'batched', label: 'Sudah di-batch' },
  { value: 'published_product', label: 'Jadi produk' },
  { value: 'active', label: 'Aktif' },
  { value: 'archived', label: 'Diarsipkan' }
];

export const BATCH_STATUSES = [
  { value: 'planned', label: 'Rencana' },
  { value: 'produced', label: 'Diproduksi' },
  { value: 'qc', label: 'QC' },
  { value: 'ready_for_product', label: 'Siap produk' },
  { value: 'converted_to_product', label: 'Jadi produk' },
  { value: 'draft', label: 'Draf' },
  { value: 'in_progress', label: 'Berjalan' },
  { value: 'completed', label: 'Selesai' }
];

export const FORMULA_CATEGORIES = [
  { value: 'perfume', label: 'Parfum' }
];

export const FIELD_CONSTRAINTS = {
  name: { maxLength: 100 },
  code: { maxLength: 50 },
  version: { maxLength: 20 },
  description: { maxLength: 500 },
  notes: { maxLength: 500 },
  scentFamily: { maxLength: 50 },
  category: { maxLength: 50 },
  quantity: { decimals: 2, max: 999999 },
  gramAmount: { decimals: 2, min: 0.01, max: 999999 },
  currency: { decimals: 2, max: 999999 }
};
