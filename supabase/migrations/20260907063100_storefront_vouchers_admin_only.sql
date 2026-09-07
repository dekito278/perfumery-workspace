-- Audit round 9, V-1 + V-2 (step 2 of 2). ONLY after the client from the same PR is live: an older client
-- still lists the table (it would see [] — RLS filters, it does not error — and every voucher would read
-- as "tidak ditemukan") and still records usage from the browser (it would now be refused).
--
--  V-1: storefront_vouchers SELECT → admins only. The public goes through storefront_voucher_lookup(code).
--  V-2: storefront_record_voucher_usage → service role only. api/orders/create.js records usage at order
--       creation; nothing in the browser may burn a voucher's quota any more (an anon caller could exhaust
--       any promo with fake order numbers).
--  Bonus: usage records were readable by every `authenticated` user, i.e. every Google-login customer.
begin;

drop policy if exists "storefront vouchers public select" on public.storefront_vouchers;
create policy "storefront vouchers public select"
    on public.storefront_vouchers
    for select
    using (public.is_admin());

revoke execute on function public.storefront_record_voucher_usage(text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.storefront_record_voucher_usage(text, uuid, text, integer) to service_role;

drop policy if exists "storefront voucher usage admin select" on public.storefront_voucher_usage_records;
create policy "storefront voucher usage admin select"
    on public.storefront_voucher_usage_records
    for select
    using (public.is_admin());

commit;

-- Verify (anon key):
--   GET  .../rest/v1/storefront_vouchers?select=code                      → []
--   POST .../rest/v1/rpc/storefront_voucher_lookup {"p_code":"<real>"}    → 1 row
--   POST .../rest/v1/rpc/storefront_record_voucher_usage {...}            → 42501 permission denied
--   a real checkout with a voucher: storefront_voucher_usage_records gains one row.
--
-- Rollback:
--   begin;
--   drop policy if exists "storefront vouchers public select" on public.storefront_vouchers;
--   create policy "storefront vouchers public select" on public.storefront_vouchers for select using (true);
--   grant execute on function public.storefront_record_voucher_usage(text, uuid, text, integer) to anon, authenticated;
--   drop policy if exists "storefront voucher usage admin select" on public.storefront_voucher_usage_records;
--   create policy "storefront voucher usage admin select" on public.storefront_voucher_usage_records for select using (auth.role() = 'authenticated');
--   commit;
