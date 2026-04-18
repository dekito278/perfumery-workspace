
export const MATERIAL_TYPES = [
  { value: 'material', label: 'Material' },
  { value: 'solvent', label: 'Solvent' }
];

export const MATERIAL_CATEGORIES = [
  { value: 'a - ali-fat-ic', label: 'A - ALI-FAT-IC' },
  { value: 'b - berg-iceberg', label: 'B - Berg-ICEBERG' },
  { value: 'c - citrus', label: 'C - CITRUS' },
  { value: 'd - dairy', label: 'D - DAIRY' },
  { value: 'e - edible', label: 'E - EDIBLE' },
  { value: 'f - fruit', label: 'F - FRUIT' },
  { value: 'g - green', label: 'G - GREEN' },
  { value: 'h - herb (cool)', label: 'H - HERB (Cool)' },
  { value: 'i - iris', label: 'I - IRIS' },
  { value: 'j - jasmin', label: 'J - JASMIN' },
  { value: 'k - konifer', label: 'K - KONIFER' },
  { value: 'l - light chemical floral', label: 'L - LIGHT Chemical Floral' },
  { value: 'm - muguet', label: 'M - MUGUET' },
  { value: 'n - narcotic', label: 'N - NARCOTIC' },
  { value: 'o - orchid', label: 'O - ORCHID' },
  { value: 'p - phenol', label: 'P - PHENOL' },
  { value: 'q - queen of the orient', label: 'Q - Queen of the ORIENT' },
  { value: 'r - rose', label: 'R - ROSE' },
  { value: 's - spice (hot)', label: 'S - SPICE (Hot)' },
  { value: 't - tar smoke', label: 'T - TAR SMOKE' },
  { value: 'u - urine faecal animal', label: 'U - Urine Faecal ANIMAL' },
  { value: 'v - vanilla', label: 'V - VANILLA' },
  { value: 'w - wood', label: 'W - WOOD' },
  { value: 'x - x-rated musk', label: 'X - X-rated MUSK' },
  { value: 'y - earthy mossy', label: 'Y - EARTHY MOSSY' },
  { value: 'z - zolvents', label: 'Z - ZOLVENTS' }
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
