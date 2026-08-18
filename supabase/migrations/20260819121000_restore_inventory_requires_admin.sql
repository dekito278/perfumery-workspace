-- Audit round 7, finding: storefront_restore_inventory_for_order is granted to anon.
--
-- MANUAL APPLY REQUIRED: run this in the Supabase SQL editor. Deploying the app does not apply it.
--
-- Anyone holding an order number — their own is enough, and order numbers also surface through the public
-- tracking and payment-session lookups — could call the RPC with the anon key from the browser bundle and
-- put a paid, unshipped order's bottles back on sale. The catalog then advertises stock that is physically
-- committed to someone else, and the second buyer cannot be fulfilled.
--
-- Every legitimate caller is either service-role (api/doku/notification.js, api/doku/status.js,
-- api/orders/expire-reservations.js) or an admin in the studio (productCatalogService.restoreInventoryForOrder,
-- reached from cancel/delete order and from marking a payment failed or expired). Note that plain
-- `authenticated` is NOT sufficient: customer Google logins are authenticated too, which is why is_admin()
-- exists (see 20260715120000_admin_role_and_pii_rls_lockdown.sql).
--
-- The guard is added as a thin wrapper rather than by re-pasting the 160-line body, so the restore logic
-- itself stays defined in exactly one place and cannot drift from the original.
--
-- Run once. Rollback:
--   drop function public.storefront_restore_inventory_for_order(text, text);
--   alter function public.storefront_restore_inventory_for_order_unchecked(text, text)
--     rename to storefront_restore_inventory_for_order;
--   grant execute on function public.storefront_restore_inventory_for_order(text, text) to anon, authenticated, service_role;

alter function public.storefront_restore_inventory_for_order(text, text)
    rename to storefront_restore_inventory_for_order_unchecked;

revoke execute on function public.storefront_restore_inventory_for_order_unchecked(text, text)
    from anon, authenticated;

create function public.storefront_restore_inventory_for_order(
    p_order_id text,
    p_reason text default 'Order cancelled/payment failed stock restored'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    if not (coalesce(auth.role(), '') = 'service_role' or public.is_admin()) then
        raise exception 'Not authorized to restore inventory for order %', p_order_id
            using errcode = '42501';
    end if;

    return public.storefront_restore_inventory_for_order_unchecked(p_order_id, p_reason);
end;
$$;

revoke execute on function public.storefront_restore_inventory_for_order(text, text) from anon;
grant execute on function public.storefront_restore_inventory_for_order(text, text) to authenticated, service_role;
