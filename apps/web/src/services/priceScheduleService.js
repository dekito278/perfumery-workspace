// What a product's price is going to become, and when.
//
// storefront_price_schedule holds prices that take over on a date. Until 2026-10-23 nothing in Studio
// mentioned it: Dekito could edit a price, save it, and — once the date had passed — watch the shop go
// on charging the scheduled number, because storefront_prices_for_me prefers a dated row over an
// undated one and keeps preferring it for ever.
//
// The schedule is one-shot now (20261112090000 applies it and deletes it), but a schedule nobody can
// see is the part that made it dangerous, not the ordering. This is the window into it.
//
// Admin-only by RLS, so an anonymous visitor reading this gets nothing rather than an error page.
import supabase from '@/lib/supabaseClient.js';

const TABLE = 'storefront_price_schedule';

/**
 * Rows still waiting, plus the ones already in force, for one product.
 *
 * BOTH, deliberately. A row whose date has passed is the one that is overriding the field Dekito is
 * looking at right now — it is more urgent to show than one that has not happened yet.
 *
 * @returns [{ variantId, tier, priceNumber, effectiveAt, inForce }] oldest first, or [] on any failure.
 */
export const getScheduledPricesForProduct = async (productId) => {
  if (!productId) return [];
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('variant_id, tier, price_number, effective_at')
      .eq('product_id', productId)
      .order('effective_at', { ascending: true });
    if (error || !Array.isArray(data)) return [];
    const now = Date.now();
    return data.map((row) => ({
      variantId: row.variant_id || '',
      tier: row.tier || '',
      priceNumber: Number(row.price_number) || 0,
      effectiveAt: row.effective_at || null,
      inForce: row.effective_at ? new Date(row.effective_at).getTime() <= now : false,
    }));
  } catch {
    return [];
  }
};
