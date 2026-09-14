import { findPerfumersWorldCategoryByValue } from '@/utils/perfumersWorldCategories.js';
import { findEcofragranticaGrandfamilyByValue } from '@/utils/ecofragranticaScentTaxonomy.js';

const CATEGORY_FAMILY_MAP = {
  a: 'Fatty',
  b: 'Fresh',
  c: 'Citrus',
  d: 'Dairy',
  e: 'Edible',
  f: 'Fruity',
  g: 'Green',
  h: 'Herbal',
  i: 'Powdery',
  j: 'Floral',
  k: 'Coniferous',
  l: 'Floral',
  m: 'Floral',
  n: 'Floral',
  o: 'Floral',
  p: 'Phenolic',
  q: 'Resinous',
  r: 'Rose',
  s: 'Spicy',
  t: 'Smoky',
  u: 'Animalic',
  v: 'Gourmand',
  w: 'Woody',
  x: 'Musky',
  y: 'Earthy',
  z: 'Solvent',
};

// Deliberately NOT extended to the grandfamilies, and this is a real cost of the 26 -> 11 merge.
//
// Today a material filed under "z - zolvents" is typed as a solvent automatically. Z merges into
// Industrial, which also holds P (phenols) — so "Industrial" cannot tell a solvent from a medicinal
// note, and guessing either way would be wrong for half of them.
//
// A grandfamily therefore falls through to fallbackType, which callers pass as the material's existing
// type. Nothing already typed as a solvent loses that. What is lost is the automatic inference for new
// materials, and for one already typed solvent that gets refiled somewhere else — the Type field in the
// form is the source of truth for those, as it always could have been.
export const inferRawMaterialTypeFromCategory = (category, fallbackType = 'material') => {
  const categoryDef = findPerfumersWorldCategoryByValue(category);
  if (!categoryDef) {
    return fallbackType;
  }

  return categoryDef.code.toLowerCase() === 'z' ? 'solvent' : 'material';
};

export const deriveScentFamilyFromCategory = (category, fallbackValue = '') => {
  const categoryDef = findPerfumersWorldCategoryByValue(category);
  if (categoryDef) {
    return CATEGORY_FAMILY_MAP[categoryDef.code.toLowerCase()] || fallbackValue || categoryDef.name;
  }

  // A grandfamily IS the scent family — no lookup table needed. Without this every migrated material
  // would show "Family not set" in the table, the mobile card and the detail page.
  const grandfamily = findEcofragranticaGrandfamilyByValue(category);
  if (grandfamily) {
    return grandfamily.label;
  }

  return fallbackValue || '';
};

export const getRawMaterialCategoryMeta = (category, fallbackType = 'material', fallbackFamily = '') => ({
  type: inferRawMaterialTypeFromCategory(category, fallbackType),
  scentFamily: deriveScentFamilyFromCategory(category, fallbackFamily),
});
