-- Member prices, readable by anyone. Reseller prices stay exactly as private as they are.
--
-- MANUAL APPLY. Do not run this from the app.
--
-- Dekito's decision, 2026-09-14: a visitor who has not signed in should SEE the member price, so that
-- signing in has a visible reason. Until now the only people who knew a member price existed were the
-- people already paying it — storefront_prices_for_me() returns the caller's own tier, and an anonymous
-- caller is retail.
--
-- This is a SEPARATE function rather than a change to that one, on purpose:
--   * storefront_prices_for_me keeps its contract (own tier + overseas), and the guard that reads its
--     text keeps holding.
--   * the WHERE clause here names the tier literally. There is no path by which this function can
--     return a reseller row, whoever calls it.
--   * the price table itself is still never granted. The function is the only way in.
--
-- SAFE TO DELAY. The app calls this through the same isSchemaMissing() fallback as the other tier RPCs:
-- until it exists, no member price is attached, and the storefront renders exactly as it does today.
-- It is also inert on its own — with no member prices filled in yet, it returns zero rows.

create or replace function public.storefront_member_prices(p_slugs text[] default null)
returns table (
    slug text,
    variant_id text,
    tier text,
    price_number numeric
)
language sql
stable
security definer
set search_path = public
as $$
    select p.slug, pr.variant_id, pr.tier, pr.price_number
      from public.storefront_product_prices pr
      join public.storefront_products p on p.id = pr.product_id
     where (p_slugs is null or p.slug = any (p_slugs))
       and pr.tier = 'member'
       and not public.storefront_product_is_draft(p.tags);
$$;

grant execute on function public.storefront_member_prices(text[]) to anon, authenticated;

-- ============================================================================
-- VERIFY — with the ANON key. Expect member rows only, never a reseller one.
-- ============================================================================
-- curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/storefront_member_prices" \
--   -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d '{}'
--
-- -- In SQL, the function must be unable to leak a reseller price even if one exists:
-- select count(*) filter (where tier <> 'member') as non_member_rows
--   from public.storefront_member_prices(null);          -- expect 0
--
-- -- And the table itself must still be closed (this should FAIL as anon):
-- -- select * from public.storefront_product_prices;

-- ============================================================================
-- ROLLBACK — removes the public view of member prices; nothing else changes.
-- ============================================================================
-- drop function if exists public.storefront_member_prices(text[]);
