// What "searching for a material" means, in one place.
//
// It was answered twice. The raw-materials list asks the database across six columns -- name, category,
// vendor, CAS number, workbook code, scent family. The composer's material library, which is where a
// perfumer actually picks materials while building a formula, filtered a loaded array by NAME alone.
//
// Measured against the studio's own 774 materials: 578 carry a workbook code, 656 a CAS number, 757 a
// scent family. Every one of those is a way to find a material on the list screen and a dead end in the
// composer -- type a workbook code there and the library goes empty.
//
// So the field list lives here and both sides read it: the service builds its `or()` from it, the
// composer matches rows against it.
export const MATERIAL_SEARCH_FIELDS = [
  'name',
  'category',
  'vendor',
  'cas_number',
  'workbook_code',
  'scent_family',
];

/** Case-insensitive substring, on any searchable field. An empty query matches everything. */
export const materialMatchesQuery = (material, query) => {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return true;
  if (!material) return false;

  return MATERIAL_SEARCH_FIELDS.some((field) => (
    String(material[field] || '').toLowerCase().includes(needle)
  ));
};

/** Sorted by name, filtered by the query — the order the library has always shown. */
export const searchMaterials = (materials, query) => (
  [...(materials || [])]
    .sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')))
    .filter((material) => materialMatchesQuery(material, query))
);
