const DILUTION_PATTERN = /^(.*?)\s+(\d+(?:\.\d+)?)%\s+in\s+([A-Za-z0-9][A-Za-z0-9\s\-\/]*)$/i;

export const parseDilutionFromMaterialName = (name) => {
  const normalizedName = String(name || '').replace(/\s+/g, ' ').trim();
  const match = normalizedName.match(DILUTION_PATTERN);

  if (!match) {
    return {
      originalName: normalizedName,
      pureName: normalizedName,
      isDilutedInFormula: false,
      dilutionPercent: null,
      solventName: null,
      displayName: normalizedName,
    };
  }

  const pureName = match[1].trim();
  const dilutionPercent = Number.parseFloat(match[2]);
  const solventName = match[3].trim();

  return {
    originalName: normalizedName,
    pureName,
    isDilutedInFormula: true,
    dilutionPercent,
    solventName,
    displayName: `${pureName} ${dilutionPercent}% in ${solventName}`,
  };
};
