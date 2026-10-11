/**
 * Whether a material in the composer's library is locked against the row being edited.
 *
 * It was answered twice, differently, by the two pages that render the same library:
 *
 *   Edit:   selectedIds.has(material.id) && currentRowItemId !== material.id
 *   Create: selectedIds.has(material.id)
 *
 * So on Create the material sitting in your ACTIVE row was greyed out as well -- and that contradicted
 * two things at once. The composer's own handler accepts re-picking it (handleLibrarySelect only refuses
 * a material added in ANOTHER row), and Create's own badge labels that row "Selected", a word written for
 * a state its disabled rule forbade: a button reading "Selected" that could not be clicked.
 *
 * Edit's rule is the one that agrees with the handler, so it is the rule, and it lives here. The badges
 * are deliberately still per page -- Create distinguishes "Selected" from "Added" and Edit does not.
 */
export const materialIsLockedForRow = ({ material, currentRowItemId, selectedRawMaterialIdsSet } = {}) => {
  const id = material?.id;
  if (!id || !selectedRawMaterialIdsSet?.has) return false;

  return selectedRawMaterialIdsSet.has(id) && currentRowItemId !== id;
};

export default materialIsLockedForRow;
