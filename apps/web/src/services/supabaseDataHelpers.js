import supabase from '@/lib/supabaseClient.js';

export const getCurrentUserId = async () => {
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

export const toAppRecord = (row) => ({
  ...row,
  created: row.created_at,
  updated: row.updated_at,
});

export const fetchRawMaterialsMap = async (ids) => {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('raw_materials')
    .select('*')
    .in('id', uniqueIds);

  if (error) {
    throw new Error(error.message || 'Failed to load raw materials');
  }

  return new Map((data || []).map((row) => [row.id, toAppRecord(row)]));
};

export const fetchAccordsMap = async (ids) => {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('accords')
    .select('*')
    .in('id', uniqueIds);

  if (error) {
    throw new Error(error.message || 'Failed to load accords');
  }

  return new Map((data || []).map((row) => [row.id, toAppRecord(row)]));
};

export const fetchFormulasMap = async (ids) => {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('formulas')
    .select('*')
    .in('id', uniqueIds);

  if (error) {
    throw new Error(error.message || 'Failed to load formulas');
  }

  return new Map((data || []).map((row) => [row.id, toAppRecord(row)]));
};
