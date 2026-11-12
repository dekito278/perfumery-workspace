-- Member prices stay with members. A visitor learns only THAT a perfume has one.
--
-- MANUAL APPLY, AFTER 20261021090000_scheduled_domestic_prices.sql. Run the whole file once in the
-- Supabase SQL editor. Safe to run twice.
--
-- WHY. Dekito, 12 Nov 2026 (#591): non-members see no member NUMBER anywhere — the page says "Ada harga
-- khusus member komunitas" and the way in, because the member price depends on the community code. The
-- page obeyed; the network did not. storefront_member_prices (20260914200000, then 20261021090000) is
-- granted to anon and returns every member price, so a signed-out browser fetched them all on every page
-- (visitor audit, 13 Nov 2026: "aquilaria-tuberosa member 721000, wongka 483000" in DevTools).
--
-- WHAT THE STOREFRONT ACTUALLY NEEDS from a non-member's point of view is one bit per line: is there a
-- member price here at all? That is storefront_member_price_lines. The numbers go back behind the door:
--   * a member reads their own price through storefront_prices_for_me (unchanged);
--   * Studio reads storefront_product_prices as an admin (unchanged);
--   * storefront_member_prices is no longer callable by anon or authenticated.
--
-- SAFE TO DELAY, AND SAFE IN EITHER ORDER. The app asks for storefront_member_price_lines first and falls
-- back to storefront_member_prices only while the new function is missing. Running this file switches
-- it over; until then nothing changes.

begin;

-- 1. The one bit -------------------------------------------------------------------------------------
-- Same rows as storefront_member_prices (the base price and any scheduled price in force, drafts left
-- out), without the number.
create or replace function public.storefront_member_price_lines(p_slugs text[] default null)
returns table (slug text, variant_id text)
language sql
stable
security definer
set search_path = public
as $$
    with in_force as (
        select pr.product_id, pr.variant_id, pr.tier
          from public.storefront_product_prices pr
        union all
        select sc.product_id, sc.variant_id, sc.tier
          from public.storefront_price_schedule sc
         where sc.effective_at <= now()
    )
    select distinct p.slug, f.variant_id
      from in_force f
      join public.storefront_products p on p.id = f.product_id
     where (p_slugs is null or p.slug = any (p_slugs))
       and f.tier = 'member'
       and not public.storefront_product_is_draft(p.tags);
$$;

revoke all on function public.storefront_member_price_lines(text[]) from public;
grant execute on function public.storefront_member_price_lines(text[]) to anon, authenticated;

-- 2. The numbers, closed -------------------------------------------------------------------------------
-- Functions are executable by PUBLIC by default, so PUBLIC is revoked too, not only the two roles.
revoke execute on function public.storefront_member_prices(text[]) from public, anon, authenticated;
grant execute on function public.storefront_member_prices(text[]) to service_role;

commit;

notify pgrst, 'reload schema';

-- ============================================================================
-- VERIFY — after running:
--   select proname, proacl from pg_proc where proname in ('storefront_member_prices', 'storefront_member_price_lines');
--     -> storefront_member_prices: postgres + service_role only
--     -> storefront_member_price_lines: anon + authenticated
--   With the ANON key:
--   curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/storefront_member_price_lines" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}'
--     -> [{"slug": "...", "variant_id": "..."}, ...]   (no price)
--   curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/storefront_member_prices" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}'
--     -> permission denied (42501)
--
-- ROLLBACK (member prices readable by anyone again):
--   grant execute on function public.storefront_member_prices(text[]) to anon, authenticated;
--   drop function if exists public.storefront_member_price_lines(text[]);
-- ============================================================================
