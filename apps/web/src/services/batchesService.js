import supabase from '@/lib/supabaseClient.js';
import { getCurrentUserId, toAppRecord } from '@/services/supabaseDataHelpers.js';

export const BATCHES_STORAGE_KEY = 'dekito.studio.batches.v1';

const readStoredBatches = () => {
  if (typeof window === 'undefined') return [];

  try {
    const value = window.localStorage.getItem(BATCHES_STORAGE_KEY);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
};

const writeStoredBatches = (batches) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BATCHES_STORAGE_KEY, JSON.stringify(batches));
  window.dispatchEvent(new CustomEvent('dekito:batches-updated'));
};

const buildBatchCode = (formula, createdAt = new Date()) => {
  const formulaCode = String(formula?.code || formula?.name || 'formula')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18) || 'FORMULA';
  const stamp = [
    createdAt.getFullYear(),
    String(createdAt.getMonth() + 1).padStart(2, '0'),
    String(createdAt.getDate()).padStart(2, '0'),
    String(createdAt.getHours()).padStart(2, '0'),
    String(createdAt.getMinutes()).padStart(2, '0'),
  ].join('');

  return `BATCH-${formulaCode}-${stamp}`;
};

const normalizeBatch = (input = {}) => {
  const createdAt = input.created_at || input.created || new Date().toISOString();
  const formula = input.formula || null;
  const targetQuantity = Number(input.target_quantity ?? input.targetQuantity ?? 0);
  const producedQuantity = Number(input.produced_quantity ?? input.producedQuantity ?? targetQuantity);
  const formulaPercentage = Number(input.formula_percentage ?? input.formulaPercentage ?? 0);
  const solventPercentage = Number(input.solvent_percentage ?? input.solventPercentage ?? Math.max(100 - formulaPercentage, 0));

  return {
    ...input,
    id: input.id || `local-batch-${Date.now()}`,
    batch_code: input.batch_code || input.batchCode || buildBatchCode(formula, new Date(createdAt)),
    formula_id: input.formula_id || input.formulaId,
    solvent_id: input.solvent_id || input.solventId || null,
    target_quantity: targetQuantity,
    produced_quantity: producedQuantity,
    production_date: input.production_date || input.productionDate || new Date().toISOString().slice(0, 10),
    unit: input.unit || 'ml',
    formula_percentage: formulaPercentage,
    solvent_percentage: solventPercentage,
    formula_quantity_needed: Number(input.formula_quantity_needed ?? input.formulaQuantityNeeded ?? 0),
    solvent_quantity_needed: Number(input.solvent_quantity_needed ?? input.solventQuantityNeeded ?? 0),
    bottle_ml: Number(input.bottle_ml ?? input.bottleMl ?? 0),
    loss_percent: Number(input.loss_percent ?? input.lossPercent ?? 0),
    usable_quantity: Number(input.usable_quantity ?? input.usableQuantity ?? producedQuantity),
    bottle_count: Number(input.bottle_count ?? input.bottleCount ?? 0),
    cogs_per_bottle: Number(input.cogs_per_bottle ?? input.cogsPerBottle ?? 0),
    selling_price: Number(input.selling_price ?? input.sellingPrice ?? 0),
    sku: input.sku || '',
    product_id: input.product_id || input.productId || null,
    status: input.status || 'planned',
    notes: input.notes || null,
    created_at: createdAt,
    updated_at: input.updated_at || input.updated || new Date().toISOString(),
    created: createdAt,
    updated: input.updated_at || input.updated || new Date().toISOString(),
  };
};

const toDatabasePayload = (batch, userId) => ({
  user_id: userId,
  batch_code: batch.batch_code,
  formula_id: batch.formula_id,
  solvent_id: batch.solvent_id,
  target_quantity: batch.target_quantity,
  produced_quantity: batch.produced_quantity,
  production_date: batch.production_date,
  unit: batch.unit,
  formula_percentage: batch.formula_percentage,
  solvent_percentage: batch.solvent_percentage,
  formula_quantity_needed: batch.formula_quantity_needed,
  solvent_quantity_needed: batch.solvent_quantity_needed,
  bottle_ml: batch.bottle_ml,
  loss_percent: batch.loss_percent,
  usable_quantity: batch.usable_quantity,
  bottle_count: batch.bottle_count,
  cogs_per_bottle: batch.cogs_per_bottle,
  selling_price: batch.selling_price,
  sku: batch.sku,
  product_id: batch.product_id,
  status: batch.status,
  notes: batch.notes,
});

const saveLocalBatch = (input) => {
  const batch = normalizeBatch(input);
  const stored = readStoredBatches();
  const next = stored.some((item) => item.id === batch.id)
    ? stored.map((item) => (item.id === batch.id ? batch : item))
    : [batch, ...stored];
  writeStoredBatches(next);
  return batch;
};

export const getBatches = async ({ formulaId } = {}) => {
  try {
    let query = supabase
      .from('batches')
      .select('*')
      .order('created_at', { ascending: false });

    if (formulaId) {
      query = query.eq('formula_id', formulaId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => normalizeBatch(toAppRecord(row)));
  } catch (error) {
    console.warn('Using local batch fallback:', error.message || error);
    return readStoredBatches()
      .filter((batch) => !formulaId || batch.formula_id === formulaId)
      .map(normalizeBatch);
  }
};

export const saveBatch = async (input) => {
  const batch = normalizeBatch(input);

  try {
    const userId = await getCurrentUserId();
    const payload = toDatabasePayload(batch, userId);
    const query = batch.id && !String(batch.id).startsWith('local-batch-')
      ? supabase.from('batches').update(payload).eq('id', batch.id)
      : supabase.from('batches').insert(payload);

    const { data, error } = await query.select('*').single();
    if (error) throw error;

    window.dispatchEvent(new CustomEvent('dekito:batches-updated'));
    return normalizeBatch(toAppRecord(data));
  } catch (error) {
    console.warn('Saving batch locally because database save failed:', error.message || error);
    return saveLocalBatch(batch);
  }
};
