-- Audit round 7 follow-up — the guards added in 20260819120000/121000/122000 were bypassable.
--
-- MANUAL APPLY REQUIRED: run this in the Supabase SQL editor.
--
-- Postgres grants EXECUTE to the PUBLIC role on every newly created function, and `revoke execute … from
-- anon` does NOT remove that. Verified on production 2026-08-19: every one of these still carried
-- `=X/postgres` (the PUBLIC entry) in proacl, so:
--   - anon could still call storefront_account_payload and storefront_restore_inventory_for_order, the two
--     the earlier migrations were written to close;
--   - worse, anon could call ..._unchecked directly — the original, guardless bodies — making the whole
--     wrapper pattern decorative.
-- Revoke PUBLIC first, then grant only the roles that actually need it. The security-definer callers run
-- as the function owner (postgres), which keeps its own explicit grant, so internal use is unaffected.
--
-- Note for future migrations in this repo: a `revoke … from anon` alone is never enough. Always
-- `revoke execute on function … from public;` and then grant explicitly.

revoke execute on function public.storefront_account_payload(uuid) from public;

revoke execute on function public.storefront_restore_inventory_for_order(text, text) from public;
revoke execute on function public.storefront_restore_inventory_for_order_unchecked(text, text) from public;
grant execute on function public.storefront_restore_inventory_for_order(text, text) to authenticated, service_role;

revoke execute on function public.storefront_release_voucher_usage(uuid, text) from public;
revoke execute on function public.storefront_release_voucher_usage_unchecked(uuid, text) from public;
grant execute on function public.storefront_release_voucher_usage(uuid, text) to authenticated, service_role;

-- A third, undocumented overload turned up in production that this repo never created:
--   storefront_release_voucher_usage(uuid, text, text)
-- Same body as the 2-arg one, plus one extra defaulted parameter. It carried no PUBLIC grant but it did
-- carry `authenticated`, and customer Google logins are authenticated — so it was an unguarded way to
-- release voucher quota. Access is revoked rather than dropped: nothing in this repo calls a 3-arg
-- version, but deleting a function in production cannot be undone, and service_role keeps working.
-- Both overloads also default every parameter, so a 2-named-argument call could resolve ambiguously;
-- revoking this one removes that ambiguity for every browser-side caller.
revoke execute on function public.storefront_release_voucher_usage(uuid, text, text) from public, anon, authenticated;
