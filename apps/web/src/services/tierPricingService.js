import supabase from '@/lib/supabaseClient.js';
import { indexTierPrices } from '@/utils/tierPrice.js';

// The migration that creates these tables and functions is applied by hand, so every read here has to
// survive them not being there yet. A missing schema is not an error the storefront should show: retail
// is a real price, and falling back to it is correct. Studio is the opposite — it must say so plainly,
// or the owner fills in member prices that quietly do nothing.
const SCHEMA_MISSING_CODES = new Set([
  '42P01', // undefined_table
  '42883', // undefined_function
  '42703', // undefined_column
  'PGRST202', // PostgREST: function not found in schema cache
]);

export const isSchemaMissing = (error) => Boolean(
  error && (SCHEMA_MISSING_CODES.has(error.code) || /does not exist|schema cache/i.test(error.message || '')),
);

/** The caller's tier, resolved by the server from their session. Always safe to call. */
export const getMyPriceTier = async () => {
  try {
    const { data, error } = await supabase.rpc('storefront_my_price_tier');
    if (error) throw error;
    return { tier: String(data || 'retail'), schemaReady: true };
  } catch (error) {
    if (!isSchemaMissing(error)) {
      console.warn('Price tier lookup failed, treating as retail:', error?.message || error);
    }
    return { tier: 'retail', schemaReady: !isSchemaMissing(error) };
  }
};

/** Tier prices the caller is entitled to, indexed by slug then variant. Empty when not migrated yet. */
export const getTierPricesFor = async (slugs = null) => {
  try {
    const { data, error } = await supabase.rpc('storefront_prices_for_me', {
      p_slugs: Array.isArray(slugs) && slugs.length ? slugs : null,
    });
    if (error) throw error;
    return { index: indexTierPrices(data || []), schemaReady: true };
  } catch (error) {
    if (!isSchemaMissing(error)) {
      console.warn('Tier price lookup failed, falling back to retail:', error?.message || error);
    }
    return { index: {}, schemaReady: !isSchemaMissing(error) };
  }
};

/**
 * Member prices for everyone, signed in or not — the reason to sign in, made visible. Reseller prices
 * never come through here: the function names the tier literally. Empty until the migration runs, and
 * empty again until Dekito fills prices in, so the nudge stays silent on both counts.
 */
export const getPublicMemberPrices = async (slugs = null) => {
  try {
    const { data, error } = await supabase.rpc('storefront_member_prices', {
      p_slugs: Array.isArray(slugs) && slugs.length ? slugs : null,
    });
    if (error) throw error;
    return { index: indexTierPrices(data || []), schemaReady: true };
  } catch (error) {
    if (!isSchemaMissing(error)) {
      console.warn('Public member price lookup failed; showing no member prices:', error?.message || error);
    }
    return { index: {}, schemaReady: !isSchemaMissing(error) };
  }
};

// --- admin ------------------------------------------------------------------------------------------

/** Every tier price on one product, for the Studio editor. */
export const listTierPricesForProduct = async (productId) => {
  if (!productId) return { rows: [], schemaReady: true };
  const { data, error } = await supabase
    .from('storefront_product_prices')
    .select('id, variant_id, tier, price_number')
    .eq('product_id', productId);

  if (error) {
    if (isSchemaMissing(error)) return { rows: [], schemaReady: false };
    throw new Error(error.message || 'Gagal memuat harga bertingkat');
  }
  return { rows: data || [], schemaReady: true };
};

/**
 * Writes one tier price, or clears it when the price is empty. Returns the affected row: storefront_
 * product_prices is admin-only, so a non-admin write is filtered by RLS and comes back as zero rows
 * rather than an error — which is the silent write this repo has been bitten by repeatedly.
 */
/**
 * Every member price in the shop, in ONE read, for the curation screen. Reading them per product would
 * be 18 sequential round trips before the table could draw a single row.
 *
 * Keyed `productId|variantId`, which is how the tier table is keyed — matching on slug instead would tie
 * the prices to a name the owner is free to change.
 */
export const listMemberTierPrices = async () => {
  const { data, error } = await supabase
    .from('storefront_product_prices')
    .select('product_id, variant_id, price_number')
    .eq('tier', 'member');

  if (error) {
    if (isSchemaMissing(error)) return { index: {}, schemaReady: false };
    throw new Error(error.message || 'Gagal memuat harga member');
  }

  const index = {};
  for (const row of data || []) {
    index[`${row.product_id}|${row.variant_id || ''}`] = Number(row.price_number) || 0;
  }
  return { index, schemaReady: true };
};

export const saveTierPrice = async ({ productId, variantId = '', tier, priceNumber }) => {
  if (!productId || !tier) throw new Error('Produk dan tingkat harga wajib diisi');

  const price = Number(priceNumber);
  if (!Number.isFinite(price) || price <= 0) {
    return deleteTierPrice({ productId, variantId, tier });
  }

  const { data, error } = await supabase
    .from('storefront_product_prices')
    .upsert(
      { product_id: productId, variant_id: variantId || '', tier, price_number: Math.round(price), updated_at: new Date().toISOString() },
      { onConflict: 'product_id,variant_id,tier' },
    )
    .select('id')
    .maybeSingle();

  if (error) {
    if (isSchemaMissing(error)) throw new Error('Tabel harga bertingkat belum ada — jalankan migrasinya dulu.');
    throw new Error(error.message || 'Gagal menyimpan harga bertingkat');
  }
  if (!data) throw new Error('Harga bertingkat tidak tersimpan — akun ini tidak punya hak admin.');
  return data;
};

export const deleteTierPrice = async ({ productId, variantId = '', tier }) => {
  const match = (query) => query
    .eq('product_id', productId)
    .eq('variant_id', variantId || '')
    .eq('tier', tier);

  const { error } = await match(supabase.from('storefront_product_prices').delete()).select('id');

  if (error) {
    if (isSchemaMissing(error)) return null;
    throw new Error(error.message || 'Gagal menghapus harga bertingkat');
  }

  // Zero rows deleted is ambiguous: either there was nothing to clear, or RLS refused and the price is
  // still there. Only a read afterwards can tell the two apart, and the difference is whether the owner
  // just saw "tersimpan" over a price that did not move.
  const { data: leftover, error: readError } = await match(
    supabase.from('storefront_product_prices').select('id'),
  ).maybeSingle();

  if (!readError && leftover) {
    throw new Error('Harga bertingkat tidak terhapus — akun ini tidak punya hak admin.');
  }
  return null;
};

/**
 * Whether storefront_customers.tier exists yet. Reading the customer list cannot tell us: select('*')
 * succeeds and simply omits the column, so without this probe the Studio would show every customer as
 * retail and only fail on the first save.
 */
export const customerTierSchemaReady = async () => {
  const { error } = await supabase.from('storefront_customers').select('tier').limit(1);
  if (!error) return true;
  if (isSchemaMissing(error)) return false;
  // A different failure (network, auth) says nothing about the column; assume it is there rather than
  // showing a migration warning that is not true.
  console.warn('Customer tier probe failed:', error.message || error);
  return true;
};

/** Promote or demote a customer. Member needs no row — it follows from having an account. */
export const setCustomerTier = async (customerId, tier) => {
  if (!customerId) throw new Error('Pelanggan tidak dikenal');

  const { data, error } = await supabase
    .from('storefront_customers')
    .update({ tier })
    .eq('id', customerId)
    .select('id, tier')
    .maybeSingle();

  if (error) {
    if (isSchemaMissing(error)) throw new Error('Kolom tingkat pelanggan belum ada — jalankan migrasinya dulu.');
    throw new Error(error.message || 'Gagal mengubah tingkat pelanggan');
  }
  if (!data) throw new Error('Tingkat pelanggan tidak tersimpan — akun ini tidak punya hak admin.');
  return data;
};
