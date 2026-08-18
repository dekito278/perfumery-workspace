-- Audit round 7, two anon-callable RPCs that trust their caller.
--
-- MANUAL APPLY REQUIRED: run this in the Supabase SQL editor. Deploying the app does not apply it.
--
-- 1) storefront_release_voucher_usage is granted to anon and takes only an order id/number. It deletes the
--    usage records and decrements the voucher's usage counter, without checking who is calling or whether
--    the order was actually cancelled — so a capped promo ("first 50 buyers") could be reset to zero from
--    the browser, over and over, making it unlimited.
--    Every real caller is an admin action (orderService cancel/delete order) or service-role
--    (api/doku/*, api/orders/expire-reservations). Recording usage stays anon-callable: buyers do that at
--    checkout. As with the inventory-restore lockdown, the guard is a thin wrapper so the original body
--    stays defined exactly once.
--
-- 2) storefront_submit_payment_proof accepted any URL for any manual-transfer order and returned the whole
--    order row (contact, address, notes, checkout draft) to an anonymous caller. This tightens what it
--    accepts and what it hands back:
--      - the proof path must live under this order's own folder (orders/<ORDER-NUMBER>/…), so an order can
--        no longer be pointed at a file belonging to someone else;
--      - an already-approved proof can no longer be overwritten (a rejected one still can — the buyer is
--        meant to re-upload, see reviewOrderPaymentProof);
--      - the return value carries only what the buyer's own payment page renders.
--    KNOWN GAP, not closed here: there is still no proof of ownership, so someone who knows a valid order
--    number can attach their own file to it. Closing that needs the security answer (or an authenticated
--    customer) in the submit flow, which changes the buyer-facing UI — deliberately left as a decision.
--
-- Run once. Rollback for (1):
--   drop function public.storefront_release_voucher_usage(uuid, text);
--   alter function public.storefront_release_voucher_usage_unchecked(uuid, text)
--     rename to storefront_release_voucher_usage;
--   grant execute on function public.storefront_release_voucher_usage(uuid, text) to anon, authenticated, service_role;

-- 1) voucher release -----------------------------------------------------------------------------------

alter function public.storefront_release_voucher_usage(uuid, text)
    rename to storefront_release_voucher_usage_unchecked;

revoke execute on function public.storefront_release_voucher_usage_unchecked(uuid, text)
    from anon, authenticated;

create function public.storefront_release_voucher_usage(
    p_order_id uuid default null,
    p_order_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    if not (coalesce(auth.role(), '') = 'service_role' or public.is_admin()) then
        raise exception 'Not authorized to release voucher usage'
            using errcode = '42501';
    end if;

    return public.storefront_release_voucher_usage_unchecked(p_order_id, p_order_number);
end;
$$;

revoke execute on function public.storefront_release_voucher_usage(uuid, text) from anon;
grant execute on function public.storefront_release_voucher_usage(uuid, text) to authenticated, service_role;

-- 2) payment proof submission --------------------------------------------------------------------------

create or replace function public.storefront_submit_payment_proof(
    p_order_number text,
    p_payment_proof_url text,
    p_file_name text,
    p_content_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    normalized_order_number text := upper(trim(coalesce(p_order_number, '')));
    normalized_url text := trim(coalesce(p_payment_proof_url, ''));
    updated_order public.storefront_orders%rowtype;
begin
    if char_length(normalized_order_number) = 0 then
        raise exception 'Order number is required';
    end if;

    if char_length(normalized_url) = 0 then
        raise exception 'Payment proof file is required';
    end if;

    -- uploadPaymentProof always writes to orders/<ORDER-NUMBER>/<timestamp>-<token>.<ext>
    if normalized_url not like ('orders/' || normalized_order_number || '/%') then
        raise exception 'Payment proof path does not belong to order %', normalized_order_number;
    end if;

    update public.storefront_orders
    set
        payment_proof_url = normalized_url,
        payment_proof_file_name = nullif(trim(coalesce(p_file_name, '')), ''),
        payment_proof_content_type = nullif(trim(coalesce(p_content_type, '')), ''),
        payment_proof_uploaded_at = timezone('utc', now()),
        payment_proof_status = 'submitted',
        payment_proof_notes = null
    where order_number = normalized_order_number
        and payment_provider in ('manual', 'manual_transfer_bca')
        and payment_status in ('unpaid', 'pending')
        and coalesce(payment_proof_status, '') <> 'approved'
    returning * into updated_order;

    if updated_order.id is null then
        raise exception 'Manual transfer order not found or already finalized';
    end if;

    -- Only what the buyer's own payment page renders — never contact, address, notes or checkout draft.
    return jsonb_build_object(
        'order_number', updated_order.order_number,
        'customer_code', updated_order.customer_code,
        'customer_name', updated_order.customer_name,
        'subtotal', updated_order.subtotal,
        'quantity', updated_order.quantity,
        'status', updated_order.status,
        'payment_provider', updated_order.payment_provider,
        'payment_status', updated_order.payment_status,
        'payment_expires_at', updated_order.payment_expires_at,
        'payment_proof_url', updated_order.payment_proof_url,
        'payment_proof_file_name', updated_order.payment_proof_file_name,
        'payment_proof_content_type', updated_order.payment_proof_content_type,
        'payment_proof_uploaded_at', updated_order.payment_proof_uploaded_at,
        'payment_proof_status', updated_order.payment_proof_status,
        'payment_proof_notes', updated_order.payment_proof_notes,
        'created_at', updated_order.created_at,
        'updated_at', updated_order.updated_at
    );
end;
$$;

grant execute on function public.storefront_submit_payment_proof(text, text, text, text) to anon, authenticated;
