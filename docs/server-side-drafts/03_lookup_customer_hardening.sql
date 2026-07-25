-- DRAFT — finding #4a: storefront_lookup_customer returns name+contact+delivery_address by code,
-- with no security gate and anon-executable — it BYPASSES the portal's security-question protection
-- and is reachable from the public bespoke prefill.
--
-- This version drops the most sensitive fields (delivery_address, notes) from the public result so a
-- code guess can't harvest a home address. It keeps name + area (area is needed for shipping calc) and
-- contact. If you want to also drop contact, remove it below too.
--
-- Alternative (bigger change, keeps prefill fully working): gate the whole lookup behind the security
-- answer like storefront_customer_portal_verify. Pick one.

create or replace function public.storefront_lookup_customer(p_customer_code text)
returns table (
    id uuid,
    customer_code text,
    customer_name text,
    contact text,
    delivery_area text,
    order_count integer,
    last_order_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
    select
        c.id,
        c.customer_code,
        c.customer_name,
        c.contact,
        c.delivery_area,
        c.order_count,
        c.last_order_at,
        c.created_at,
        c.updated_at
    from public.storefront_customers c
    where c.customer_code = upper(trim(p_customer_code))
    limit 1;
$$;

-- NOTE: return signature changed (delivery_address, notes removed) — `create or replace function`
-- fails if the OUT columns change. You may need `drop function public.storefront_lookup_customer(text);`
-- first, then recreate, then re-grant:
--   grant execute on function public.storefront_lookup_customer(text) to anon, authenticated;
--
-- FRONTEND: customerService.lookupCustomerByCode / normalizeCustomer will get null delivery_address.
-- The bespoke prefill (MobileBespokePage) will fill name + area but not the street address — the user
-- types that themselves. That's the intended trade-off.
