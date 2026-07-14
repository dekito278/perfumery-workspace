-- Phase 1b of the admin/customer RLS split (follows 20260715120000).
-- Re-point the remaining "admin" policies that assumed authenticated == owner to
-- public.is_admin(). Each table is guarded with to_regclass so absent tables (e.g.
-- storefront_shipping_promotion_settings on installs that never created it) are skipped.
--
-- Verified safe against customer-facing flows:
--   * Order reads: SECURITY DEFINER RPCs (storefront_customer_portal,
--     storefront_payment_session_lookup, storefront_public_tracking_lookup).
--   * Order creation: kept as public INSERT (anon checkout).
--   * Payment-status writes: server-side DOKU endpoints via service role (apps/web/api/doku/*).
--   * Voucher usage / inventory: SECURITY DEFINER RPCs.
--   * Public SELECT kept on products/categories/vouchers/bespoke/shipping.

do $$
begin
  -- storefront_orders: reads/mutations admin-only; keep public INSERT for checkout.
  if to_regclass('public.storefront_orders') is not null then
    execute $q$drop policy if exists "storefront orders admin select" on public.storefront_orders$q$;
    execute $q$create policy "storefront orders admin select" on public.storefront_orders for select using (public.is_admin())$q$;
    execute $q$drop policy if exists "storefront orders admin update" on public.storefront_orders$q$;
    execute $q$create policy "storefront orders admin update" on public.storefront_orders for update using (public.is_admin()) with check (public.is_admin())$q$;
    execute $q$drop policy if exists "storefront orders admin delete" on public.storefront_orders$q$;
    execute $q$create policy "storefront orders admin delete" on public.storefront_orders for delete using (public.is_admin())$q$;
  end if;

  -- storefront_products (public SELECT kept)
  if to_regclass('public.storefront_products') is not null then
    execute $q$drop policy if exists "storefront products admin insert" on public.storefront_products$q$;
    execute $q$create policy "storefront products admin insert" on public.storefront_products for insert with check (public.is_admin())$q$;
    execute $q$drop policy if exists "storefront products admin update" on public.storefront_products$q$;
    execute $q$create policy "storefront products admin update" on public.storefront_products for update using (public.is_admin()) with check (public.is_admin())$q$;
    execute $q$drop policy if exists "storefront products admin delete" on public.storefront_products$q$;
    execute $q$create policy "storefront products admin delete" on public.storefront_products for delete using (public.is_admin())$q$;
  end if;

  -- storefront_product_categories (public SELECT kept)
  if to_regclass('public.storefront_product_categories') is not null then
    execute $q$drop policy if exists "storefront product categories admin insert" on public.storefront_product_categories$q$;
    execute $q$create policy "storefront product categories admin insert" on public.storefront_product_categories for insert with check (public.is_admin())$q$;
    execute $q$drop policy if exists "storefront product categories admin update" on public.storefront_product_categories$q$;
    execute $q$create policy "storefront product categories admin update" on public.storefront_product_categories for update using (public.is_admin()) with check (public.is_admin())$q$;
    execute $q$drop policy if exists "storefront product categories admin delete" on public.storefront_product_categories$q$;
    execute $q$create policy "storefront product categories admin delete" on public.storefront_product_categories for delete using (public.is_admin())$q$;
  end if;

  -- storefront_vouchers (public SELECT kept — needed for checkout voucher validation)
  if to_regclass('public.storefront_vouchers') is not null then
    execute $q$drop policy if exists "storefront vouchers admin insert" on public.storefront_vouchers$q$;
    execute $q$create policy "storefront vouchers admin insert" on public.storefront_vouchers for insert with check (public.is_admin())$q$;
    execute $q$drop policy if exists "storefront vouchers admin update" on public.storefront_vouchers$q$;
    execute $q$create policy "storefront vouchers admin update" on public.storefront_vouchers for update using (public.is_admin()) with check (public.is_admin())$q$;
    execute $q$drop policy if exists "storefront vouchers admin delete" on public.storefront_vouchers$q$;
    execute $q$create policy "storefront vouchers admin delete" on public.storefront_vouchers for delete using (public.is_admin())$q$;
  end if;

  -- storefront_bespoke_options (public SELECT kept)
  if to_regclass('public.storefront_bespoke_options') is not null then
    execute $q$drop policy if exists "storefront bespoke options admin insert" on public.storefront_bespoke_options$q$;
    execute $q$create policy "storefront bespoke options admin insert" on public.storefront_bespoke_options for insert with check (public.is_admin())$q$;
    execute $q$drop policy if exists "storefront bespoke options admin update" on public.storefront_bespoke_options$q$;
    execute $q$create policy "storefront bespoke options admin update" on public.storefront_bespoke_options for update using (public.is_admin()) with check (public.is_admin())$q$;
    execute $q$drop policy if exists "storefront bespoke options admin delete" on public.storefront_bespoke_options$q$;
    execute $q$create policy "storefront bespoke options admin delete" on public.storefront_bespoke_options for delete using (public.is_admin())$q$;
  end if;

  -- storefront_shipping_promotion_settings (public SELECT kept)
  if to_regclass('public.storefront_shipping_promotion_settings') is not null then
    execute $q$drop policy if exists "storefront shipping promotion admin insert" on public.storefront_shipping_promotion_settings$q$;
    execute $q$create policy "storefront shipping promotion admin insert" on public.storefront_shipping_promotion_settings for insert with check (public.is_admin())$q$;
    execute $q$drop policy if exists "storefront shipping promotion admin update" on public.storefront_shipping_promotion_settings$q$;
    execute $q$create policy "storefront shipping promotion admin update" on public.storefront_shipping_promotion_settings for update using (public.is_admin()) with check (public.is_admin())$q$;
    execute $q$drop policy if exists "storefront shipping promotion admin delete" on public.storefront_shipping_promotion_settings$q$;
    execute $q$create policy "storefront shipping promotion admin delete" on public.storefront_shipping_promotion_settings for delete using (public.is_admin())$q$;
  end if;
end $$;
