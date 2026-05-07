export const BESPOKE_SETTINGS_STORAGE_KEY = 'dekito.storefront.bespoke-settings.v1';

export const defaultBespokeSettings = {
  bottleSizes: [
    { id: '30-ml', label: '30 ml', value: '30 ml', price: 350000, description: 'Ukuran default bespoke.', enabled: true },
    { id: '50-ml', label: '50 ml', value: '50 ml', price: 500000, description: 'Ukuran lebih besar untuk pemakaian rutin.', enabled: true },
  ],
  bottleTypes: [
    { id: 'classic-clear', label: 'Classic clear bottle', value: 'Classic clear bottle', price: 0, description: 'Botol kaca bening dengan bentuk clean.', enabled: true },
    { id: 'square-premium', label: 'Square premium bottle', value: 'Square premium bottle', price: 45000, description: 'Bentuk kotak yang lebih tegas dan premium.', enabled: true },
  ],
  capDesigns: [
    { id: 'cap-biasa', label: 'Cap biasa', value: 'Cap biasa', price: 0, description: 'Simple, clean, ready stock.', enabled: true },
    { id: 'cap-batu', label: 'Cap batu', value: 'Cap batu', price: 75000, description: 'Statement cap dengan feel natural stone.', enabled: true },
    { id: 'cap-custom-akrilik', label: 'Cap custom akrilik', value: 'Cap custom akrilik', price: 125000, description: 'Custom color/form acrylic look.', enabled: true },
  ],
  labelDesigns: [
    { id: 'minimal-label', label: 'Minimal label', value: 'Minimal label', price: 0, description: 'Label clean dengan nama parfum dan detail basic.', enabled: true },
    { id: 'custom-name-label', label: 'Custom name label', value: 'Custom name label', price: 35000, description: 'Label dengan nama atau pesan personal.', enabled: true },
  ],
  exoticMaterials: [],
};

const optionCollections = ['bottleSizes', 'bottleTypes', 'capDesigns', 'labelDesigns', 'exoticMaterials'];

const toSlug = (value) => String(value || 'option')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'option';

const normalizeOption = (option = {}) => {
  const label = String(option.label || option.value || 'Untitled option').trim();
  return {
    id: option.id || `${toSlug(label)}-${Date.now()}`,
    label,
    value: String(option.value || label).trim(),
    price: Math.max(Number(option.price || 0), 0),
    description: String(option.description || '').trim(),
    imageUrl: String(option.imageUrl || '').trim(),
    enabled: option.enabled !== false,
  };
};

export const normalizeBespokeSettings = (settings = {}) => optionCollections.reduce((nextSettings, key) => ({
  ...nextSettings,
  [key]: (Array.isArray(settings[key]) ? settings[key] : defaultBespokeSettings[key]).map(normalizeOption),
}), {});

const readStoredSettings = () => {
  if (typeof window === 'undefined') return defaultBespokeSettings;
  try {
    const value = window.localStorage.getItem(BESPOKE_SETTINGS_STORAGE_KEY);
    return value ? JSON.parse(value) : defaultBespokeSettings;
  } catch (error) {
    return defaultBespokeSettings;
  }
};

const writeSettings = (settings) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BESPOKE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('dekito:bespoke-settings-updated'));
};

export const getBespokeSettings = () => normalizeBespokeSettings(readStoredSettings());

export const getActiveBespokeOptions = (key) => getBespokeSettings()[key].filter((option) => option.enabled);

export const saveBespokeOption = (collectionKey, option) => {
  const settings = getBespokeSettings();
  const normalizedOption = normalizeOption(option);
  const options = settings[collectionKey] || [];
  const nextOptions = options.some((item) => item.id === normalizedOption.id)
    ? options.map((item) => (item.id === normalizedOption.id ? normalizedOption : item))
    : [...options, normalizedOption];
  const nextSettings = { ...settings, [collectionKey]: nextOptions };
  writeSettings(nextSettings);
  return normalizedOption;
};

export const deleteBespokeOption = (collectionKey, optionId) => {
  const settings = getBespokeSettings();
  const nextSettings = {
    ...settings,
    [collectionKey]: (settings[collectionKey] || []).filter((option) => option.id !== optionId),
  };
  writeSettings(nextSettings);
  return nextSettings;
};

export const resetBespokeSettings = () => {
  const settings = normalizeBespokeSettings(defaultBespokeSettings);
  writeSettings(settings);
  return settings;
};
