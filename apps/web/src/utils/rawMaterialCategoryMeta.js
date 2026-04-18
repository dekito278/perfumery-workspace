import { findPerfumersWorldCategoryByValue } from '@/utils/perfumersWorldCategories.js';

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

export const inferRawMaterialTypeFromCategory = (category, fallbackType = 'material') => {
  const categoryDef = findPerfumersWorldCategoryByValue(category);
  if (!categoryDef) {
    return fallbackType;
  }

  return categoryDef.code.toLowerCase() === 'z' ? 'solvent' : 'material';
};

export const deriveScentFamilyFromCategory = (category, fallbackValue = '') => {
  const categoryDef = findPerfumersWorldCategoryByValue(category);
  if (!categoryDef) {
    return fallbackValue || '';
  }

  return CATEGORY_FAMILY_MAP[categoryDef.code.toLowerCase()] || fallbackValue || categoryDef.name;
};

export const getRawMaterialCategoryMeta = (category, fallbackType = 'material', fallbackFamily = '') => ({
  type: inferRawMaterialTypeFromCategory(category, fallbackType),
  scentFamily: deriveScentFamilyFromCategory(category, fallbackFamily),
});
