import supabase from '@/lib/supabaseClient.js';
import { fetchRawMaterialsMap, getCurrentUserId, toAppRecord } from '@/services/supabaseDataHelpers.js';

const mapShortlistRow = (row, materialsMap = new Map()) => ({
  ...toAppRecord(row),
  expand: {
    raw_material_id: materialsMap.get(row.raw_material_id) || null,
  },
});

export const getBriefMaterialShortlist = async (briefId) => {
  const { data, error } = await supabase
    .from('brief_material_shortlists')
    .select('*')
    .eq('brief_id', briefId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching brief material shortlist:', error);
    throw new Error(error.message || 'Failed to fetch brief material shortlist');
  }

  const materialsMap = await fetchRawMaterialsMap((data || []).map((row) => row.raw_material_id));
  return (data || []).map((row) => mapShortlistRow(row, materialsMap));
};

export const getBriefMaterialShortlistsByBriefIds = async (briefIds) => {
  const uniqueIds = [...new Set((briefIds || []).filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('brief_material_shortlists')
    .select('*')
    .in('brief_id', uniqueIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching brief material shortlists by brief ids:', error);
    throw new Error(error.message || 'Failed to fetch shortlist summary');
  }

  const materialsMap = await fetchRawMaterialsMap((data || []).map((row) => row.raw_material_id));
  const grouped = new Map(uniqueIds.map((id) => [id, []]));
  (data || []).forEach((row) => {
    const current = grouped.get(row.brief_id) || [];
    current.push(mapShortlistRow(row, materialsMap));
    grouped.set(row.brief_id, current);
  });

  return grouped;
};

export const upsertBriefMaterialShortlist = async (briefId, items) => {
  const userId = await getCurrentUserId();
  const payload = (items || []).map((item) => ({
    user_id: userId,
    brief_id: briefId,
    raw_material_id: String(item.raw_material_id),
    role: item.role || 'candidate',
    note: item.note ? String(item.note).trim() : null,
  }));

  if (!payload.length) {
    return [];
  }

  const { error } = await supabase
    .from('brief_material_shortlists')
    .upsert(payload, { onConflict: 'brief_id,raw_material_id' });

  if (error) {
    console.error('Error upserting brief material shortlist:', error);
    throw new Error(error.message || 'Failed to save shortlist');
  }

  return getBriefMaterialShortlist(briefId);
};

export const deleteBriefMaterialShortlistItem = async (itemId) => {
  const { error } = await supabase
    .from('brief_material_shortlists')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('Error deleting shortlist item:', error);
    throw new Error(error.message || 'Failed to delete shortlist item');
  }
};
