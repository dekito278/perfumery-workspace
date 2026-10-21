-- The invoice counter was fenced on one side only.
--
-- MANUAL APPLY REQUIRED: run this in the Supabase SQL editor.
--
-- 20261021140000_invoice_numbers.sql ended with `revoke all on function
-- storefront_next_invoice_number() from anon`, which is the exact pattern the note at the bottom of
-- 20260819123000_revoke_public_execute_on_guarded_rpcs.sql forbids, two months after that audit wrote it:
-- Postgres grants EXECUTE to PUBLIC on every new function, and revoking from `anon` does not touch it.
--
-- Measured against production with the ANON key, 2026-10-22:
--   POST /rest/v1/rpc/storefront_next_invoice_number  ->  {"code":"P0001","message":"admin only"}
-- P0001 is the `raise exception` inside the BODY. Reaching it means anon executed the function; had the
-- grant been closed the answer would have been 42501, permission denied, from Postgres itself.
--
-- NOTHING WAS AT RISK AND NOTHING WAS CONSUMED: is_admin() raises before the update, so no invoice
-- number was handed out or burned, and `select year, last_number` still reads 2026 / 4. What was missing
-- is the outer fence — the body was carrying the whole weight alone, one typo from being the only thing
-- between anon and the shop's invoice sequence.

revoke execute on function public.storefront_next_invoice_number() from public;
grant execute on function public.storefront_next_invoice_number() to authenticated, service_role;

-- Verify as anon: this must now answer 42501 "permission denied for function", NOT "admin only".
--   curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/storefront_next_invoice_number" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
-- And Dekito's own invoice button must keep working — he is `authenticated`, granted above.
--
-- The counter is untouched by this migration; it should still read 2026 / 4 until the first PDF:
select year, last_number from public.storefront_invoice_counters order by year;

-- Rollback (the body's own is_admin() check still holds, so this is safe but pointless):
--   grant execute on function public.storefront_next_invoice_number() to public;
