import supabase from '@/lib/supabaseClient.js';

export const getCurrentUserId = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message || 'Gagal membaca akun yang sedang masuk');
  }

  if (!user) {
    throw new Error('Sesi studio berakhir. Masuk lagi.');
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
    throw new Error(error.message || 'Gagal memuat bahan baku');
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
    throw new Error(error.message || 'Gagal memuat akord');
  }

  return new Map((data || []).map((row) => [row.id, toAppRecord(row)]));
};

