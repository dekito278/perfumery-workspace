import supabase from '@/lib/supabaseClient.js';

export const BESPOKE_SETTINGS_STORAGE_KEY = 'dekito.storefront.bespoke-settings.v1';
export const BESPOKE_SETTINGS_UPDATED_EVENT = 'dekito:bespoke-settings-updated';

export const optionCollections = ['bottleSizes', 'bottleTypes', 'capDesigns', 'labelDesigns', 'exoticMaterials'];

export const defaultBespokeSettings = {
  bottleSizes: [
    { id: '30-ml', label: '30 ml', value: '30 ml', price: 350000, description: 'Ukuran default bespoke.', enabled: true, sortOrder: 10 },
    { id: '50-ml', label: '50 ml', value: '50 ml', price: 500000, description: 'Ukuran lebih besar untuk pemakaian rutin.', enabled: true, sortOrder: 20 },
  ],
  bottleTypes: [
    { id: 'classic-clear', label: 'Classic clear bottle', value: 'Classic clear bottle', price: 0, description: 'Botol kaca bening dengan bentuk clean.', enabled: true, sortOrder: 10 },
    { id: 'square-premium', label: 'Square premium bottle', value: 'Square premium bottle', price: 45000, description: 'Bentuk kotak yang lebih tegas dan premium.', enabled: true, sortOrder: 20 },
  ],
  capDesigns: [
    { id: 'cap-biasa', label: 'Cap biasa', value: 'Cap biasa', price: 0, description: 'Simple, clean, ready stock.', enabled: true, sortOrder: 10 },
    { id: 'cap-batu', label: 'Cap batu', value: 'Cap batu', price: 75000, description: 'Statement cap dengan feel natural stone.', enabled: true, sortOrder: 20 },
    { id: 'cap-custom-akrilik', label: 'Cap custom akrilik', value: 'Cap custom akrilik', price: 125000, description: 'Custom color/form acrylic look.', enabled: true, sortOrder: 30 },
  ],
  labelDesigns: [
    { id: 'minimal-label', label: 'Minimal label', value: 'Minimal label', price: 0, description: 'Label clean dengan nama parfum dan detail basic.', enabled: true, sortOrder: 10 },
    { id: 'custom-name-label', label: 'Custom name label', value: 'Custom name label', price: 35000, description: 'Label dengan nama atau pesan personal.', enabled: true, sortOrder: 20 },
  ],
  exoticMaterials: [],
};

const toSlug = (value) => String(value || 'option')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'option';

const dispatchBespokeSettingsUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BESPOKE_SETTINGS_UPDATED_EVENT));
  }
};

const collectionFallbackOrder = (collectionKey) => (defaultBespokeSettings[collectionKey] || []).length * 10 + 10;

const normalizeOption = (option = {}) => {
  const label = String(option.label || option.value || 'Untitled option').trim();
  return {
    id: option.id || `${toSlug(label)}-${Date.now()}`,
    label,
    value: String(option.value || label).trim(),
    price: Math.max(Number(option.price || 0), 0),
    description: String(option.description || '').trim(),
    imageUrl: String(option.imageUrl || option.image_url || '').trim(),
    enabled: option.enabled !== false,
    sortOrder: Number(option.sortOrder ?? option.sort_order ?? collectionFallbackOrder(option.collectionKey || option.collection_key)),
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

const writeSettings = (settings, shouldDispatch = true) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BESPOKE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  if (shouldDispatch) dispatchBespokeSettingsUpdate();
};

const cacheFetchedSettings = (settings) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BESPOKE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

const toDatabasePayload = (collectionKey, option, index = 0) => ({
  id: option.id,
  collection_key: collectionKey,
  label: option.label,
  value: option.value,
  price: option.price,
  description: option.description,
  image_url: option.imageUrl || null,
  enabled: option.enabled,
  sort_order: Number(option.sortOrder || ((index + 1) * 10)),
});

const fromDatabaseRow = (row) => normalizeOption({
  id: row.id,
  label: row.label,
  value: row.value,
  price: row.price,
  description: row.description,
  imageUrl: row.image_url,
  enabled: row.enabled,
  sortOrder: row.sort_order,
  collectionKey: row.collection_key,
});

const settingsFromRows = (rows = []) => {
  if (!rows.length) return normalizeBespokeSettings(defaultBespokeSettings);

  const groupedRows = rows.reduce((groups, row) => {
    if (!optionCollections.includes(row.collection_key)) return groups;
    return {
      ...groups,
      [row.collection_key]: [...(groups[row.collection_key] || []), fromDatabaseRow(row)],
    };
  }, {});

  return optionCollections.reduce((settings, key) => ({
    ...settings,
    [key]: groupedRows[key] || [],
  }), {});
};

export const getBespokeSettings = () => normalizeBespokeSettings(readStoredSettings());

export const getBespokeSettingsAsync = async () => {
  try {
    const { data, error } = await supabase
      .from('storefront_bespoke_options')
      .select('*')
      .order('collection_key', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (error) throw error;

    const settings = settingsFromRows(data || []);
    cacheFetchedSettings(settings);
    return settings;
  } catch (error) {
    console.warn('Using local bespoke settings fallback:', error.message || error);
    return getBespokeSettings();
  }
};

export const getActiveBespokeOptions = (key) => getBespokeSettings()[key].filter((option) => option.enabled);

export const saveBespokeOption = async (collectionKey, option) => {
  const settings = getBespokeSettings();
  const normalizedOption = normalizeOption({ ...option, collectionKey });
  const options = settings[collectionKey] || [];
  const nextOptions = options.some((item) => item.id === normalizedOption.id)
    ? options.map((item) => (item.id === normalizedOption.id ? normalizedOption : item))
    : [...options, normalizedOption];
  const nextSettings = { ...settings, [collectionKey]: nextOptions };

  try {
    const { data, error } = await supabase
      .from('storefront_bespoke_options')
      .upsert(toDatabasePayload(collectionKey, normalizedOption, nextOptions.length - 1))
      .select('*')
      .single();

    if (error) throw error;

    writeSettings(nextSettings);
    return fromDatabaseRow(data);
  } catch (error) {
    console.warn('Saving bespoke option locally because database save failed:', error.message || error);
    writeSettings(nextSettings);
    return normalizedOption;
  }
};

export const deleteBespokeOption = async (collectionKey, optionId) => {
  const settings = getBespokeSettings();
  const nextSettings = {
    ...settings,
    [collectionKey]: (settings[collectionKey] || []).filter((option) => option.id !== optionId),
  };

  try {
    const { error } = await supabase
      .from('storefront_bespoke_options')
      .delete()
      .eq('collection_key', collectionKey)
      .eq('id', optionId);

    if (error) throw error;

    writeSettings(nextSettings);
  } catch (error) {
    console.warn('Deleting bespoke option locally because database delete failed:', error.message || error);
    writeSettings(nextSettings);
  }

  return nextSettings;
};

export const resetBespokeSettings = async () => {
  const settings = normalizeBespokeSettings(defaultBespokeSettings);
  const rows = optionCollections.flatMap((collectionKey) => (
    settings[collectionKey].map((option, index) => toDatabasePayload(collectionKey, option, index))
  ));

  try {
    const { error: deleteError } = await supabase
      .from('storefront_bespoke_options')
      .delete()
      .in('collection_key', optionCollections);

    if (deleteError) throw deleteError;

    if (rows.length) {
      const { error: insertError } = await supabase
        .from('storefront_bespoke_options')
        .insert(rows);

      if (insertError) throw insertError;
    }

    writeSettings(settings);
  } catch (error) {
    console.warn('Resetting bespoke settings locally because database reset failed:', error.message || error);
    writeSettings(settings);
  }

  return settings;
};
