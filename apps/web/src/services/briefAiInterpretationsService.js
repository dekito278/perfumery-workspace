import supabase from '@/lib/supabaseClient.js';
import { getCurrentUserId, toAppRecord } from '@/services/supabaseDataHelpers.js';

const mapBriefAiInterpretationRow = (row) => ({
  ...toAppRecord(row),
  intent_payload: row.intent_payload || {},
  confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
});

export const getLatestBriefAiInterpretation = async (briefId) => {
  if (!briefId) {
    return null;
  }

  const { data, error } = await supabase
    .from('brief_ai_interpretations')
    .select('*')
    .eq('brief_id', briefId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching brief AI interpretation:', error);
    throw new Error(error.message || 'Failed to fetch brief AI interpretation');
  }

  return data ? mapBriefAiInterpretationRow(data) : null;
};

export const createBriefAiInterpretation = async ({
  briefId,
  inputText,
  intentPayload,
  model = '',
  confidence = null,
  source = 'ai',
  fallbackReason = '',
}) => {
  if (!briefId) {
    throw new Error('Brief id is required');
  }

  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('brief_ai_interpretations')
    .insert({
      user_id: userId,
      brief_id: briefId,
      input_text: inputText || '',
      intent_payload: intentPayload || {},
      model: model || null,
      confidence,
      source,
      fallback_reason: fallbackReason || null,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating brief AI interpretation:', error);
    throw new Error(error.message || 'Failed to save brief AI interpretation');
  }

  return mapBriefAiInterpretationRow(data);
};
