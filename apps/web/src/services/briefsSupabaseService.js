import supabase from '@/lib/supabaseClient.js';
import { getCurrentUserId, toAppRecord } from '@/services/supabaseDataHelpers.js';

const normalizeBriefPayload = (briefData) => ({
  title: String(briefData.title || '').trim(),
  formula_id: briefData.formula_id || null,
  status: briefData.status || 'draft',
  mood_story: briefData.mood_story ? String(briefData.mood_story).trim() : null,
  audience_usage: briefData.audience_usage ? String(briefData.audience_usage).trim() : null,
  performance_target: briefData.performance_target ? String(briefData.performance_target).trim() : null,
  budget_direction: briefData.budget_direction ? String(briefData.budget_direction).trim() : null,
});

export const getBriefs = async () => {
  const { data, error } = await supabase
    .from('briefs')
    .select('*')
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching briefs:', error);
    throw new Error(error.message || 'Failed to fetch briefs');
  }

  return (data || []).map(toAppRecord);
};

export const createBrief = async (briefData) => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('briefs')
    .insert({
      user_id: userId,
      ...normalizeBriefPayload(briefData),
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating brief:', error);
    throw new Error(error.message || 'Failed to create brief');
  }

  return toAppRecord(data);
};

export const updateBrief = async (briefId, briefData) => {
  const { data, error } = await supabase
    .from('briefs')
    .update(normalizeBriefPayload(briefData))
    .eq('id', briefId)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating brief:', error);
    throw new Error(error.message || 'Failed to update brief');
  }

  return toAppRecord(data);
};

export const deleteBrief = async (briefId) => {
  const { error } = await supabase
    .from('briefs')
    .delete()
    .eq('id', briefId);

  if (error) {
    console.error('Error deleting brief:', error);
    throw new Error(error.message || 'Failed to delete brief');
  }
};
