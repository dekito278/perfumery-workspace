import supabase from '@/lib/supabaseClient.js';
import { PERFUMERS_WORLD_CATEGORIES, PERFUMERS_WORLD_CATEGORY_VALUES } from '@/utils/perfumersWorldCategories.js';
import { ECOFRAGRANTICA_SCENT_TAXONOMY } from '@/utils/ecofragranticaScentTaxonomy.js';

const ECOFRAGRANTICA_CATEGORY_VALUES = new Set(
  ECOFRAGRANTICA_SCENT_TAXONOMY.map((family) => family.label.toLowerCase()),
);

const mapCategory = (row) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  user_id: row.user_id,
  created: row.created_at,
  updated: row.updated_at,
});

// The 11 grandfamilies are seeded the way the 26 A-Z rows used to be. The A-Z rows are NOT deleted here:
// materials still filed under them would lose their option mid-session, and a combobox whose current
// value is absent from its list is one save away from blanking the field. The migration removes them
// once nothing points at them any more.
const synchronizeScentTaxonomyCategories = async (userId, existingCategories) => {
  const existingNames = new Set((existingCategories || []).map((category) => category.name.toLowerCase()));
  const missingCategories = ECOFRAGRANTICA_SCENT_TAXONOMY
    .map((family) => ({ label: family.label, color: family.color }))
    .filter((category) => !existingNames.has(category.label.toLowerCase()));

  if (!missingCategories.length) {
    return existingCategories;
  }

  const { data, error } = await supabase
    .from('raw_material_categories')
    .insert(
      missingCategories.map((category) => ({
        user_id: userId,
        name: category.label,
        color: category.color,
      }))
    )
    .select('*');

  if (error) {
    console.error('Error synchronizing standard perfumery categories:', error);
    return existingCategories;
  }

  return [...(existingCategories || []), ...(data || []).map(mapCategory)];
};

const getCurrentUserId = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message || 'Failed to read authenticated user');
  }

  if (!user) {
    throw new Error('User not authenticated');
  }

  return user.id;
};

export const getRawMaterialCategories = async () => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('raw_material_categories')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching raw material categories:', error);
    throw new Error('Failed to load categories');
  }

  const mappedCategories = (data || []).map(mapCategory);
  const synchronizedCategories = await synchronizeScentTaxonomyCategories(userId, mappedCategories);
  // Grandfamilies first, then any legacy A-Z row that is still around. Both are accepted until the
  // migration has moved the data across — dropping the legacy ones early would leave every unmigrated
  // material with a category the dropdown cannot show.
  const categoryOrderMap = new Map([
    ...ECOFRAGRANTICA_SCENT_TAXONOMY.map((family, index) => [family.label.toLowerCase(), index]),
    ...PERFUMERS_WORLD_CATEGORIES.map((category, index) => [
      category.label.toLowerCase(),
      ECOFRAGRANTICA_SCENT_TAXONOMY.length + index,
    ]),
  ]);

  return synchronizedCategories
    .filter((category) => ECOFRAGRANTICA_CATEGORY_VALUES.has(category.name.toLowerCase())
      || PERFUMERS_WORLD_CATEGORY_VALUES.has(category.name.toLowerCase()))
    .sort((left, right) => {
    const leftOrder = categoryOrderMap.get(left.name.toLowerCase());
    const rightOrder = categoryOrderMap.get(right.name.toLowerCase());

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder;
    }

    if (leftOrder !== undefined) {
      return -1;
    }

    if (rightOrder !== undefined) {
      return 1;
    }
      return left.name.localeCompare(right.name);
    });
};

export const createRawMaterialCategory = async (payload) => {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('raw_material_categories')
    .insert({
      user_id: userId,
      name: payload.name,
      color: payload.color,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating raw material category:', error);
    throw new Error(error.message || 'Failed to create category');
  }

  return mapCategory(data);
};

export const updateRawMaterialCategory = async (id, payload) => {
  const { data, error } = await supabase
    .from('raw_material_categories')
    .update({
      name: payload.name,
      color: payload.color,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating raw material category:', error);
    throw new Error(error.message || 'Failed to update category');
  }

  return mapCategory(data);
};

export const deleteRawMaterialCategory = async (id) => {
  const { error } = await supabase
    .from('raw_material_categories')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting raw material category:', error);
    throw new Error(error.message || 'Failed to delete category');
  }
};
