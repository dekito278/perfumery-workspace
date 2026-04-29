export const validateDilutionFields = (data) => {
  if (!data?.is_diluted) {
    return;
  }

  if (!data.dilution_solvent_id) {
    throw new Error('Dilution solvent is required for diluted materials');
  }

  if (!data.dilution_percentage || data.dilution_percentage <= 0 || data.dilution_percentage > 100) {
    throw new Error('Dilution percentage must be between 0 and 100');
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
      throw new Error(`Workbook code "${payload.workbook_code}" sudah dipakai oleh raw material "${existingRecord.name}".`);
    }

    throw new Error(`Workbook code "${payload.workbook_code}" sudah dipakai oleh raw material lain.`);
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
      throw new Error(`Name "${payload.name}" sudah dipakai oleh raw material "${existingRecord.name}".`);
    }

    throw new Error(`Name "${payload.name}" sudah dipakai oleh raw material lain.`);
  }

  throw error;
};
