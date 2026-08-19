-- Audit round 7, finding #2 (CRITICAL) — the anon customer lookup dumps the whole customer table.
--
-- MANUAL APPLY REQUIRED: run this in the Supabase SQL editor. Deploying the app does not apply it.
--
-- storefront_lookup_customer is security definer, granted to anon, and keyed only on the customer code
-- (SOLI + 5 digits = 100k values, see generate_storefront_customer_code). A scripted sweep with the anon
-- key that ships in the browser bundle therefore harvests every buyer's name, phone/email, home address
-- and internal notes. It also returned c.id, which fed straight into storefront_account_payload(uuid) —
-- granted to anon with no caller check — turning the sweep into "every order of every customer, with
-- payment references and proof-of-payment links".
--
-- Fix, in two parts:
--   1. The public lookup keeps only what the bespoke prefill genuinely needs and that a code guess may
--      safely reveal: the code, the display name, and the shipping area. No id, contact, address or notes.
--      Checkout keeps its richer prefill through storefront_customer_checkout_lookup, which is already
--      gated behind the security answer.
--   2. storefront_account_payload stops being anon/authenticated-callable. It stays reachable from the
--      security-definer wrappers that own the authorization check (storefront_customer_account,
--      storefront_claim_customer_code, storefront_save_customer_account), which is its only legitimate use.
--
-- Rollback: git show this file's parent for the previous definition; re-grant with
--   grant execute on function public.storefront_account_payload(uuid) to authenticated, anon;

-- The OUT columns change, so the function must be dropped before it is recreated.
drop function if exists public.storefront_lookup_customer(text);

create function public.storefront_lookup_customer(p_customer_code text)
returns table (
    customer_code text,
    customer_name text,
    delivery_area text
)
language sql
security definer
set search_path = public
as $$
    select
        c.customer_code,
        c.customer_name,
        c.delivery_area
    from public.storefront_customers c
    where c.customer_code = upper(trim(p_customer_code))
    limit 1;
$$;

grant execute on function public.storefront_lookup_customer(text) to anon, authenticated;

revoke execute on function public.storefront_account_payload(uuid) from anon, authenticated;
