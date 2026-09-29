-- The customer portal lost its tracking number, its shipment status and its payment-proof state.
--
-- storefront_customer_portal was widened three times after it shipped: the payment session
-- (20260510104000), the payment-proof columns (20260511123000), the shipment and bespoke fields
-- (20260508194500 / 20260508201000). By 20260511 it returned 29 order columns.
--
-- 20260730120000_customer_privacy_dedup_and_mask.sql redefined the whole function to mask the CUSTOMER
-- — a good change — and rewrote matched_orders back to the eleven columns it had on day one. Its comment
-- says "personal fields (contact/address) are never in this set", and that is true: neither was ever in
-- it. What it actually removed was eighteen operational columns, none of them personal:
--
--     shipment_status, courier_name, tracking_number, tracking_url, shipped_at, delivered_at,
--     packing_notes, payment_url, payment_expires_at, payment_session_id, payment_proof_url,
--     payment_proof_file_name, payment_proof_content_type, payment_proof_uploaded_at,
--     payment_proof_status, payment_proof_notes, bespoke_production_status,
--     bespoke_production_timeline
--
-- The browser never complained, because normalizePortalOrder defaults each of them: shipment_status
-- became 'not_ready', the tracking number became '', the proof status became 'missing'. So a buyer
-- opening the portal with their code sees every order stuck at "Belum siap", no courier, no resi, and no
-- sign that the payment proof they uploaded was ever received — while storefront_customer_portal_verify,
-- which the privacy migration did NOT redefine, still returns all of it. A buyer who set a security
-- question can see their parcel; a buyer who did not, cannot.
--
-- This restores the fourteen the portal actually renders, on top of the masking, which is untouched.
--
-- Deliberately NOT restored, and why:
--   packing_notes               -- written for the person packing, not for the buyer
--   payment_session_id          -- internal DOKU handle; nothing on the portal reads it
--   bespoke_production_timeline -- nothing renders it; the status alone is what the buyer is shown
--   payment_proof_content_type  -- nothing renders it
--
-- payment_proof_url IS restored: without it the portal's whole proof block is blind, and it is the
-- buyer's own upload. It is reached through this function only for an UNPROTECTED code, exactly as the
-- order list itself already is. If that is too open for your liking, say so and it comes out — the rest
-- of this migration does not depend on it.

create or replace function public.storefront_customer_portal(p_customer_code text)
returns table (
    customer jsonb,
    orders jsonb
)
language sql
security definer
set search_path = public, extensions
as $$
    with matched_customer as (
        select
            c.id, c.customer_code, c.customer_name, c.contact, c.delivery_area,
            c.order_count, c.last_order_at, c.security_question, c.security_answer_hash,
            c.security_enabled_at, c.created_at, c.updated_at
        from public.storefront_customers c
        where c.customer_code = upper(trim(p_customer_code))
        limit 1
    ),
    matched_orders as (
        -- Order status is still shown so a guest can track by code; personal fields (contact/address)
        -- are never in this set. Only surfaced when the code is unprotected (else login/answer required).
        select
            o.order_number, o.status, o.items, o.quantity, o.subtotal,
            o.payment_provider, o.payment_status, o.payment_reference, o.source,
            o.payment_url, o.payment_expires_at,
            o.payment_proof_url, o.payment_proof_file_name, o.payment_proof_uploaded_at,
            o.payment_proof_status, o.payment_proof_notes,
            o.bespoke_production_status,
            o.shipment_status, o.courier_name, o.tracking_number, o.tracking_url,
            o.shipped_at, o.delivered_at,
            o.created_at, o.updated_at
        from public.storefront_orders o
        join matched_customer c
            on o.customer_id = c.id
            or o.customer_code = c.customer_code
        where c.security_answer_hash is null
        order by o.created_at desc
    )
    select
        coalesce(
            (
                select case
                    when c.security_answer_hash is not null then jsonb_build_object(
                        'customer_code', c.customer_code,
                        'customer_name', c.customer_name,
                        'security_question', c.security_question,
                        'requires_security', true,
                        'security_enabled_at', c.security_enabled_at
                    )
                    -- Unprotected code: masked, PII-free. Full details need login or a security answer.
                    else jsonb_build_object(
                        'customer_code', c.customer_code,
                        'customer_name', public.mask_name(c.customer_name),
                        'order_count', c.order_count,
                        'requires_security', false,
                        'masked', true
                    )
                end
                from matched_customer c
            ),
            '{}'::jsonb
        ) as customer,
        coalesce(
            (
                select jsonb_agg(to_jsonb(o))
                from matched_orders o
            ),
            '[]'::jsonb
        ) as orders;
$$;
