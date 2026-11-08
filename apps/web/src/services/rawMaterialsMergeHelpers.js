export const hasMeaningfulText = (value) => String(value || '').trim().length > 0;

export const hasMeaningfulValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';

export const preferMissingText = (currentValue, fallbackValue) => (
  hasMeaningfulText(currentValue) ? currentValue : (hasMeaningfulText(fallbackValue) ? fallbackValue : null)
);

export const preferPositiveNumber = (currentValue, fallbackValue) => {
  const currentNumber = Number(currentValue);
  if (Number.isFinite(currentNumber) && currentNumber > 0) {
    return currentNumber;
  }

  const fallbackNumber = Number(fallbackValue);
  return Number.isFinite(fallbackNumber) ? fallbackNumber : null;
};

export const preferDefinedNumber = (currentValue, fallbackValue) => (
  hasMeaningfulValue(currentValue) ? Number(currentValue) : (hasMeaningfulValue(fallbackValue) ? Number(fallbackValue) : null)
);

export const mergeMaterialNotes = (masterRecord, duplicateRecord) => {
  const masterNotes = String(masterRecord.notes || '').trim();
  const duplicateNotes = String(duplicateRecord.notes || '').trim();

  if (!duplicateNotes) {
    return masterNotes || null;
  }

  if (!masterNotes) {
    return duplicateNotes;
  }

  if (masterNotes === duplicateNotes || masterNotes.includes(duplicateNotes)) {
    return masterNotes;
  }

  return `${masterNotes}\n\nMerged duplicate note from ${duplicateRecord.name}:\n${duplicateNotes}`;
};

export const validateMergeableRawMaterials = (masterRecord, duplicateRecord, helpers) => {
  const { normalizeLookupValue, normalizeCasValue, invalidCasMatchValues } = helpers;

  if (!masterRecord || !duplicateRecord) {
    throw new Error('Penggabungan bahan baku butuh satu baris utama dan satu baris duplikat.');
  }

  // Stock is summed on merge, so mixing units would silently reinterpret the absorbed quantity —
  // 80 ml folded into a gram-based row reads as 80 g (audit round 8).
  const masterUnit = String(masterRecord.unit || '').trim().toLowerCase();
  const duplicateUnit = String(duplicateRecord.unit || '').trim().toLowerCase();
  if (masterUnit && duplicateUnit && masterUnit !== duplicateUnit) {
    throw new Error(`Tidak bisa menggabungkan baris dengan satuan berbeda (${masterUnit} vs ${duplicateUnit}).`);
  }

  if (masterRecord.id === duplicateRecord.id) {
    throw new Error('Bahan baku utama dan duplikat tidak boleh baris yang sama.');
  }

  if (masterRecord.user_id !== duplicateRecord.user_id) {
    throw new Error('Tidak bisa menggabungkan bahan baku milik pengguna berbeda.');
  }

  if (masterRecord.type !== duplicateRecord.type) {
    throw new Error('Tidak bisa menggabungkan baris dengan jenis bahan baku berbeda.');
  }

  if (Boolean(masterRecord.is_diluted) !== Boolean(duplicateRecord.is_diluted)) {
    throw new Error('Bahan baku yang diencerkan dan yang murni tidak bisa digabung otomatis.');
  }

  if (String(masterRecord.dilution_solvent_id || '') === duplicateRecord.id || String(duplicateRecord.dilution_solvent_id || '') === masterRecord.id) {
    throw new Error('Tidak bisa menggabungkan baris yang saling menjadi pelarut pengencer. Periksa manual dulu.');
  }

  if (masterRecord.is_diluted) {
    if (String(masterRecord.dilution_solvent_id || '') !== String(duplicateRecord.dilution_solvent_id || '')) {
      throw new Error('Bahan baku encer dengan pelarut berbeda tidak bisa digabung otomatis.');
    }

    if (Number(masterRecord.dilution_percentage || 0) !== Number(duplicateRecord.dilution_percentage || 0)) {
      throw new Error('Bahan baku encer dengan persentase pengenceran berbeda tidak bisa digabung otomatis.');
    }
  }

  const masterWorkbookCode = normalizeLookupValue(masterRecord.workbook_code);
  const duplicateWorkbookCode = normalizeLookupValue(duplicateRecord.workbook_code);
  if (masterWorkbookCode && duplicateWorkbookCode && masterWorkbookCode !== duplicateWorkbookCode) {
    throw new Error('Tidak bisa menggabungkan baris dengan kode workbook berbeda.');
  }

  const masterCas = normalizeCasValue(masterRecord.cas_number);
  const duplicateCas = normalizeCasValue(duplicateRecord.cas_number);
  if (
    masterCas
    && duplicateCas
    && !invalidCasMatchValues.has(masterCas)
    && !invalidCasMatchValues.has(duplicateCas)
    && masterCas !== duplicateCas
  ) {
    throw new Error('Tidak bisa menggabungkan baris dengan nomor CAS berbeda.');
  }
};

export const buildMergedRawMaterialData = (masterRecord, duplicateRecord) => ({
  ...masterRecord,
  workbook_code: preferMissingText(masterRecord.workbook_code, duplicateRecord.workbook_code),
  scent_family: preferMissingText(masterRecord.scent_family, duplicateRecord.scent_family),
  supplier_name: preferMissingText(masterRecord.supplier_name, duplicateRecord.supplier_name),
  vendor: preferMissingText(masterRecord.vendor, duplicateRecord.vendor),
  description: preferMissingText(masterRecord.description, duplicateRecord.description),
  notes: mergeMaterialNotes(masterRecord, duplicateRecord),
  cas_number: preferMissingText(masterRecord.cas_number, duplicateRecord.cas_number),
  ifra_limit: preferDefinedNumber(masterRecord.ifra_limit, duplicateRecord.ifra_limit),
  reference_abc_primary_family: preferMissingText(
    masterRecord.reference_abc_primary_family,
    duplicateRecord.reference_abc_primary_family
  ),
  reference_impact: preferPositiveNumber(masterRecord.reference_impact, duplicateRecord.reference_impact),
  reference_life_hours: preferPositiveNumber(masterRecord.reference_life_hours, duplicateRecord.reference_life_hours),
  reference_use_level_typical_percent: preferDefinedNumber(
    masterRecord.reference_use_level_typical_percent,
    duplicateRecord.reference_use_level_typical_percent
  ),
  reference_use_level_max_percent: preferDefinedNumber(
    masterRecord.reference_use_level_max_percent,
    duplicateRecord.reference_use_level_max_percent
  ),
  cost_per_unit: Number(masterRecord.cost_per_unit || 0) > 0
    ? Number(masterRecord.cost_per_unit || 0)
    : Number(duplicateRecord.cost_per_unit || 0),
  // Stock is physical: two rows for the same material hold two real quantities on the shelf, and the
  // duplicate row is deleted right after this. Spreading masterRecord alone silently destroyed the
  // duplicate's stock on every merge (audit round 8).
  stock_quantity: Number(masterRecord.stock_quantity || 0) + Number(duplicateRecord.stock_quantity || 0),
  minimum_stock: Math.max(Number(masterRecord.minimum_stock || 0), Number(duplicateRecord.minimum_stock || 0)),
});

export const mergeReferenceLinksIntoMaster = async ({ masterId, duplicateId, supabase }) => {
  const { data: links, error } = await supabase
    .from('raw_material_reference_links')
    .select('id, raw_material_id, reference_profile_id, match_method, match_confidence, is_primary, notes')
    .in('raw_material_id', [masterId, duplicateId]);

  if (error) {
    throw error;
  }

  const masterLinks = (links || []).filter((row) => row.raw_material_id === masterId);
  const duplicateLinks = (links || []).filter((row) => row.raw_material_id === duplicateId);
  const masterReferenceIds = new Set(masterLinks.map((row) => row.reference_profile_id));
  let masterHasPrimary = masterLinks.some((row) => row.is_primary);

  for (const link of duplicateLinks) {
    if (masterReferenceIds.has(link.reference_profile_id)) {
      const { error: deleteError } = await supabase
        .from('raw_material_reference_links')
        .delete()
        .eq('id', link.id);

      if (deleteError) {
        throw deleteError;
      }
      continue;
    }

    const nextPrimary = Boolean(link.is_primary) && !masterHasPrimary;
    const { error: updateError } = await supabase
      .from('raw_material_reference_links')
      .update({
        raw_material_id: masterId,
        is_primary: nextPrimary,
      })
      .eq('id', link.id);

    if (updateError) {
      throw updateError;
    }

    masterReferenceIds.add(link.reference_profile_id);
    if (nextPrimary) {
      masterHasPrimary = true;
    }
  }
};

export const mergeManualReferenceProfilesIntoMaster = async ({ masterId, duplicateId, supabase }) => {
  const { data: profiles, error } = await supabase
    .from('material_reference_profiles')
    .select('id, source_raw_material_id')
    .eq('source_kind', 'manual')
    .in('source_raw_material_id', [masterId, duplicateId]);

  if (error) {
    throw error;
  }

  const masterProfile = (profiles || []).find((row) => row.source_raw_material_id === masterId) || null;
  const duplicateProfile = (profiles || []).find((row) => row.source_raw_material_id === duplicateId) || null;

  if (!duplicateProfile) {
    return;
  }

  if (!masterProfile) {
    const { error: reassignError } = await supabase
      .from('material_reference_profiles')
      .update({ source_raw_material_id: masterId })
      .eq('id', duplicateProfile.id);

    if (reassignError) {
      throw reassignError;
    }
    return;
  }

  const { error: deleteError } = await supabase
    .from('material_reference_profiles')
    .delete()
    .eq('id', duplicateProfile.id);

  if (deleteError) {
    throw deleteError;
  }
};
