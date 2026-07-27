import supabase from '@/lib/supabaseClient.js';
import {
  SHIPPING_PROMOTION_PRESETS,
  applyShippingPromotionToRates as coreApplyShippingPromotionToRates,
  defaultShippingPromotionSettings,
  getShippingDestinationArea,
  getShippingPromotionEligibility,
  getShippingPromotionPreview,
  isJavaShippingDestination,
  normalizeShippingPromotionSettings,
  shippingPromotionPresetLabels,
} from '@/utils/shippingPromotion.js';

// Re-export the pure promo API so existing importers of this service keep working unchanged.
export {
  SHIPPING_PROMOTION_PRESETS,
  defaultShippingPromotionSettings,
  getShippingDestinationArea,
  getShippingPromotionEligibility,
  getShippingPromotionPreview,
  isJavaShippingDestination,
  normalizeShippingPromotionSettings,
  shippingPromotionPresetLabels,
};

export const SHIPPING_PROMOTION_STORAGE_KEY = 'solivagant.shipping-promotion.v1';
export const SHIPPING_PROMOTION_UPDATED_EVENT = 'solivagant:shipping-promotion-updated';
const SHIPPING_PROMOTION_TABLE = 'storefront_shipping_promotion_settings';
const SHIPPING_PROMOTION_ROW_ID = 'default';
let shippingPromotionCache = null;

export const getShippingPromotionSettings = () => {
  if (shippingPromotionCache) {
    return shippingPromotionCache;
  }

  if (typeof window === 'undefined') {
    return defaultShippingPromotionSettings;
  }

  try {
    const parsedValue = JSON.parse(window.localStorage.getItem(SHIPPING_PROMOTION_STORAGE_KEY) || '{}');
    const settings = normalizeShippingPromotionSettings(parsedValue);
    shippingPromotionCache = settings;
    return settings;
  } catch {
    return defaultShippingPromotionSettings;
  }
};

const cacheSettings = (settings, shouldDispatch = true) => {
  shippingPromotionCache = normalizeShippingPromotionSettings(settings);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SHIPPING_PROMOTION_STORAGE_KEY, JSON.stringify(shippingPromotionCache));
    if (shouldDispatch) {
      window.dispatchEvent(new CustomEvent(SHIPPING_PROMOTION_UPDATED_EVENT, { detail: shippingPromotionCache }));
    }
  }

  return shippingPromotionCache;
};

const fromDatabaseRow = (row = {}) => normalizeShippingPromotionSettings({
  enabled: row.enabled,
  preset: row.preset,
  javaAmount: row.java_amount,
  otherAmount: row.other_amount,
  minimumSubtotal: row.minimum_subtotal,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  updatedAt: row.updated_at,
});

const toDatabasePayload = (settings) => ({
  id: SHIPPING_PROMOTION_ROW_ID,
  enabled: settings.enabled,
  preset: settings.preset,
  java_amount: Number(settings.javaAmount || 0),
  other_amount: Number(settings.otherAmount || 0),
  minimum_subtotal: Number(settings.minimumSubtotal || 0),
  starts_at: settings.startsAt || null,
  ends_at: settings.endsAt || null,
  updated_at: settings.updatedAt || new Date().toISOString(),
});

export const getShippingPromotionSettingsAsync = async () => {
  try {
    const { data, error } = await supabase
      .from(SHIPPING_PROMOTION_TABLE)
      .select('*')
      .eq('id', SHIPPING_PROMOTION_ROW_ID)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return getShippingPromotionSettings();
    }

    return cacheSettings(fromDatabaseRow(data), false);
  } catch (error) {
    console.warn('Using local shipping promotion fallback:', error.message || error);
    return getShippingPromotionSettings();
  }
};

export const saveShippingPromotionSettings = async (settings) => {
  const nextSettings = normalizeShippingPromotionSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });

  try {
    const { data, error } = await supabase
      .from(SHIPPING_PROMOTION_TABLE)
      .upsert(toDatabasePayload(nextSettings))
      .select('*')
      .single();

    if (error) throw error;

    return cacheSettings(fromDatabaseRow(data));
  } catch (error) {
    console.warn('Saving shipping promotion locally because database save failed:', error.message || error);
    return cacheSettings(nextSettings);
  }
};

export const resetShippingPromotionSettings = async () => {
  shippingPromotionCache = null;

  try {
    const { error } = await supabase
      .from(SHIPPING_PROMOTION_TABLE)
      .delete()
      .eq('id', SHIPPING_PROMOTION_ROW_ID);

    if (error) throw error;
  } catch (error) {
    console.warn('Resetting local shipping promotion fallback:', error.message || error);
  }

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(SHIPPING_PROMOTION_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(SHIPPING_PROMOTION_UPDATED_EVENT, { detail: defaultShippingPromotionSettings }));
  }

  return defaultShippingPromotionSettings;
};

// Client wrapper: default to the cached promo settings. The pure core (no cache) lives in
// utils/shippingPromotion.js for isomorphic use.
export const applyShippingPromotionToRates = (rates = [], destination, settings = getShippingPromotionSettings(), context = {}) => (
  coreApplyShippingPromotionToRates(rates, destination, settings, context)
);

