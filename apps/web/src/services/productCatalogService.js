import { featuredProducts } from '@/data/storefront.js';
import supabase from '@/lib/supabaseClient.js';

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

export const normalizeProductImages = (input = {}) => {
  const rawImages = Array.isArray(input.images)
    ? input.images
    : splitList(input.images || input.imageUrls || input.image_urls);
  const imageUrl = String(input.imageUrl || input.image_url || '').trim();
  const images = [...rawImages, imageUrl]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return [...new Set(images)];
};

export const createProductVariant = (overrides = {}) => ({
  id: overrides.id || `variant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  size: overrides.size || '30 ml',
  priceNumber: Number(overrides.priceNumber || overrides.price || 0),
  compareAtPriceNumber: Number(overrides.compareAtPriceNumber || overrides.compareAtPrice || 0),
  stock: Number(overrides.stock || 0),
});

const normalizeVariant = (variant, index, fallback = {}) => {
  if (typeof variant === 'string') {
    return createProductVariant({
      id: toSlug(variant) || `variant-${index + 1}`,
      size: variant,
      priceNumber: fallback.priceNumber,
      compareAtPriceNumber: fallback.compareAtPriceNumber,
      stock: fallback.stock,
    });
  }

  return createProductVariant({
    id: variant?.id || toSlug(variant?.size) || `variant-${index + 1}`,
    size: variant?.size || fallback.size || '30 ml',
    priceNumber: parseRupiah(variant?.priceNumber || variant?.price || fallback.priceNumber),
    compareAtPriceNumber: parseRupiah(variant?.compareAtPriceNumber || variant?.compareAtPrice || fallback.compareAtPriceNumber),
    stock: Number(variant?.stock ?? fallback.stock ?? 0),
  });
};

export const normalizeProductVariants = (input = {}) => {
  const fallback = {
    size: input.size || '30 ml',
    priceNumber: parseRupiah(input.priceNumber || input.price),
    compareAtPriceNumber: parseRupiah(input.compareAtPriceNumber || input.compareAtPrice),
    stock: Number(input.stock || 0),
  };
  const rawVariants = Array.isArray(input.variants)
    ? input.variants
    : splitList(input.variants);
  const legacyStringVariants = rawVariants.every((variant) => typeof variant === 'string');
  const variants = rawVariants.length
    ? rawVariants.map((variant, index) => {
      if (legacyStringVariants) {
        const splitStock = Math.floor(fallback.stock / rawVariants.length);
        const remainder = index < (fallback.stock % rawVariants.length) ? 1 : 0;
        return normalizeVariant(variant, index, { ...fallback, stock: splitStock + remainder });
      }
      return normalizeVariant(variant, index, fallback);
    })
    : [normalizeVariant(fallback, 0, fallback)];

  return variants
    .filter((variant) => variant.size)
    .map((variant) => ({
      ...variant,
      priceNumber: Math.max(Number(variant.priceNumber || 0), 0),
      compareAtPriceNumber: Math.max(Number(variant.compareAtPriceNumber || 0), 0),
      stock: Math.max(Number(variant.stock || 0), 0),
    }));
};

export const getProductPriceRange = (variants = []) => {
  const prices = variants.map((variant) => Number(variant.priceNumber || 0)).filter((price) => price > 0);
  if (!prices.length) return 0;
  return Math.min(...prices);
};

export const getProductStockTotal = (variants = []) => variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);

export const getProductLowStock = (product) => {
  const stock = Number(product?.stock || 0);
  return stock > 0 && stock <= 5;
};

const findProductForOrderItem = (products, item = {}) => products.find((product) => (
  product.id === item.id
  || product.id === item.productId
  || product.slug === item.productSlug
  || product.slug === item.slug
));

const deductProductItemStock = (product, item = {}) => {
  const quantity = Math.max(Number(item.quantity || 1), 0);
  let deducted = false;
  const variants = (product.variants || []).map((variant, index) => {
    const matchesVariant = item.variantId
      ? variant.id === item.variantId
      : (variant.size === item.size || (!item.size && index === 0));
    if (!matchesVariant || deducted) return variant;
    deducted = true;
    return {
      ...variant,
      stock: Math.max(Number(variant.stock || 0) - quantity, 0),
    };
  });

  if (!deducted && variants.length) {
    variants[0] = {
      ...variants[0],
      stock: Math.max(Number(variants[0].stock || 0) - quantity, 0),
    };
    deducted = true;
  }

  const stock = getProductStockTotal(variants);
  return { product: { ...product, variants, stock }, deducted };
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
  const variants = normalizeProductVariants(input);
  const primaryVariant = variants[0] || createProductVariant();
  const priceNumber = getProductPriceRange(variants) || parseRupiah(input.priceNumber || input.price);
  const stock = getProductStockTotal(variants);
  const images = normalizeProductImages(input);
  const id = input.id || `custom-${Date.now()}`;
  const slug = ensureUniqueSlug(toSlug(input.slug || input.name), existingProducts, id);
  const visualIndex = Math.abs(String(slug).split('').reduce((sum, character) => sum + character.charCodeAt(0), 0)) % FALLBACK_VISUALS.length;

  return {
    id,
    slug,
    name: String(input.name || 'Untitled perfume').trim(),
    category: input.category || 'Uncategorized',
    price: formatRupiah(priceNumber),
    priceNumber,
    compareAtPriceNumber: Number(primaryVariant.compareAtPriceNumber || input.compareAtPriceNumber || 0),
    compareAtPrice: primaryVariant.compareAtPriceNumber ? formatRupiah(primaryVariant.compareAtPriceNumber) : '',
    size: primaryVariant.size || input.size || '30 ml',
    notes: input.notes || 'Custom scent profile',
    topNotes: splitList(input.topNotes).length ? splitList(input.topNotes) : ['Opening note'],
    heartNotes: splitList(input.heartNotes).length ? splitList(input.heartNotes) : ['Heart note'],
    baseNotes: splitList(input.baseNotes).length ? splitList(input.baseNotes) : ['Base note'],
    mood: input.mood || 'Custom perfume profile',
    description: input.description || 'A custom product entry managed from Studio.',
    concentration: input.concentration || 'Eau de Parfum',
    stock,
    variants,
    tags: splitList(input.tags).length ? splitList(input.tags) : ['Custom'],
    intensity: input.intensity || 'Medium',
    featured: Boolean(input.featured),
    popularity: Number(input.popularity || 70),
    visual: input.visual || FALLBACK_VISUALS[visualIndex],
    imageUrl: images[0] || '',
    images,
    source: input.source || 'custom',
    updatedAt: new Date().toISOString(),
  };
};

const toDatabasePayload = (product) => ({
  slug: product.slug,
  name: product.name,
  category: product.category,
  price_number: product.priceNumber,
  size: product.size,
  notes: product.notes,
  top_notes: product.topNotes,
  heart_notes: product.heartNotes,
  base_notes: product.baseNotes,
  mood: product.mood,
  description: product.description,
  concentration: product.concentration,
  stock: product.stock,
  variants: product.variants,
  tags: product.tags,
  intensity: product.intensity,
  featured: product.featured,
  popularity: product.popularity,
  visual: product.visual,
  image_url: product.imageUrl,
  image_urls: product.images,
  source: 'custom',
});

const fromDatabaseRow = (row) => normalizeProduct({
  id: row.id,
  slug: row.slug,
  name: row.name,
  category: row.category,
  priceNumber: row.price_number,
  size: row.size,
  notes: row.notes,
  topNotes: row.top_notes,
  heartNotes: row.heart_notes,
  baseNotes: row.base_notes,
  mood: row.mood,
  description: row.description,
  concentration: row.concentration,
  stock: row.stock,
  variants: row.variants,
  tags: row.tags,
  intensity: row.intensity,
  featured: row.featured,
  popularity: row.popularity,
  visual: row.visual,
  imageUrl: row.image_url,
  images: row.image_urls,
  source: row.source || 'custom',
}, featuredProducts);

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

const cacheFetchedProducts = (products) => {
  if (typeof window === 'undefined' || !Array.isArray(products)) return;
  window.localStorage.setItem(PRODUCT_CATALOG_STORAGE_KEY, JSON.stringify(products));
};

export const getCatalogProducts = () => {
  return readStoredProducts();
};

export const getLocalCatalogProducts = () => getCatalogProducts();

export const getEditableProducts = async () => {
  try {
    const { data, error } = await supabase
      .from('storefront_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const products = (data || []).map(fromDatabaseRow);
    cacheFetchedProducts(products);
    return products;
  } catch (error) {
    console.warn('Using local storefront products fallback:', error.message || error);
    return readStoredProducts();
  }
};

export const getCatalogProductsAsync = async () => {
  const editableProducts = await getEditableProducts();
  return editableProducts;
};

const saveLocalCustomProduct = (input) => {
  const storedProducts = readStoredProducts();
  const existingProducts = [...featuredProducts, ...storedProducts];
  const product = normalizeProduct(input, existingProducts);
  const nextProducts = storedProducts.some((item) => item.id === product.id)
    ? storedProducts.map((item) => (item.id === product.id ? product : item))
    : [product, ...storedProducts];
  writeStoredProducts(nextProducts);
  return product;
};

export const saveCustomProduct = async (input) => {
  const editableProducts = await getEditableProducts();
  const product = normalizeProduct(input, [...featuredProducts, ...editableProducts]);
  const payload = toDatabasePayload(product);

  try {
    const query = product.id && !String(product.id).startsWith('custom-')
      ? supabase.from('storefront_products').update(payload).eq('id', product.id)
      : supabase.from('storefront_products').insert(payload);

    const { data, error } = await query.select('*').single();

    if (error) {
      throw error;
    }

    window.dispatchEvent(new CustomEvent('dekito:products-updated'));
    return fromDatabaseRow(data);
  } catch (error) {
    console.warn('Saving storefront product locally because database save failed:', error.message || error);
    return saveLocalCustomProduct(input);
  }
};

export const deleteCustomProduct = async (id) => {
  try {
    const { error } = await supabase
      .from('storefront_products')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    window.dispatchEvent(new CustomEvent('dekito:products-updated'));
  } catch (error) {
    console.warn('Deleting local storefront product fallback:', error.message || error);
    const nextProducts = readStoredProducts().filter((product) => product.id !== id);
    writeStoredProducts(nextProducts);
  }
};

export const resetCustomProducts = async () => {
  try {
    const { error } = await supabase
      .from('storefront_products')
      .delete()
      .eq('source', 'custom');

    if (error) {
      throw error;
    }

    window.dispatchEvent(new CustomEvent('dekito:products-updated'));
  } catch (error) {
    console.warn('Resetting local storefront products fallback:', error.message || error);
    writeStoredProducts([]);
  }
};

export const deductInventoryForOrder = async (order) => {
  if (!order || order.inventoryDeducted || !Array.isArray(order.items)) {
    return [];
  }

  const stockItems = order.items.filter((item) => item.type !== 'bespoke_request');
  if (!stockItems.length) return [];

  const editableProducts = await getEditableProducts();
  const deductedEvents = [];
  const nextProducts = editableProducts.map((product) => {
    const matchingItems = stockItems.filter((item) => findProductForOrderItem([product], item));
    if (!matchingItems.length) return product;

    return matchingItems.reduce((currentProduct, item) => {
      const result = deductProductItemStock(currentProduct, item);
      if (result.deducted) {
        deductedEvents.push({
          productId: currentProduct.id,
          productSlug: currentProduct.slug,
          productName: currentProduct.name,
          variantId: item.variantId || '',
          size: item.size || '',
          quantity: Number(item.quantity || 1),
        });
      }
      return result.product;
    }, product);
  });

  const changedProducts = nextProducts.filter((product) => {
    const previous = editableProducts.find((item) => item.id === product.id);
    return previous && JSON.stringify(previous.variants) !== JSON.stringify(product.variants);
  });

  await Promise.all(changedProducts.map((product) => saveCustomProduct(product)));
  return deductedEvents;
};
