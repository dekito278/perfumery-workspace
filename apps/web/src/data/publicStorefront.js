import {
  formatRupiah,
  getProductPriceRange,
  getProductStockTotal,
  getVisibleProductTags,
  normalizeProductImages,
  normalizeProductVariants,
} from '@/services/productCatalogService.js';

const splitList = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const slugify = (value) => String(value || 'fragrance')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'fragrance';

const formatVariantPrice = (variant, fallbackPrice) => (
  Number(variant?.priceNumber || 0) > 0 ? formatRupiah(variant.priceNumber) : fallbackPrice
);

const inferPublicCategory = (product = {}, tags = []) => {
  const searchText = [
    product.category,
    product.collection,
    product.notes,
    product.mood,
    product.description,
    ...tags,
  ].join(' ').toLowerCase();

  if (/gourmand|vanilla|cacao|tonka|caramel|coffee|honey/.test(searchText)) return 'Gourmand';
  if (/aquatic|marine|rain|mineral|fresh|citrus|calamansi|grapefruit/.test(searchText)) return 'Aquatic';
  if (/woody|wood|cedar|sandal|vetiver|moss|resin|amber/.test(searchText)) return 'Woody';
  if (/floral|rose|iris|orris|tuberose|jasmine|neroli|blossom/.test(searchText)) return 'Floral';
  return product.publicCategory || 'Woody';
};

const inferPublicBadge = (product = {}, tags = []) => {
  const explicit = product.badge || product.label;
  if (explicit) return String(explicit).toUpperCase();
  const tagBadge = tags.find((tag) => /limited|thematic|pilihan|new|signature/i.test(tag));
  if (tagBadge) return String(tagBadge).toUpperCase();
  if (product.featured) return 'PILIHAN';
  if (/custom|bespoke|thematic/i.test(product.category || product.collection || '')) return 'THEMATIC';
  return 'LIMITED';
};

const normalizePublicVariants = (product = {}, publicPrice) => (
  normalizeProductVariants(product).map((variant) => ({
    id: String(variant.id || slugify(variant.size)),
    size: variant.size || product.size || '30 ml',
    price: formatVariantPrice(variant, publicPrice),
    priceNumber: Number(variant.priceNumber || product.priceNumber || 0),
    availability: Number(variant.stock ?? product.stock ?? 0) > 0 ? 'Available' : 'Inquire',
  }))
);

const inferMaterialHighlights = (product = {}) => {
  if (Array.isArray(product.materialHighlights) && product.materialHighlights.length) {
    return product.materialHighlights;
  }

  const materialNames = splitList(product.materialHighlights || product.materials || product.rawMaterials);
  const searchText = [
    product.notes,
    product.description,
    product.mood,
    ...(splitList(product.topNotes)),
    ...(splitList(product.heartNotes)),
    ...(splitList(product.baseNotes)),
    ...(splitList(product.tags)),
  ].join(' ').toLowerCase();

  return materialNames.filter((materialName) => (
    materialName
      .toLowerCase()
      .split(/\s+/)
      .some((token) => token.length > 3 && searchText.includes(token))
  )).slice(0, 3);
};

export const toPublicFragrance = (product = {}, index = 0) => {
  const variants = normalizePublicVariants(product, product.price || 'Price on request');
  const priceNumber = getProductPriceRange(normalizeProductVariants(product)) || Number(product.priceNumber || 0);
  const price = priceNumber > 0 ? formatRupiah(priceNumber) : (product.price || 'Price on request');
  const images = normalizeProductImages(product);
  const tags = getVisibleProductTags(product);
  const publicStatus = getProductStockTotal(normalizeProductVariants(product)) > 0 ? 'Available' : 'Made to order';
  const slug = slugify(product.slug || product.name || product.id);
  const topNotes = splitList(product.topNotes);
  const heartNotes = splitList(product.heartNotes);
  const baseNotes = splitList(product.baseNotes);
  const publicCategory = inferPublicCategory(product, tags);

  return {
    id: String(product.id || slug),
    slug,
    name: String(product.name || 'Untitled fragrance').trim(),
    subtitle: product.subtitle || product.notes || product.mood || 'A quiet SOLIVAGANT fragrance object.',
    description: product.description || product.notes || 'A quiet SOLIVAGANT fragrance object for skin, atmosphere, and ritual.',
    story: product.story || product.description || 'A public SOLIVAGANT fragrance composed through raw materials, memory, and careful evaluation.',
    category: product.category || product.collection || tags[0] || 'Atelier fragrance',
    publicCategory,
    badge: inferPublicBadge(product, tags),
    collection: product.collection || product.category || 'SOLIVAGANT Atelier',
    topNotes: topNotes.length ? topNotes : ['Opening impression'],
    heartNotes: heartNotes.length ? heartNotes : ['Atelier heart'],
    baseNotes: baseNotes.length ? baseNotes : ['Lasting trace'],
    notes: product.notes || [...topNotes.slice(0, 1), ...heartNotes.slice(0, 1), ...baseNotes.slice(0, 1)].filter(Boolean).join(', '),
    mood: product.mood || product.character || 'Quiet, composed, personal',
    character: product.character || product.mood || 'A refined signature with measured projection.',
    concentration: product.concentration || 'Eau de Parfum',
    variants,
    sizeVariants: variants,
    size: variants[0]?.size || product.size || '30 ml',
    price,
    priceNumber,
    imageUrl: images[0] || product.imageUrl || '',
    images,
    visual: product.visual,
    availability: product.availability || publicStatus,
    publicStatus,
    materialHighlights: product.materialHighlights || inferMaterialHighlights(product),
    relatedFragrances: product.relatedFragrances || [],
    featured: Boolean(product.featured || index < 3),
    source: product.source === 'custom' ? 'studio-public' : (product.source || 'studio-public'),
  };
};

export const getPublicFragranceCatalog = (studioProducts = []) => {
  const mappedStudioProducts = studioProducts.map(toPublicFragrance);
  const merged = mappedStudioProducts;
  return Array.from(new Map(merged.map((product) => [product.slug, product])).values())
    .map((product, index, catalog) => ({
      ...product,
      relatedFragrances: product.relatedFragrances.length
        ? product.relatedFragrances
        : catalog.filter((item) => item.slug !== product.slug && item.category === product.category).slice(0, 3).map((item) => item.slug),
    }));
};

export const findPublicFragrance = (slug, studioProducts = []) => (
  getPublicFragranceCatalog(studioProducts).find((fragrance) => fragrance.slug === slug || fragrance.id === slug)
);
