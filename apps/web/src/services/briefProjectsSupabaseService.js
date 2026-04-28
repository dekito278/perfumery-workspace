import supabase from '@/lib/supabaseClient.js';
import { fetchRawMaterialsMap, getCurrentUserId, toAppRecord } from '@/services/supabaseDataHelpers.js';

const STAGES = ['top', 'middle', 'base'];

const normalizeStage = (stage) => {
  const normalized = String(stage || '').trim().toLowerCase();
  return STAGES.includes(normalized) ? normalized : null;
};

const mapStageRow = (row) => ({
  ...toAppRecord(row),
  answers: row.answers || {},
  target_profile: row.target_profile || {},
});

const mapStageItemRow = (row, materialsMap = new Map()) => ({
  ...toAppRecord(row),
  fit_score: row.fit_score === null || row.fit_score === undefined ? null : Number(row.fit_score),
  expand: {
    raw_material_id: materialsMap.get(row.raw_material_id) || null,
  },
});

export const ensureBriefProject = async (briefId) => {
  if (!briefId) {
    throw new Error('Brief id is required');
  }

  const userId = await getCurrentUserId();

  const { data: existing, error: existingError } = await supabase
    .from('brief_projects')
    .select('*')
    .eq('brief_id', briefId)
    .maybeSingle();

  if (existingError) {
    console.error('Error checking brief project:', existingError);
    throw new Error(existingError.message || 'Failed to load brief project');
  }

  if (existing) {
    return toAppRecord(existing);
  }

  const { data, error } = await supabase
    .from('brief_projects')
    .insert({
      user_id: userId,
      brief_id: briefId,
      status: 'draft',
      current_stage: 'top',
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating brief project:', error);
    throw new Error(error.message || 'Failed to create brief project');
  }

  return toAppRecord(data);
};

export const getBriefProjectByBriefId = async (briefId) => {
  if (!briefId) {
    return null;
  }

  const { data, error } = await supabase
    .from('brief_projects')
    .select('*')
    .eq('brief_id', briefId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching brief project:', error);
    throw new Error(error.message || 'Failed to fetch brief project');
  }

  return data ? toAppRecord(data) : null;
};

export const updateBriefProject = async (projectId, projectData) => {
  const { data, error } = await supabase
    .from('brief_projects')
    .update({
      status: projectData.status,
      current_stage: projectData.current_stage,
    })
    .eq('id', projectId)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating brief project:', error);
    throw new Error(error.message || 'Failed to update brief project');
  }

  return toAppRecord(data);
};

export const getBriefProjectStages = async (projectId) => {
  if (!projectId) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('brief_project_stages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching brief project stages:', error);
    throw new Error(error.message || 'Failed to fetch project stages');
  }

  const stageMap = new Map();
  (data || []).forEach((row) => {
    const normalizedStage = normalizeStage(row.stage);
    if (normalizedStage) {
      stageMap.set(normalizedStage, mapStageRow(row));
    }
  });

  return stageMap;
};

export const upsertBriefProjectStage = async (projectId, stage, stageData = {}) => {
  const normalizedStage = normalizeStage(stage);
  if (!projectId || !normalizedStage) {
    throw new Error('Project id and stage are required');
  }

  const payload = {
    project_id: projectId,
    stage: normalizedStage,
    status: stageData.status || 'in_progress',
    answers: stageData.answers || {},
    target_profile: stageData.target_profile || {},
    recommendation_note: stageData.recommendation_note || null,
  };

  const { data, error } = await supabase
    .from('brief_project_stages')
    .upsert(payload, { onConflict: 'project_id,stage' })
    .select('*')
    .single();

  if (error) {
    console.error('Error upserting brief project stage:', error);
    throw new Error(error.message || 'Failed to save project stage');
  }

  return mapStageRow(data);
};

export const getBriefProjectStageItems = async (projectId, stage = null) => {
  if (!projectId) {
    return stage ? [] : new Map();
  }

  let query = supabase
    .from('brief_project_stage_items')
    .select('*')
    .eq('project_id', projectId)
    .order('rank_order', { ascending: true })
    .order('created_at', { ascending: true });

  const normalizedStage = normalizeStage(stage);
  if (normalizedStage) {
    query = query.eq('stage', normalizedStage);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching brief project stage items:', error);
    throw new Error(error.message || 'Failed to fetch project stage items');
  }

  const materialsMap = await fetchRawMaterialsMap((data || []).map((row) => row.raw_material_id));
  const mappedRows = (data || []).map((row) => mapStageItemRow(row, materialsMap));

  if (normalizedStage) {
    return mappedRows;
  }

  const grouped = new Map(STAGES.map((entry) => [entry, []]));
  mappedRows.forEach((row) => {
    const stageKey = normalizeStage(row.stage);
    if (!stageKey) {
      return;
    }
    const current = grouped.get(stageKey) || [];
    current.push(row);
    grouped.set(stageKey, current);
  });

  return grouped;
};

export const upsertBriefProjectStageItems = async (projectId, items = []) => {
  await getCurrentUserId();
  const payload = (items || [])
    .map((item, index) => {
      const normalizedStage = normalizeStage(item.stage);
      if (!normalizedStage || !item.raw_material_id) {
        return null;
      }

      return {
        project_id: projectId,
        stage: normalizedStage,
        raw_material_id: String(item.raw_material_id),
        selection_state: item.selection_state || 'recommended',
        role: item.role || null,
        rank_order: item.rank_order ?? index,
        fit_score: item.fit_score ?? null,
        primary_function: item.primary_function || null,
        secondary_function: item.secondary_function || null,
        recommendation_reason: item.recommendation_reason || null,
        warning: item.warning || null,
      };
    })
    .filter(Boolean);

  if (!payload.length) {
    return [];
  }

  const { error } = await supabase
    .from('brief_project_stage_items')
    .upsert(payload, { onConflict: 'project_id,stage,raw_material_id' });

  if (error) {
    console.error('Error upserting brief project stage items:', error);
    throw new Error(error.message || 'Failed to save project stage items');
  }

  return getBriefProjectStageItems(projectId);
};

export const deleteBriefProjectStageItem = async (itemId) => {
  const { error } = await supabase
    .from('brief_project_stage_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('Error deleting brief project stage item:', error);
    throw new Error(error.message || 'Failed to delete project stage item');
  }
};

export const deleteBriefProjectStageItemsByStage = async (projectId, stage, states = []) => {
  const normalizedStage = normalizeStage(stage);
  if (!projectId || !normalizedStage) {
    return;
  }

  let query = supabase
    .from('brief_project_stage_items')
    .delete()
    .eq('project_id', projectId)
    .eq('stage', normalizedStage);

  if (states.length) {
    query = query.in('selection_state', states);
  }

  const { error } = await query;

  if (error) {
    console.error('Error deleting brief project stage items:', error);
    throw new Error(error.message || 'Failed to delete project stage items');
  }
};
