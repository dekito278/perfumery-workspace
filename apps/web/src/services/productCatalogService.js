import { featuredProducts } from '@/data/storefront.js';

export const PRODUCT_CATALOG_STORAGE_KEY = 'dekito.storefront.products.v1';

const FALLBACK_VISUALS = [
  'from-[#f5d78f] via-[#f8efe1] to-[#d7b98b]',
  'from-[#f0b6c2] via-[#fff2f4] to-[#b97f88]',
  'from-[#a7d8d3] via-[#effaf8] to-[#efd37c]',
  'from-[#e6bd82] via-[#fff4df] to-[#b8885b]',
  'from-[#bad7b6] via-[#f6fbf0] to-[#d8c89b]',
  'from-[#9fb8b3] via-[#eef5f2] to-[#8e806d]',
];

const toSlug = (value) => String(value || 'product')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'product';

const parseRupiah = (value) => {
  if (typeof value === 'number') return value;
  const numeric = Number(String(value || '').replace(/[^0-9]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
};

export const formatRupiah = (value) => {
  const numeric = parseRupiah(value);
  return `Rp ${new Intl.NumberFormat('id-ID').format(numeric)}`;
};

const splitList = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const ensureUniqueSlug = (slug, products, currentId) => {
  const usedSlugs = new Set(products.filter((product) => product.id !== currentId).map((product) => product.slug));
  if (!usedSlugs.has(slug)) return slug;

  let index = 2;
  let nextSlug = `${slug}-${index}`;
  while (usedSlugs.has(nextSlug)) {
    index += 1;
    nextSlug = `${slug}-${index}`;
  }
  return nextSlug;
};

export const normalizeProduct = (input, existingProducts = []) => {
  const priceNumber = parseRupiah(input.priceNumber || input.price);
  const id = input.id || `custom-${Date.now()}`;
  const slug = ensureUniqueSlug(toSlug(input.slug || input.name), existingProducts, id);
  const visualIndex = Math.abs(String(slug).split('').reduce((sum, character) => sum + character.charCodeAt(0), 0)) % FALLBACK_VISUALS.length;

  return {
    id,
    slug,
    name: String(input.name || 'Untitled perfume').trim(),
    category: input.category || 'Fresh',
    price: input.price || formatRupiah(priceNumber),
    priceNumber,
    size: input.size || '30 ml',
    notes: input.notes || 'Custom scent profile',
    topNotes: splitList(input.topNotes).length ? splitList(input.topNotes) : ['Opening note'],
    heartNotes: splitList(input.heartNotes).length ? splitList(input.heartNotes) : ['Heart note'],
    baseNotes: splitList(input.baseNotes).length ? splitList(input.baseNotes) : ['Base note'],
    mood: input.mood || 'Custom perfume profile',
    description: input.description || 'A custom product entry managed from Studio.',
    concentration: input.concentration || 'Eau de Parfum',
    stock: Number(input.stock || 0),
    variants: splitList(input.variants).length ? splitList(input.variants) : ['10 ml', '30 ml'],
    tags: splitList(input.tags).length ? splitList(input.tags) : ['Custom'],
    intensity: input.intensity || 'Medium',
    featured: Boolean(input.featured),
    popularity: Number(input.popularity || 70),
    visual: input.visual || FALLBACK_VISUALS[visualIndex],
    imageUrl: input.imageUrl || '',
    source: input.source || 'custom',
    updatedAt: new Date().toISOString(),
  };
};

const readStoredProducts = () => {
  if (typeof window === 'undefined') return [];

  try {
    const value = window.localStorage.getItem(PRODUCT_CATALOG_STORAGE_KEY);
    return value ? JSON.parse(value) : [];
  } catch (error) {
    return [];
  }
};

const writeStoredProducts = (products) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PRODUCT_CATALOG_STORAGE_KEY, JSON.stringify(products));
  window.dispatchEvent(new CustomEvent('dekito:products-updated'));
};

export const getCatalogProducts = () => {
  const baseProducts = featuredProducts.map((product) => ({ ...product, source: 'seed' }));
  return [...baseProducts, ...readStoredProducts()];
};

export const getEditableProducts = () => readStoredProducts();

export const saveCustomProduct = (input) => {
  const storedProducts = readStoredProducts();
  const existingProducts = [...featuredProducts, ...storedProducts];
  const product = normalizeProduct(input, existingProducts);
  const nextProducts = storedProducts.some((item) => item.id === product.id)
    ? storedProducts.map((item) => (item.id === product.id ? product : item))
    : [product, ...storedProducts];
  writeStoredProducts(nextProducts);
  return product;
};

export const deleteCustomProduct = (id) => {
  const nextProducts = readStoredProducts().filter((product) => product.id !== id);
  writeStoredProducts(nextProducts);
};

export const resetCustomProducts = () => {
  writeStoredProducts([]);
};
