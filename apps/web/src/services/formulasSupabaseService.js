import supabase from '@/lib/supabaseClient.js';
import { getCurrentUserId, toAppRecord } from '@/services/supabaseDataHelpers.js';

const normalizeFormulaPayload = (formulaData) => ({
  name: String(formulaData.name).trim(),
  code: String(formulaData.code || `FORMULA-${Date.now()}`).trim(),
  // Only write author_name when the caller actually supplied one. Every edit page omits it, so forcing
  // null here erased the author on the first save after the formula was created (audit round 8).
  ...(formulaData.author_name === undefined ? {} : {
    author_name: formulaData.author_name ? String(formulaData.author_name).trim() : null,
  }),
  notes: formulaData.notes ? String(formulaData.notes).trim() : null,
  category: formulaData.category || null,
  status: formulaData.status || 'draft',
  version: formulaData.version ? String(formulaData.version) : null,
  // Lineage is written only when the caller asks for it, for the same reason author_name is: this
  // payload is a hand-written field list shared by create AND update, and every edit page omits these.
  // Forcing null here would erase a revision's parent on its first save.
  ...(formulaData.parent_formula_id === undefined ? {} : {
    parent_formula_id: formulaData.parent_formula_id || null,
  }),
  ...(formulaData.revision_note === undefined ? {} : {
    revision_note: formulaData.revision_note ? String(formulaData.revision_note).trim() : null,
  }),
});

// 20260914140000_formula_revision_lineage.sql is applied by hand, so the insert has to survive the
// columns not being there yet. Dropping them and retrying keeps revisions working exactly as they do
// today — detached, linked only by the notes sentence — instead of failing the create outright.
const LINEAGE_FIELDS = ['parent_formula_id', 'revision_note'];

const isMissingLineageColumn = (error) => Boolean(
  error
  && (error.code === '42703' || /schema cache/i.test(error.message || ''))
  && LINEAGE_FIELDS.some((field) => String(error.message || '').includes(field)),
);

const withoutLineageFields = (payload) => {
  const next = { ...payload };
  for (const field of LINEAGE_FIELDS) delete next[field];
  return next;
};

const VERSIONED_CODE_PATTERN = /-V(\d+)$/i;

const buildNextVersionCode = (code, nextVersion) => {
  const baseCode = String(code || '').trim().replace(VERSIONED_CODE_PATTERN, '');
  return `${baseCode}-V${nextVersion}`;
};

const getNextAvailableFormulaCode = async (userId, preferredCode) => {
  const normalizedCode = String(preferredCode || '').trim();
  const baseCode = normalizedCode.replace(VERSIONED_CODE_PATTERN, '');

  const { data, error } = await supabase
    .from('formulas')
    .select('code')
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Failed to resolve duplicate formula code');
  }

  const existingCodes = new Set((data || []).map((item) => String(item.code || '').trim().toLowerCase()));
  if (!existingCodes.has(normalizedCode.toLowerCase())) {
    return normalizedCode;
  }

  let version = 2;
  while (existingCodes.has(buildNextVersionCode(baseCode, version).toLowerCase())) {
    version += 1;
  }

  return buildNextVersionCode(baseCode, version);
};

const normalizeFormulaItemPayload = (formulaId, item, index) => ({
  formula_id: formulaId,
  item_type: item.item_type || 'raw_material',
  item_id: String(item.item_id),
  percentage: Number(item.percentage),
  sort_order: item.sort_order !== undefined && item.sort_order !== null ? Number(item.sort_order) : index,
  grams: item.grams !== undefined && item.grams !== null ? Number(item.grams) : null,
  dilution_percent: item.dilution_percent !== undefined && item.dilution_percent !== null ? Number(item.dilution_percent) : null,
  dilution_solvent_id: item.dilution_solvent_id || null,
  concentrate_amount: item.concentrate_amount !== undefined && item.concentrate_amount !== null ? Number(item.concentrate_amount) : null,
});

export const getFormulas = async () => {
  const { data, error } = await supabase
    .from('formulas')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Failed to fetch formulas');
  }

  return (data || []).map(toAppRecord);
};

export const getFormulaById = async (id) => {
  const { data, error } = await supabase
    .from('formulas')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching formula:', error);
    throw new Error('Failed to fetch formula');
  }

  return toAppRecord(data);
};

export const getFormulaItems = async (formulaId) => {
  const { data, error } = await supabase
    .from('formula_items')
    .select('*')
    .eq('formula_id', formulaId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching formula items:', error);
    throw new Error('Failed to fetch formula items');
  }

  return (data || []).map(toAppRecord);
};

export const getFormulaItemsByFormulaIds = async (formulaIds = []) => {
  const normalizedFormulaIds = [...new Set((formulaIds || []).filter(Boolean).map((value) => String(value)))];
  if (!normalizedFormulaIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('formula_items')
    .select('*')
    .in('formula_id', normalizedFormulaIds)
    .order('formula_id', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching formula items by formula ids:', error);
    throw new Error(error.message || 'Failed to fetch formula items');
  }

  return (data || []).map(toAppRecord);
};

export const createFormula = async (formulaData, items) => {
  const userId = await getCurrentUserId();
  let payload = {
    user_id: userId,
    ...normalizeFormulaPayload(formulaData),
  };

  let formula = null;
  while (!formula) {
    const { data, error } = await supabase
      .from('formulas')
      .insert(payload)
      .select('*')
      .single();

    if (!error) {
      formula = data;
      break;
    }

    if (error.code === '23505' && error.message?.includes('formulas_unique_code_per_user')) {
      payload = {
        ...payload,
        code: await getNextAvailableFormulaCode(userId, payload.code),
      };
      continue;
    }

    if (isMissingLineageColumn(error)) {
      console.warn('Formula lineage columns are not applied yet; creating this revision without ancestry.');
      payload = withoutLineageFields(payload);
      continue;
    }

    console.error('Error creating formula:', error);
    throw new Error(error.message || 'Failed to create formula');
  }

  if (items?.length) {
    const { error: itemsError } = await supabase
      .from('formula_items')
      .insert(items.map((item, index) => normalizeFormulaItemPayload(formula.id, item, index)));

    if (itemsError) {
      console.error('Error creating formula items:', itemsError);
      // Roll the formula row back. Without this the failed create left an item-less formula behind, and the
      // perfumer's retry created a second one — updateFormula already rolls its items back, so this only
      // brings create in line with it (audit round 8).
      // Observed too. A rollback whose whole purpose is cleanup must know whether it cleaned up, and a
      // refused delete comes back 200 with error === null. Logged rather than thrown: the items error
      // is what the perfumer needs to see.
      const { data: rolledBack, error: rollbackError } = await supabase.from('formulas').delete().eq('id', formula.id).select('id');
      if (rollbackError || !(rolledBack || []).length) {
        console.error('Failed to roll back the empty formula row:', rollbackError || 'no row was removed');
      }
      throw new Error(itemsError.message || 'Failed to create formula items');
    }
  }

  return toAppRecord(formula);
};

export const updateFormula = async (formulaId, formulaData, items) => {
  const { data: formula, error: formulaError } = await supabase
    .from('formulas')
    .update(normalizeFormulaPayload(formulaData))
    .eq('id', formulaId)
    .select('*')
    .single();

  if (formulaError) {
    console.error('Error updating formula:', formulaError);
    throw new Error(formulaError.message || 'Failed to update formula');
  }

  // Snapshot existing items so a failed re-insert can be rolled back — Supabase JS has no
  // client-side transaction, and delete-then-insert otherwise loses the whole composition.
  //
  // The error is READ. Without it a failed snapshot left previousItems undefined and the rollback below
  // silently impossible — the one path whose whole job is not losing the composition.
  const { data: previousItems, error: previousItemsError } = await supabase
    .from('formula_items')
    .select('*')
    .eq('formula_id', formulaId);

  if (previousItemsError) {
    console.error('Error reading the formula composition before replacing it:', previousItemsError);
    throw new Error(previousItemsError.message || 'Failed to read the formula composition');
  }

  // .select() on the delete, for the reason orderWrites.selfcheck.mjs spells out about the orders
  // table: PostgREST answers a write the policies refuse with 200 and error === null. Here that is
  // worse than a no-op — the insert below would then add the new composition ON TOP of the old one, and
  // the formula would carry both, its percentages summing to 200.
  const { data: deletedItems, error: deleteError } = await supabase
    .from('formula_items')
    .delete()
    .eq('formula_id', formulaId)
    .select('id');

  if (deleteError) {
    console.error('Error replacing formula items:', deleteError);
    throw new Error(deleteError.message || 'Failed to replace formula items');
  }

  if (previousItems.length && !(deletedItems || []).length) {
    throw new Error('Komposisi formula tidak bisa diganti: baris lamanya tidak terhapus. Formula dibiarkan apa adanya.');
  }

  if (items?.length) {
    const { error: itemsError } = await supabase
      .from('formula_items')
      .insert(items.map((item, index) => normalizeFormulaItemPayload(formulaId, item, index)));

    if (itemsError) {
      console.error('Error inserting formula items:', itemsError);
      // ponytail: best-effort compensating rollback — restore the old rows so the formula keeps
      // its previous composition. If this re-insert also fails, the items are lost (rare).
      if (previousItems?.length) {
        await supabase.from('formula_items').insert(previousItems);
      }
      throw new Error(itemsError.message || 'Failed to update formula items');
    }
  }

  return toAppRecord(formula);
};

export const updateFormulaStatus = async (formulaId, status) => {
  const { data, error } = await supabase
    .from('formulas')
    .update({ status })
    .eq('id', formulaId)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating formula status:', error);
    throw new Error(error.message || 'Failed to update formula status');
  }

  return toAppRecord(data);
};

export const deleteFormula = async (formulaId) => {
  // Deliberately NOT asserting that a row came back, and silentWrites.selfcheck.mjs holds the reason on
  // the record: this table is RLS'd on auth.uid() = user_id, so a refusal would mean deleting someone
  // else's formula — which cannot arise from a list the user is rendering out of their own rows. What
  // zero rows DOES mean here is that the formula is already gone: a double-tap, or a delete from a list
  // loaded before someone else removed it. Throwing on that turns an idempotent delete into an error
  // message about nothing.
  const { error } = await supabase
    .from('formulas')
    .delete()
    .eq('id', formulaId);

  if (error) {
    console.error('Error deleting formula:', error);
    throw new Error('Failed to delete formula');
  }
};

export const duplicateFormula = async (formulaId) => {
  const userId = await getCurrentUserId();
  const original = await getFormulaById(formulaId);
  const originalItems = await getFormulaItems(formulaId);

  const { data: duplicate, error: duplicateError } = await supabase
    .from('formulas')
    .insert({
      user_id: userId,
      ...normalizeFormulaPayload({
        ...original,
        name: `Copy of ${original.name}`,
        code: `${original.code}-COPY-${Date.now()}`,
      }),
    })
    .select('*')
    .single();

  if (duplicateError) {
    console.error('Error duplicating formula:', duplicateError);
    throw new Error('Failed to duplicate formula');
  }

  if (originalItems.length) {
    const { error: itemsError } = await supabase
      .from('formula_items')
      .insert(originalItems.map((item, index) => normalizeFormulaItemPayload(duplicate.id, item, index)));

    if (itemsError) {
      console.error('Error duplicating formula items:', itemsError);
      // Roll the copy back. createFormula learned this in audit round 8 — without it a failed copy left
      // an item-less "Copy of ..." in the list, and the perfumer's retry made a second one. This is the
      // same mirror, never done.
      const { data: rolledBack, error: rollbackError } = await supabase.from('formulas').delete().eq('id', duplicate.id).select('id');
      if (rollbackError || !(rolledBack || []).length) {
        console.error('Failed to roll back the empty duplicate formula row:', rollbackError || 'no row was removed');
      }
      throw new Error('Failed to duplicate formula');
    }
  }

  return toAppRecord(duplicate);
};
