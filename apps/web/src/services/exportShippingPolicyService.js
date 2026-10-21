import supabase from '@/lib/supabaseClient.js';
import {
  DEFAULT_EXPORT_SHIPPING_POLICY, normalizeExportShippingPolicy,
} from '@/utils/exportShippingPolicy.js';

// How much of the freight the shop carries, and the rate it converts the carrier's rupiah at.
//
// CACHED AND SYNCHRONOUS TO READ, like the domestic promotion settings next door, because the cart
// prices a parcel during render. An async read here would have made the shipping line appear a beat
// after the total, or worse, be computed twice with two different answers on one screen.
//
// Falling back to the constants is the normal case, not an error: the table may not exist yet, and the
// numbers it would hold are the ones already compiled in. So a missing row, a missing table and a
// network blip all produce today's prices rather than a blank.

export const EXPORT_SHIPPING_POLICY_STORAGE_KEY = 'solivagant.export-shipping-policy.v1';
export const EXPORT_SHIPPING_POLICY_UPDATED_EVENT = 'solivagant:export-shipping-policy-updated';
const TABLE = 'storefront_export_shipping_settings';
const ROW_ID = 'default';

let cache = null;

export const getExportShippingPolicy = () => {
  if (cache) return cache;
  if (typeof window === 'undefined') return DEFAULT_EXPORT_SHIPPING_POLICY;
  try {
    const stored = JSON.parse(window.localStorage.getItem(EXPORT_SHIPPING_POLICY_STORAGE_KEY) || '{}');
    cache = normalizeExportShippingPolicy(stored);
    return cache;
  } catch {
    return DEFAULT_EXPORT_SHIPPING_POLICY;
  }
};

const cachePolicy = (policy, dispatch = true) => {
  cache = normalizeExportShippingPolicy(policy);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(EXPORT_SHIPPING_POLICY_STORAGE_KEY, JSON.stringify(cache));
    if (dispatch) {
      window.dispatchEvent(new CustomEvent(EXPORT_SHIPPING_POLICY_UPDATED_EVENT, { detail: cache }));
    }
  }
  return cache;
};

/** Refresh from the database. Never throws: the caller is a render path. */
export const refreshExportShippingPolicy = async () => {
  try {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', ROW_ID).maybeSingle();
    if (error || !data) return getExportShippingPolicy();
    return cachePolicy(data);
  } catch {
    return getExportShippingPolicy();
  }
};

/** Admin only, enforced by the row policy rather than by this function. */
export const saveExportShippingPolicy = async (policy) => {
  const next = normalizeExportShippingPolicy(policy);
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({
      id: ROW_ID,
      support_single_usd: next.supportSingleUsd,
      support_multiple_usd: next.supportMultipleUsd,
      cost_rate_idr: next.costRateIdr,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message || 'Gagal menyimpan kebijakan ongkir ekspor');
  if (!data) throw new Error('Kebijakan ongkir tidak tersimpan — akun ini tidak punya hak admin.');
  return cachePolicy(next);
};
