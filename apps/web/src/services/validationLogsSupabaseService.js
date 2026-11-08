import supabase from '@/lib/supabaseClient.js';
import { shopToday } from '@/utils/localDay.js';
import { getCurrentUserId, toAppRecord } from '@/services/supabaseDataHelpers.js';

// `value` is what validation_logs stores and what every screen filters on; only `label` is for people.
export const VALIDATION_TEST_TYPES = [
  { value: 'blotter', label: 'Blotter' },
  { value: 'skin', label: 'Kulit' },
  { value: 'stability', label: 'Stabilitas' },
  { value: 'revision', label: 'Revisi' },
  { value: 'other', label: 'Lainnya' },
];

export const VALIDATION_STATUSES = [
  { value: 'logged', label: 'Tercatat' },
  { value: 'action_needed', label: 'Perlu aksi' },
  { value: 'approved', label: 'Disetujui' },
];

const labelOf = (options, value) => options.find((option) => option.value === value)?.label || value;
export const validationTestTypeLabel = (value) => labelOf(VALIDATION_TEST_TYPES, value || 'revision');
export const validationStatusLabel = (value) => labelOf(VALIDATION_STATUSES, value || 'logged');

const normalizeValidationLogPayload = (logData) => ({
  formula_id: String(logData.formula_id || '').trim(),
  revision_label: logData.revision_label ? String(logData.revision_label).trim() : null,
  test_type: logData.test_type || 'revision',
  status: logData.status || 'logged',
  note: String(logData.note || '').trim(),
  next_action: logData.next_action ? String(logData.next_action).trim() : null,
  evaluator_name: logData.evaluator_name ? String(logData.evaluator_name).trim() : null,
  tested_at: logData.tested_at || shopToday(),
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
    throw new Error(error.message || 'Gagal mengambil catatan uji');
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
    throw new Error(error.message || 'Gagal membuat catatan uji');
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
    throw new Error(error.message || 'Gagal memperbarui catatan uji');
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
    throw new Error(error.message || 'Gagal menghapus catatan uji');
  }
};
