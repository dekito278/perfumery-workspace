import supabase from '@/lib/supabaseClient.js';
import { DEFAULT_SITE_FACTS, normalizeSiteFacts } from '@/data/siteFacts.js';

// One row of shop facts (src/data/siteFacts.js), read by every buyer and written by an admin only — the
// row policy is the gate, not this file. Held in memory, not localStorage: the defaults ARE the shop's
// last known words, so a cached copy could only ever be staler than them (see the stale-catalogue notes).
const TABLE = 'storefront_site_settings';
const ROW_ID = 'default';

let current = DEFAULT_SITE_FACTS;
let loading = null;
const listeners = new Set();

const publish = (facts) => {
  current = normalizeSiteFacts(facts);
  listeners.forEach((listener) => listener());
  return current;
};

export const getSiteFacts = () => current;

export const subscribeSiteFacts = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Once per page load. Never throws: every caller is a render path, and the defaults are a whole answer. */
export const loadSiteFacts = () => {
  if (!loading) {
    loading = supabase.from(TABLE).select('facts').eq('id', ROW_ID).maybeSingle()
      .then(({ data, error }) => (error || !data ? current : publish(data.facts)))
      .catch(() => current);
  }
  return loading;
};

export const saveSiteFacts = async (facts) => {
  const next = normalizeSiteFacts(facts);
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({ id: ROW_ID, facts: next }, { onConflict: 'id' })
    .select('facts')
    .maybeSingle();
  if (error) throw new Error(error.message || 'Gagal menyimpan pengaturan toko');
  if (!data) throw new Error('Pengaturan toko tidak tersimpan — akun ini tidak punya hak admin.');
  return publish(data.facts);
};
