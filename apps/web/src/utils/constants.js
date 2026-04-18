
export const MATERIAL_TYPES = [
  { value: 'material', label: 'Material' },
  { value: 'solvent', label: 'Solvent' }
];

export const MATERIAL_CATEGORIES = [
  { value: 'floral', label: 'Floral' },
  { value: 'amber', label: 'Amber' },
  { value: 'woody', label: 'Woody' },
  { value: 'citrus', label: 'Citrus' },
  { value: 'musk', label: 'Musk' },
  { value: 'fruity', label: 'Fruity' },
  { value: 'green', label: 'Green' },
  { value: 'gourmand', label: 'Gourmand' },
  { value: 'spicy', label: 'Spicy' },
  { value: 'resinous', label: 'Resinous' },
  { value: 'solvent', label: 'Solvent' }
];

export const SCENT_FAMILIES = [
  { value: 'citrus', label: 'Citrus' },
  { value: 'floral', label: 'Floral' },
  { value: 'woody', label: 'Woody' },
  { value: 'spicy', label: 'Spicy' },
  { value: 'fresh', label: 'Fresh' },
  { value: 'oriental', label: 'Oriental' },
  { value: 'herbal', label: 'Herbal' },
  { value: 'gourmand', label: 'Gourmand' }
];

export const NOTE_TYPES = [
  { value: 'top', label: 'Top Note' },
  { value: 'middle', label: 'Middle Note' },
  { value: 'base', label: 'Base Note' }
];

export const UNIT_OPTIONS = [
  { value: 'ml', label: 'ml' },
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'oz', label: 'oz' },
  { value: 'lb', label: 'lb' }
];

export const FORMULA_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' }
];

export const BATCH_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' }
];

export const FORMULA_CATEGORIES = [
  { value: 'perfume', label: 'Perfume' },
  { value: 'eau_de_toilette', label: 'Eau de Toilette' },
  { value: 'eau_de_cologne', label: 'Eau de Cologne' },
  { value: 'fragrance_oil', label: 'Fragrance Oil' }
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
