import supabase from '@/lib/supabaseClient.js';
import { PERFUMERS_WORLD_CATEGORIES, PERFUMERS_WORLD_CATEGORY_VALUES } from '@/utils/perfumersWorldCategories.js';

const mapCategory = (row) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  user_id: row.user_id,
  created: row.created_at,
  updated: row.updated_at,
});

const synchronizePerfumersWorldCategories = async (userId, existingCategories) => {
  const existingNames = new Set((existingCategories || []).map((category) => category.name.toLowerCase()));
  const missingCategories = PERFUMERS_WORLD_CATEGORIES.filter(
    (category) => !existingNames.has(category.label.toLowerCase())
  );

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
  const synchronizedCategories = await synchronizePerfumersWorldCategories(userId, mappedCategories);
  const categoryOrderMap = new Map(
    PERFUMERS_WORLD_CATEGORIES.map((category, index) => [category.label.toLowerCase(), index])
  );

  return synchronizedCategories
    .filter((category) => PERFUMERS_WORLD_CATEGORY_VALUES.has(category.name.toLowerCase()))
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
