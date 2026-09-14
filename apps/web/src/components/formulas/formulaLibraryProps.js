// Shared FormulaMaterialLibrary render-prop helpers for the formula composer.

export const getLibraryBadgeLabel = (activatingLibraryId) => ({ material, selectedRawMaterialIdsSet: selectedIds, mobile }) => {
  if (material.is_global_library) {
    return activatingLibraryId === material.id ? 'Menambahkan...' : 'Tambah';
  }
  if (selectedIds.has(material.id)) {
    return 'Sudah masuk';
  }
  return mobile ? 'Tambah baris' : 'Tambah';
};

export const getLibraryDisabledState = ({ material, selectedRawMaterialIdsSet: selectedIds }) => selectedIds.has(material.id);
