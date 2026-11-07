-- A customer code alone no longer opens that customer's orders.
--
-- Customer codes are SOLI + five digits: 100,000 possibilities, 48 real, printed on every invoice and
-- sent in every WhatsApp invoice link. storefront_customer_portal handed any caller who guessed one the
-- whole order list — items, totals, tracking numbers, payment links and the transfer-proof file the
-- buyer uploaded — for every code without a security question, which on 2026-11-07 was all of them.
-- 20261026090000 closed the same hole in checkout_lookup and set_security; this is the third door.
--
-- Proof is now one of:
--   * a login linked to the account (auth.uid() = auth_user_id)  -- 12 of 48 accounts
--   * Studio (is_admin()), which opens invoices from the order screen
--   * the contact the buyer checked out with: the phone, normalised (08…, 628…, +62 8… all match), or
--     the exact text for the two accounts whose contact is an email
-- Without it the answer is `requires_identity` and no orders; the portal and the invoice page then ask
-- for the WhatsApp number. A code with a security question is unchanged (answer → portal_verify), except
-- that its customer_name is now masked like every other code-only answer — it was returned in full.
--
-- Client first, then this: the client sends p_contact only after the server has asked for it, so it
-- works against the old one-argument function and this one alike.
--
-- Rollback: re-run 20260930090000_portal_gets_its_tracking_back.sql after
--   drop function public.storefront_customer_portal(text, text);

drop function if exists public.storefront_customer_portal(text);

create or replace function public.storefront_customer_portal(
    p_customer_code text,
    p_contact text default null
)
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
            c.security_enabled_at, c.created_at, c.updated_at,
            (
                (c.auth_user_id is not null and c.auth_user_id = auth.uid())
                or public.is_admin()
                or (
                    public.normalize_phone(p_contact) is not null
                    and public.normalize_phone(p_contact) = public.normalize_phone(c.contact)
                )
                or (
                    char_length(trim(coalesce(p_contact, ''))) > 0
                    and lower(trim(p_contact)) = lower(trim(coalesce(c.contact, '')))
                )
            ) as proven
        from public.storefront_customers c
        where c.customer_code = upper(trim(p_customer_code))
        limit 1
    ),
    matched_orders as (
        -- Personal fields (contact/address) are never in this set. Surfaced only for an unprotected code
        -- whose caller has proven they are the customer.
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
          and c.proven
        order by o.created_at desc
    )
    select
        coalesce(
            (
                select case
                    when c.security_answer_hash is not null then jsonb_build_object(
                        'customer_code', c.customer_code,
                        'customer_name', public.mask_name(c.customer_name),
                        'security_question', c.security_question,
                        'requires_security', true,
                        'security_enabled_at', c.security_enabled_at
                    )
                    when c.proven then jsonb_build_object(
                        'customer_code', c.customer_code,
                        'customer_name', public.mask_name(c.customer_name),
                        'order_count', c.order_count,
                        'requires_security', false,
                        'masked', true
                    )
                    else jsonb_build_object(
                        'customer_code', c.customer_code,
                        'requires_security', false,
                        'requires_identity', true
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

revoke execute on function public.storefront_customer_portal(text, text) from public;
grant execute on function public.storefront_customer_portal(text, text) to anon, authenticated;
