import {
  formatRupiah,
  getProductPriceRange,
  getProductStockTotal,
  getVisibleProductTags,
  normalizeProductImages,
  normalizeProductVariants,
} from '@/services/productCatalogService.js';
import { featuredProducts } from '@/data/storefront.js';

export const publicFragrances = [
  {
    id: 'hug',
    slug: 'hug',
    name: 'Hug',
    category: 'Skin musk',
    price: 'Rp 289.000',
    priceNumber: 289000,
    size: '30 ml',
    notes: 'Clean musk, iris, warm cotton',
    topNotes: ['Bergamot', 'Aldehydic linen', 'Pear skin'],
    heartNotes: ['Iris', 'White tea', 'Soft rose'],
    baseNotes: ['Clean musk', 'Ambrette', 'Sandalwood'],
    mood: 'Tender, close, quietly comforting',
    character: 'A low-volume perfume that feels like warmed fabric and skin after a long day.',
    concentration: 'Eau de Parfum',
    story: 'Hug is built as a soft personal atmosphere: intimate musk, powdered iris, and a warm cotton trace that stays close rather than announcing itself.',
    variants: ['10 ml', '30 ml', '50 ml'],
    materialHighlights: ['Clean musk trace', 'Orris butter'],
    featured: true,
  },
  {
    id: 'chant-nocturne',
    slug: 'chant-nocturne',
    name: 'Chant Nocturne',
    category: 'Floral amber',
    price: 'Rp 329.000',
    priceNumber: 329000,
    size: '30 ml',
    notes: 'Tuberose, pink pepper, amberwood',
    topNotes: ['Pink pepper', 'Mandarin peel', 'Black tea'],
    heartNotes: ['Tuberose', 'Jasmine petal', 'Orris'],
    baseNotes: ['Amberwood', 'Cashmere musk', 'Cedar'],
    mood: 'Luminous, magnetic, nocturnal',
    character: 'A white floral with a smoky amber frame and a quiet evening glow.',
    concentration: 'Eau de Parfum',
    story: 'Chant Nocturne studies the hour when flowers feel darker: creamy petals, subtle spice, and amber woods held in a restrained silhouette.',
    variants: ['10 ml', '30 ml'],
    materialHighlights: ['Tuberose absolute', 'Amberwood accord', 'Orris butter'],
    featured: true,
  },
  {
    id: 'jaipong',
    slug: 'jaipong',
    name: 'Jaipong',
    category: 'Spiced citrus',
    price: 'Rp 279.000',
    priceNumber: 279000,
    size: '30 ml',
    notes: 'Calamansi, clove leaf, vetiver',
    topNotes: ['Calamansi', 'Ginger', 'Green mandarin'],
    heartNotes: ['Clove leaf', 'Tea absolute', 'Violet leaf'],
    baseNotes: ['Vetiver', 'Cedar', 'Mineral musk'],
    mood: 'Rhythmic, bright, kinetic',
    character: 'A crisp citrus-spice composition with dry roots and green movement.',
    concentration: 'Eau de Toilette',
    story: 'Jaipong is composed around rhythm: citrus lift, clove-leaf pulse, and a dry vetiver base that keeps the motion elegant.',
    variants: ['10 ml', '30 ml', '50 ml'],
    materialHighlights: ['Vetiver fraction'],
    featured: true,
  },
  {
    id: 'porte-vers-le-paradis',
    slug: 'porte-vers-le-paradis',
    name: 'Porte vers le Paradis',
    category: 'Resin floral',
    price: 'Rp 349.000',
    priceNumber: 349000,
    size: '30 ml',
    notes: 'Neroli, incense, vanilla resin',
    topNotes: ['Neroli', 'Bitter orange', 'Cardamom'],
    heartNotes: ['Orange blossom', 'Frankincense', 'Honeyed tea'],
    baseNotes: ['Vanilla resin', 'Benzoin', 'Soft woods'],
    mood: 'Ceremonial, warm, luminous',
    character: 'A resinous floral doorway: bright blossom, smoke, and soft balsamic warmth.',
    concentration: 'Eau de Parfum',
    story: 'Porte vers le Paradis moves like a threshold between citrus light and incense shadow, finishing in polished vanilla resin.',
    variants: ['10 ml', '30 ml'],
    materialHighlights: ['Amberwood accord'],
    featured: false,
  },
  {
    id: 'trace-daventure',
    slug: 'trace-daventure',
    name: "Trace d'Aventure",
    category: 'Woody aromatic',
    price: 'Rp 309.000',
    priceNumber: 309000,
    size: '30 ml',
    notes: 'Fig leaf, cedar rain, moss',
    topNotes: ['Green fig', 'Grapefruit', 'Rain accord'],
    heartNotes: ['Cedarwood', 'Violet leaf', 'Clary sage'],
    baseNotes: ['Moss', 'Vetiver', 'Mineral amber'],
    mood: 'Open-air, green, composed',
    character: 'A fresh woody trail with wet leaves, clean cedar, and the mineral feeling of rain.',
    concentration: 'Eau de Parfum',
    story: "Trace d'Aventure keeps adventure quiet: a green path after rain, cedar under hand, and mossy air held close to skin.",
    variants: ['10 ml', '30 ml', '50 ml'],
    materialHighlights: ['Green fig leaf', 'Vetiver fraction'],
    featured: false,
  },
];

export const publicProductAliases = {
  '/hug': 'hug',
  '/chant-nocturne': 'chant-nocturne',
  '/jaipong': 'jaipong',
  '/porte-vers-le-paradis': 'porte-vers-le-paradis',
  '/trace-daventure': 'trace-daventure',
};

export const publicCatalogCategories = ['Semua', 'Gourmand', 'Aquatic', 'Woody', 'Floral'];

export const publicMaterials = [
  {
    name: 'Orris butter',
    origin: 'Italy / aged rhizome',
    family: 'Powdered woods',
    description: 'Cool violet dust, suede, and cosmetic softness with a long, intimate trace.',
    mood: 'Quiet, polished, intimate',
    usageStory: 'Used when a formula needs a powdered veil, a refined skin texture, or the feeling of a private keepsake.',
    relatedFragrances: ['hug', 'chant-nocturne'],
  },
  {
    name: 'Green fig leaf',
    origin: 'Mediterranean impression',
    family: 'Green aromatic',
    description: 'Milky leaf, pear skin, wet stem, and a clean bitter-green edge.',
    mood: 'Verdant, reflective, airy',
    usageStory: 'A material direction for outdoor memory: shaded leaves, morning humidity, and the clean snap of a broken stem.',
    relatedFragrances: ['trace-daventure'],
  },
  {
    name: 'Tuberose absolute',
    origin: 'India / cultivated white flowers',
    family: 'White floral',
    description: 'Creamed petals, warm skin, night air, and a luminous ceremonial floral body.',
    mood: 'Radiant, intimate, magnetic',
    usageStory: 'Reserved for nocturnal florals and ceremonial briefs where the perfume should feel luminous but close.',
    relatedFragrances: ['chant-nocturne'],
  },
  {
    name: 'Amberwood accord',
    origin: 'Atelier structure',
    family: 'Amber woods',
    description: 'Dry resin, modern woods, and polished depth used to give formulas architecture.',
    mood: 'Sculptural, warm, composed',
    usageStory: 'A structural material used to frame delicate notes, extend warmth, and give the composition a polished silhouette.',
    relatedFragrances: ['chant-nocturne', 'porte-vers-le-paradis'],
  },
  {
    name: 'Vetiver fraction',
    origin: 'Haiti / refined root material',
    family: 'Dry woods',
    description: 'Earth, smoke, mineral grass, and a tailored woody dryness.',
    mood: 'Grounded, elegant, restrained',
    usageStory: 'Chosen for green-woody trails, rain-washed atmospheres, and formulas that need rooted elegance.',
    relatedFragrances: ['jaipong', 'trace-daventure'],
  },
  {
    name: 'Clean musk trace',
    origin: 'Soft musk palette',
    family: 'Skin musk',
    description: 'Transparent linen, warmed skin, and a low-volume trail made for daily ritual.',
    mood: 'Tactile, close, serene',
    usageStory: 'Used to create intimacy and soft diffusion: the sensation of clean fabric, skin warmth, and quiet persistence.',
    relatedFragrances: ['hug'],
  },
];

export const publicJournalArticles = [
  {
    category: 'Scent Memory',
    title: 'Fragrance as a memory object',
    date: 'Atelier Note / 2026',
    text: 'How a private place, repeated gesture, or remembered person becomes the structure of a perfume brief.',
  },
  {
    category: 'Raw Materials',
    title: 'Reading woods, musks, and green shadows',
    date: 'Material Field Note / 2026',
    text: 'A material note on texture, volatility, and the quiet decisions that make a fragrance feel tactile.',
  },
  {
    category: 'Atelier Process',
    title: 'From lab note to finished bottle',
    date: 'Process Journal / 2026',
    text: 'The rhythm of weighing, resting, evaluating, refining, and finishing a small perfume batch.',
  },
  {
    category: 'Product Stories',
    title: 'Why quiet perfume can still feel unforgettable',
    date: 'Collection Note / 2026',
    text: 'A look at restraint, diffusion, skin warmth, and the kind of presence that does not need volume.',
  },
  {
    category: 'Perfumery Culture',
    title: 'The small etiquette of wearing scent',
    date: 'Culture Note / 2026',
    text: 'A practical editorial note on projection, intimacy, weather, and choosing fragrance for shared rooms.',
  },
];

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

const materialNames = publicMaterials.map((material) => material.name);

const inferMaterialHighlights = (product = {}) => {
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
    source: product.source === 'custom' ? 'studio-public' : (product.source || 'public-fallback'),
  };
};

export const getPublicFragranceCatalog = (studioProducts = []) => {
  const studioSource = studioProducts.length ? [...studioProducts, ...featuredProducts] : featuredProducts;
  const mappedStudioProducts = studioSource.map(toPublicFragrance);
  const fallbackProducts = publicFragrances.map(toPublicFragrance);
  const merged = [...mappedStudioProducts, ...fallbackProducts];
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

export const getPublicMaterialArchive = (catalog = publicFragrances) => (
  publicMaterials.map((material) => ({
    ...material,
    relatedFragranceReferences: (material.relatedFragrances || [])
      .map((slug) => catalog.find((fragrance) => fragrance.slug === slug))
      .filter(Boolean)
      .map((fragrance) => ({
        slug: fragrance.slug,
        name: fragrance.name,
      })),
  }))
);
