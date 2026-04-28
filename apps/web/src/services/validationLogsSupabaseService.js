import supabase from '@/lib/supabaseClient.js';
import { getCurrentUserId, toAppRecord } from '@/services/supabaseDataHelpers.js';

const normalizeValidationLogPayload = (logData) => ({
  formula_id: String(logData.formula_id || '').trim(),
  revision_label: logData.revision_label ? String(logData.revision_label).trim() : null,
  test_type: logData.test_type || 'revision',
  status: logData.status || 'logged',
  note: String(logData.note || '').trim(),
  next_action: logData.next_action ? String(logData.next_action).trim() : null,
  evaluator_name: logData.evaluator_name ? String(logData.evaluator_name).trim() : null,
  tested_at: logData.tested_at || new Date().toISOString().slice(0, 10),
});

export const getValidationLogs = async ({ formulaId } = {}) => {
  let query = supabase
    .from('validation_logs')
    .select('*')
    .order('tested_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (formulaId) {
    query = query.eq('formula_id', formulaId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching validation logs:', error);
    throw new Error(error.message || 'Failed to fetch validation logs');
  }

  return (data || []).map(toAppRecord);
};

export const createValidationLog = async (logData) => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('validation_logs')
    .insert({
      user_id: userId,
      ...normalizeValidationLogPayload(logData),
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating validation log:', error);
    throw new Error(error.message || 'Failed to create validation log');
  }

  return toAppRecord(data);
};

export const updateValidationLog = async (logId, logData) => {
  const { data, error } = await supabase
    .from('validation_logs')
    .update(normalizeValidationLogPayload(logData))
    .eq('id', logId)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating validation log:', error);
    throw new Error(error.message || 'Failed to update validation log');
  }

  return toAppRecord(data);
};

export const deleteValidationLog = async (logId) => {
  const { error } = await supabase
    .from('validation_logs')
    .delete()
    .eq('id', logId);

  if (error) {
    console.error('Error deleting validation log:', error);
    throw new Error(error.message || 'Failed to delete validation log');
  }
};
