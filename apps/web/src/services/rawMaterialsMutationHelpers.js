export const validateDilutionFields = (data) => {
  if (!data?.is_diluted) {
    return;
  }

  if (!data.dilution_solvent_id) {
    throw new Error('Bahan yang diencerkan wajib punya pelarut pengencer');
  }

  if (!data.dilution_percentage || data.dilution_percentage <= 0 || data.dilution_percentage > 100) {
    throw new Error('Persentase pengenceran harus antara 0 dan 100');
  }
};

export const findDuplicateWorkbookCodeRecord = async ({
  userId,
  workbookCode,
  excludedRawMaterialId = null,
  findExistingRawMaterialByWorkbookCode,
}) => (
  workbookCode
    ? findExistingRawMaterialByWorkbookCode(userId, workbookCode, excludedRawMaterialId)
    : null
);

export const findDuplicateNameRecord = async ({
  userId,
  name,
  excludedRawMaterialId = null,
  findExistingRawMaterialByName,
}) => {
  if (!name) {
    return null;
  }

  const existingRecord = await findExistingRawMaterialByName(userId, name);
  if (!existingRecord || existingRecord.id === excludedRawMaterialId) {
    return null;
  }

  return existingRecord;
};

export const getCreationResolutionForExistingRecord = async ({
  existingRecord,
  payload,
  matchMethod,
  getSolventMap,
  withCreationResolution,
  buildResolution,
}) => {
  if (!existingRecord) {
    return null;
  }

  const solventMap = await getSolventMap(existingRecord.dilution_solvent_id ? [existingRecord.dilution_solvent_id] : []);
  return withCreationResolution(
    existingRecord,
    solventMap,
    buildResolution({
      record: existingRecord,
      matchMethod,
      incomingName: payload.name,
      matchedName: existingRecord.name,
    }),
  );
};

export const translateRawMaterialUniqueConstraintError = async ({
  error,
  userId,
  payload,
  mode,
  rawMaterialId = null,
  findExistingRawMaterialByWorkbookCode,
  findExistingRawMaterialByName,
  getSolventMap,
  withCreationResolution,
  buildResolution,
}) => {
  if (error.code === '23505' && error.message?.includes('raw_materials_unique_workbook_code_per_user')) {
    const existingRecord = await findDuplicateWorkbookCodeRecord({
      userId,
      workbookCode: payload.workbook_code,
      excludedRawMaterialId: rawMaterialId,
      findExistingRawMaterialByWorkbookCode,
    });

    if (mode === 'create') {
      return getCreationResolutionForExistingRecord({
        existingRecord,
        payload,
        matchMethod: 'workbook code',
        getSolventMap,
        withCreationResolution,
        buildResolution,
      });
    }

    if (existingRecord) {
      throw new Error(`Kode workbook "${payload.workbook_code}" sudah dipakai oleh bahan baku "${existingRecord.name}".`);
    }

    throw new Error(`Kode workbook "${payload.workbook_code}" sudah dipakai oleh bahan baku lain.`);
  }

  if (error.code === '23505' && error.message?.includes('raw_materials_unique_name_per_user')) {
    const existingRecord = await findDuplicateNameRecord({
      userId,
      name: payload.name,
      excludedRawMaterialId: rawMaterialId,
      findExistingRawMaterialByName,
    });

    if (mode === 'create') {
      return getCreationResolutionForExistingRecord({
        existingRecord,
        payload,
        matchMethod: 'exact name',
        getSolventMap,
        withCreationResolution,
        buildResolution,
      });
    }

    if (existingRecord) {
      throw new Error(`Nama "${payload.name}" sudah dipakai oleh bahan baku "${existingRecord.name}".`);
    }

    throw new Error(`Nama "${payload.name}" sudah dipakai oleh bahan baku lain.`);
  }

  throw error;
};
