import supabase from '@/lib/supabaseClient.js';
import { deleteBespokeImages } from '@/services/bespokeImageStorageService.js';

export const BESPOKE_SETTINGS_STORAGE_KEY = 'dekito.storefront.bespoke-settings.v1';
export const BESPOKE_SETTINGS_UPDATED_EVENT = 'dekito:bespoke-settings-updated';

export const optionCollections = ['bottleSizes', 'bottleTypes', 'capDesigns', 'labelDesigns', 'exoticMaterials'];

// A snapshot of storefront_bespoke_options, used only while that table cannot be reached. It had
// drifted a long way from the shop — 30 ml read Rp 350.000 here against Rp 200.000 there — so an
// outage would have quoted prices nobody charges. warnIfBespokeDefaultsDrifted() in tools/build.mjs
// prints every difference on each build; keep this in step with what it reports.
// Mirrors storefront_bespoke_options as it stood when this was last synced. Read ONLY while that table
// is unreachable — the order endpoint always reprices from the table itself, so nothing here can be
// bought at these numbers. What it can do is promise a price or a bottle size the shop will not honour:
// before this sync it still offered 100 ml, which the shop had stopped selling, so a visitor who caught
// the outage filled in an entire brief and had the order rejected at the last step.
//
// `npm run build` prints every difference. When it does, re-read the table and paste the result here.
export const defaultBespokeSettings = {
  bottleSizes: [
    { id: "30-ml", label: "30 ml", value: "30 ml", price: 240000, description: "Ukuran default bespoke.", enabled: true, sortOrder: 10 },
    { id: "50-ml-1778532231031", label: "50 ml", value: "50 ml", price: 395000, description: "", enabled: true, sortOrder: 30 },
  ],
  bottleTypes: [
    { id: "classic-clear", label: "Classic", value: "Classic", price: 10000, description: "Bentuk botol basic, cap by request", enabled: true, sortOrder: 10 },
    { id: "square-premium", label: "Thematic Botol", value: "Thematic Botol", price: 50000, description: "Bentuk botol abstrak by request", enabled: true, sortOrder: 20 },
  ],
  capDesigns: [
    { id: "cap-custom-akrilik", label: "Cap custom Abstrak", value: "Cap custom Abstrak", price: 50000, description: "Custom color/form abstrak look.", enabled: true, sortOrder: 30 },
    { id: "cap-basic-1778533418244", label: "Cap Basic", value: "Cap Basic", price: 5000, description: "Cap basic, cap bulet, cap kotak", enabled: true, sortOrder: 40 },
  ],
  labelDesigns: [
    { id: "minimal-label", label: "Tulis tangan", value: "Tulis tangan", price: 0, description: "Label stiker dengan tulisan tangan saya", enabled: true, sortOrder: 10 },
    { id: "custom-name-label", label: "Custom name label", value: "Custom name label", price: 75000, description: "Label dengan nama atau pesan personal.\n+ penambahan waktu pengerjaan 14 hari", enabled: true, sortOrder: 20 },
    { id: "none-1778533982963", label: "None", value: "None", price: 0, description: "Tidak mengunakan stiker", enabled: true, sortOrder: 30 },
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
    // The English shop reads these when they are filled and falls back to the Indonesian when they are
    // not, so an option Dekito has not translated yet still has a name rather than a blank button.
    labelEn: String(option.labelEn || option.label_en || '').trim(),
    descriptionEn: String(option.descriptionEn || option.description_en || '').trim(),
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
  // Written back as well as read: Studio has no field for them yet, and a save that omitted them would
  // wipe the translations on the next edit.
  label_en: option.labelEn || null,
  description_en: option.descriptionEn || null,
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
  labelEn: row.label_en,
  descriptionEn: row.description_en,
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
  const previousOption = options.find((item) => item.id === normalizedOption.id);
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
    // Save succeeded — if this edit replaced the image, drop the old file so it isn't orphaned.
    if (previousOption?.imageUrl && previousOption.imageUrl !== normalizedOption.imageUrl) {
      deleteBespokeImages([previousOption.imageUrl]).catch((cleanupError) => console.warn('Bespoke image cleanup skipped:', cleanupError.message || cleanupError));
    }
    return fromDatabaseRow(data);
  } catch (error) {
    // Admin settings are read by customers from the DB — a silent localStorage-only "save" would show
    // the admin success while customers never see the change. Surface the failure instead.
    console.warn('Bespoke option save failed:', error.message || error);
    throw new Error('Gagal menyimpan opsi bespoke ke server. Perubahan belum tersimpan — coba lagi.');
  }
};

export const deleteBespokeOption = async (collectionKey, optionId) => {
  const settings = getBespokeSettings();
  const removedOption = (settings[collectionKey] || []).find((option) => option.id === optionId);
  const nextSettings = {
    ...settings,
    [collectionKey]: (settings[collectionKey] || []).filter((option) => option.id !== optionId),
  };

  try {
    // `.select('id')` is what makes a refusal visible: an RLS-filtered DELETE is 200 with zero rows and
    // error === null, so the throw below never fired and the option was removed from localStorage and
    // reported as deleted while customers kept seeing it on the bespoke form (audit round 9).
    const { data, error } = await supabase
      .from('storefront_bespoke_options')
      .delete()
      .eq('collection_key', collectionKey)
      .eq('id', optionId)
      .select('id');

    if (error) throw error;
    if (!data?.length) {
      throw new Error('tidak ada baris yang terhapus di server');
    }

    writeSettings(nextSettings);
    // Option is gone — remove its image so it isn't orphaned in storage.
    if (removedOption?.imageUrl) {
      deleteBespokeImages([removedOption.imageUrl]).catch((cleanupError) => console.warn('Bespoke image cleanup skipped:', cleanupError.message || cleanupError));
    }
  } catch (error) {
    console.warn('Bespoke option delete failed:', error.message || error);
    throw new Error(`Gagal menghapus opsi bespoke di server (${error.message || 'tidak diketahui'}). Muat ulang halaman — sesi admin mungkin sudah kedaluwarsa.`);
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
    console.warn('Bespoke settings reset failed:', error.message || error);
    throw new Error('Gagal reset bespoke settings di server. Coba lagi.');
  }

  return settings;
};

/**
 * What an option is called, in the shop the reader is standing in.
 *
 * The labels and descriptions live in storefront_bespoke_options, so no scan for Indonesian literals
 * could ever see them: the English bespoke page read "Tulis tangan", "Ukuran default bespoke." and a
 * heading saying "UKURAN" straight out of the database, in the middle of otherwise English copy.
 *
 * Falls back per FIELD, not per option: a row whose label is translated but whose description is not
 * should show the English name with the Indonesian note, rather than throwing both away. An empty
 * translation is not a translation.
 */
export const bespokeOptionText = (option = {}, isInternational = false) => {
  // Trimmed here as well as in normalizeOption: a row typed with a stray space is not a translation,
  // and this function is exported for callers that never went through the normaliser.
  const english = (value) => (isInternational ? String(value || '').trim() : '');
  return {
    label: english(option.labelEn) || option.label || '',
    description: english(option.descriptionEn) || option.description || '',
  };
};

/**
 * Every option in a settings object, named for one shop.
 *
 * Applied once, where the options enter the page, rather than at each of the ten places that render a
 * label — the two bespoke pages read them in about a dozen spots between them, and translating at the
 * render sites is how one of them would keep speaking Indonesian.
 *
 * NEVER applied to Studio's own editor: it writes these rows back, and handing it a translated `label`
 * would save the English text over the Indonesian one on the next edit.
 */
export const translateBespokeSettings = (settings = {}, isInternational = false) => {
  if (!isInternational) return settings;
  return Object.entries(settings).reduce((next, [key, value]) => ({
    ...next,
    [key]: Array.isArray(value)
      ? value.map((option) => ({ ...option, ...bespokeOptionText(option, true) }))
      : value,
  }), {});
};
