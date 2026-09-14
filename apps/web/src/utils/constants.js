
export const UNIT_OPTIONS = [
  { value: 'ml', label: 'ml' },
  { value: 'g', label: 'g' },
  { value: 'l', label: 'l' },
  { value: 'kg', label: 'kg' },
  { value: 'oz', label: 'oz' },
  { value: 'lb', label: 'lb' }
];

export const FORMULA_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'ready_for_batch', label: 'Ready Batch' },
  { value: 'batched', label: 'Batched' },
  { value: 'published_product', label: 'Published' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' }
];

export const BATCH_STATUSES = [
  { value: 'planned', label: 'Planned' },
  { value: 'produced', label: 'Produced' },
  { value: 'qc', label: 'QC' },
  { value: 'ready_for_product', label: 'Ready Product' },
  { value: 'converted_to_product', label: 'Converted' },
  { value: 'draft', label: 'Draft' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' }
];

export const FORMULA_CATEGORIES = [
  { value: 'perfume', label: 'Perfume' }
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
