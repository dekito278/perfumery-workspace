import {
  formatRupiah,
  getPrimaryVariant,
  getProductPriceRange,
  getProductStockTotal,
  getVisibleProductTags,
  normalizeProductImages,
  normalizeProductVariants,
} from '@/services/productCatalogService.js';
import { normalizeWear } from '@/utils/productWear.js';

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
  // What the owner actually set wins. Inferring over the top of it split the shop into two vocabularies
  // on one screen: the cards read "Limited" and "Fresh" from this field while the filter pills read the
  // guessed one and offered "Aquatic", which no card ever showed. Ten of eighteen products are Limited —
  // the most expensive ones — and there was no way to filter for them.
  const explicit = String(product.category || '').trim();
  if (explicit) return explicit;

  // Only a product with no category at all falls back to guessing from its notes and description.
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

const normalizePublicVariants = (product = {}, publicPrice) => {
  // The tier fields have to be read back from the product's OWN variants, not from the output of
  // normalizeProductVariants. That normalizer rebuilds every variant through createProductVariant, which
  // is a hand-listed whitelist of five fields — so retailPriceNumber and memberPriceNumber were gone
  // before this mapper ever saw them, and the two lines below carrying them "across" carried undefined.
  //
  // It cost a real price: applyTierPrices lowers a member's priceNumber and keeps the original as
  // retailPriceNumber, the international price is built on retail, and with retail missing on the
  // variant the member discount was multiplied into the export price. A signed-in buyer in Singapore
  // saw US$45 where an anonymous one saw US$50.
  const bySourceId = new Map((Array.isArray(product.variants) ? product.variants : [])
    .map((variant, index) => [String(variant?.id || slugify(variant?.size) || `variant-${index + 1}`), variant]));

  return normalizeProductVariants(product).map((variant) => {
    const source = bySourceId.get(String(variant.id)) || {};
    return {
    id: String(variant.id || slugify(variant.size)),
    size: variant.size || product.size || '30 ml',
    price: formatVariantPrice(variant, publicPrice),
    priceNumber: Number(variant.priceNumber || product.priceNumber || 0),
    // Carried, not recomputed: a tier price rewrote priceNumber upstream and this is what it replaced.
    retailPriceNumber: source.retailPriceNumber ?? variant.retailPriceNumber,
    // Member price for a signed-out visitor (#147). Every field this mapper does not name is dropped —
    // it was rebuilt here without this one and the nudge rendered nowhere on the live site.
    memberPriceNumber: source.memberPriceNumber ?? variant.memberPriceNumber,
    compareAtPriceNumber: Number(variant.compareAtPriceNumber || 0),
    stock: Math.max(0, Math.floor(Number(variant.stock ?? product.stock ?? 0)) || 0),
    availability: Number(variant.stock ?? product.stock ?? 0) > 0 ? 'Available' : 'Inquire',
    };
  });
};

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

export const toPublicFragrance = (product = {}) => {
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
    // The LIMITED badge, carried as its own field so the catalogue card can print it beside the scent
    // family instead of INSTEAD of it. `category` used to hold the word, which is why ten perfumes
    // answered "how rare am I" to a filter asking "what do you smell of".
    limited: Boolean(product.limited) || String(product.category || '').trim().toLowerCase() === 'limited',
    collection: product.collection || product.category || 'SOLIVAGANT Atelier',
    topNotes: topNotes.length ? topNotes : ['Opening impression'],
    heartNotes: heartNotes.length ? heartNotes : ['Atelier heart'],
    baseNotes: baseNotes.length ? baseNotes : ['Lasting trace'],
    notes: product.notes || [...topNotes.slice(0, 1), ...heartNotes.slice(0, 1), ...baseNotes.slice(0, 1)].filter(Boolean).join(', '),
    // The English copy, carried through untouched and WITHOUT a fallback: an empty string here means
    // "not translated yet", and productCopyFor decides what to show instead. Filling in an Indonesian
    // fallback at this layer would make "translated" indistinguishable from "not".
    descriptionEn: product.descriptionEn || '',
    notesEn: product.notesEn || '',
    topNotesEn: Array.isArray(product.topNotesEn) ? product.topNotesEn : [],
    heartNotesEn: Array.isArray(product.heartNotesEn) ? product.heartNotesEn : [],
    baseNotesEn: Array.isArray(product.baseNotesEn) ? product.baseNotesEn : [],
    mood: product.mood || product.character || 'Quiet, composed, personal',
    character: product.character || product.mood || 'A refined signature with measured projection.',
    concentration: product.concentration || 'Eau de Parfum',
    // Both product forms have an "Intensitas" select and it was landing nowhere: written, stored, and
    // dropped here. Same omission as compareAtPriceNumber, found the same way.
    intensity: product.intensity || '',
    variants,
    sizeVariants: variants,
    // The same bottle the price came from — getProductPriceRange is a minimum, so pairing it with
    // variants[0]'s size would label the cheapest price with a size that is not the cheapest.
    size: getPrimaryVariant(variants)?.size || product.size || '30 ml',
    price,
    priceNumber,
    // Which tier this price came from, and what retail would have been. Display only — the order
    // endpoint resolves both again from the buyer's own session.
    priceTier: product.priceTier || 'retail',
    retailPriceNumber: product.retailPriceNumber,
    memberPriceNumber: product.memberPriceNumber,
    // "Harga coret". Four Studio inputs wrote this and every one of them was inert, because this mapper
    // lists its fields by hand and this one was never on the list.
    compareAtPriceNumber: Number(getPrimaryVariant(variants)?.compareAtPriceNumber || product.compareAtPriceNumber || 0),
    imageUrl: images[0] || product.imageUrl || '',
    images,
    visual: product.visual,
    availability: product.availability || publicStatus,
    publicStatus,
    wear: normalizeWear(product.wear),
    materialHighlights: product.materialHighlights || inferMaterialHighlights(product),
    relatedFragrances: product.relatedFragrances || [],
    // The flag as set in Studio, nothing more. Forcing the first three to true made "featured" mean
    // "sorted first" and left the real flag with nothing to do — see utils/featuredProducts.js.
    featured: Boolean(product.featured),
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
