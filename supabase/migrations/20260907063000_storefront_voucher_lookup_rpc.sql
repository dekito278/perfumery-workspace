-- Audit round 9, V-1 (step 1 of 2, ADDITIVE — run before deploying the client).
--
-- storefront_vouchers has kept a public SELECT "for checkout validation", so one anon GET listed every
-- code, discount, quota and expiry — released or not. Checkout only ever needs ONE row for ONE code the
-- buyer typed. This RPC returns exactly that (or nothing); step 2 then closes the table.
create or replace function public.storefront_voucher_lookup(p_code text)
returns setof public.storefront_vouchers
language sql
stable
security definer
set search_path = public
as $$
    select *
    from public.storefront_vouchers
    where code = upper(regexp_replace(trim(coalesce(p_code, '')), '\s+', '', 'g'))
    limit 1;
$$;

grant execute on function public.storefront_voucher_lookup(text) to anon, authenticated, service_role;

-- Verify (anon key): a real code returns one row, a made-up code returns [].
--   curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/storefront_voucher_lookup" -H "apikey: $ANON" \
--     -H "Content-Type: application/json" -d '{"p_code":"NOPE-123"}'   → []
