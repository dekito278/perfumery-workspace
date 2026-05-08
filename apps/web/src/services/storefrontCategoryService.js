import supabase from '@/lib/supabaseClient.js';

export const STOREFRONT_CATEGORY_STORAGE_KEY = 'dekito.storefront.categories.v1';
export const STOREFRONT_CATEGORY_UPDATED_EVENT = 'dekito:storefront-categories-updated';

const ACCENT_CLASSES = [
  'bg-[#eef2e8] text-[#263d27] border-[#263d27]/15',
  'bg-[#f4f2ec] text-[#263d27] border-[#263d27]/15',
  'bg-[#e7ebe1] text-[#263d27] border-[#263d27]/15',
  'bg-[#f7f8f2] text-[#263d27] border-[#263d27]/15',
];

const DEFAULT_SCENT_FAMILIES = [
  { name: 'Gourmand', description: 'Vanilla, caramel, chocolate, coffee, and edible sweet notes.' },
  { name: 'Aquatic', description: 'Clean water, marine breeze, airy mineral freshness.' },
  { name: 'Woody', description: 'Sandalwood, cedar, vetiver, dry woods, and resinous texture.' },
  { name: 'Floral', description: 'Rose, jasmine, white florals, powdery petals.' },
  { name: 'Citrus', description: 'Bergamot, lemon, orange, grapefruit, sparkling freshness.' },
  { name: 'Amber', description: 'Warm resin, vanilla, labdanum, balsamic depth.' },
  { name: 'Fresh', description: 'Clean musk, green notes, tea, and crisp aromatics.' },
];

const makeLocalId = () => `local-category-${Date.now()}`;

const getAccentForName = (name) => {
  const index = Math.abs(String(name || '')
    .split('')
    .reduce((sum, character) => sum + character.charCodeAt(0), 0)) % ACCENT_CLASSES.length;
  return ACCENT_CLASSES[index];
};

export const normalizeCategoryName = (name) => String(name || '').trim().replace(/\s+/g, ' ');

export const buildCategoryFromProductName = (name) => {
  const normalizedName = normalizeCategoryName(name);
  return {
    id: `product-category-${normalizedName.toLowerCase()}`,
    name: normalizedName,
    description: `Produk dengan kategori ${normalizedName}.`,
    accent: getAccentForName(normalizedName),
    sortOrder: 100,
    source: 'product',
  };
};

const defaultScentFamilies = () => DEFAULT_SCENT_FAMILIES.map((category, index) => ({
  id: `default-scent-family-${category.name.toLowerCase()}`,
  name: category.name,
  description: category.description,
  accent: getAccentForName(category.name),
  sortOrder: index + 1,
  source: 'default',
}));

const mapCategory = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  accent: row.accent || getAccentForName(row.name),
  sortOrder: row.sort_order ?? row.sortOrder ?? 100,
  source: row.source || 'custom',
  created: row.created_at,
  updated: row.updated_at,
});

const readStoredCategories = () => {
  if (typeof window === 'undefined') return [];

  try {
    const value = window.localStorage.getItem(STOREFRONT_CATEGORY_STORAGE_KEY);
    return value ? JSON.parse(value).map(mapCategory) : [];
  } catch (error) {
    return [];
  }
};

const writeStoredCategories = (categories) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STOREFRONT_CATEGORY_STORAGE_KEY, JSON.stringify(categories));
  window.dispatchEvent(new CustomEvent(STOREFRONT_CATEGORY_UPDATED_EVENT));
};

export const dispatchStorefrontCategoryUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STOREFRONT_CATEGORY_UPDATED_EVENT));
  }
};

export const getLocalStorefrontCategories = () => [...defaultScentFamilies(), ...readStoredCategories()];

export const getStorefrontCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('storefront_product_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return [...defaultScentFamilies(), ...(data || []).map(mapCategory)];
  } catch (error) {
    console.warn('Using local storefront categories fallback:', error.message || error);
    return getLocalStorefrontCategories();
  }
};

export const saveStorefrontCategory = async (input) => {
  const name = normalizeCategoryName(input.name);
  if (!name) {
    throw new Error('Category name is required');
  }

  const category = {
    id: input.id || makeLocalId(),
    name,
    description: String(input.description || '').trim(),
    accent: input.accent || getAccentForName(name),
    sortOrder: Number(input.sortOrder ?? input.sort_order ?? 100),
  };

  try {
    const payload = {
      name: category.name,
      description: category.description,
      accent: category.accent,
      sort_order: category.sortOrder,
    };
    const query = category.id && !String(category.id).startsWith('local-category-') && !String(category.id).startsWith('product-category-')
      ? supabase.from('storefront_product_categories').update(payload).eq('id', category.id)
      : supabase.from('storefront_product_categories').upsert(payload, { onConflict: 'name' });
    const { data, error } = await query.select('*').single();

    if (error) {
      throw error;
    }

    dispatchStorefrontCategoryUpdate();
    return mapCategory(data);
  } catch (error) {
    console.warn('Saving storefront category locally because database save failed:', error.message || error);
    const storedCategories = readStoredCategories();
    const nextCategory = mapCategory({ ...category, sort_order: category.sortOrder, source: 'custom' });
    const nextCategories = storedCategories.some((item) => item.id === nextCategory.id || item.name.toLowerCase() === nextCategory.name.toLowerCase())
      ? storedCategories.map((item) => (
        item.id === nextCategory.id || item.name.toLowerCase() === nextCategory.name.toLowerCase()
          ? { ...item, ...nextCategory, id: item.id }
          : item
      ))
      : [...storedCategories, nextCategory];
    writeStoredCategories(nextCategories);
    return nextCategory;
  }
};

export const deleteStorefrontCategory = async (id) => {
  try {
    const { error } = await supabase
      .from('storefront_product_categories')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    dispatchStorefrontCategoryUpdate();
  } catch (error) {
    console.warn('Deleting local storefront category fallback:', error.message || error);
    writeStoredCategories(readStoredCategories().filter((category) => category.id !== id));
  }
};
