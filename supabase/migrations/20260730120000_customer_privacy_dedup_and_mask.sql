-- Customer privacy hardening (2026-07-30):
--   #1 Dedup by NORMALIZED phone in storefront_upsert_customer, so the same buyer (who types their
--      number in different formats, or checks out with/without a code) consolidates into ONE record
--      instead of piling up duplicates.
--   #2 storefront_customer_portal: an unprotected code (no security answer) no longer returns full PII.
--      Codes are only SOLI+5 digits (100k space) → trivially brute-forceable. The anonymous branch now
--      returns a MASKED name + order status only (no contact/area). Full details require Google login
--      (storefront_customer_account, by identity) or a set security answer (storefront_customer_portal_verify).

-- ---------------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------------

-- Extract an Indonesian mobile number from a possibly-messy contact string (may embed email/text) and
-- return a canonical '62'+national form. Null when no mobile-looking number is present (e.g. landline).
create or replace function public.normalize_phone(p_contact text)
returns text
language sql
immutable
as $$
    select case when m is null then null else '62' || m end
    from (
        select (regexp_match(
            regexp_replace(coalesce(p_contact, ''), '[^0-9+]', '', 'g'),
            '(?:\+?62|0)?(8[0-9]{7,12})'
        ))[1] as m
    ) s;
$$;

-- Reveal only the first letter of a name; everything else masked. Empty → 'Pelanggan'.
create or replace function public.mask_name(p_name text)
returns text
language sql
immutable
as $$
    select case
        when coalesce(trim(p_name), '') = '' then 'Pelanggan'
        else left(trim(p_name), 1) || '•••'
    end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- #1 Upsert with phone-normalized dedup (only change vs 20260715122000: the contact lookup step)
-- ---------------------------------------------------------------------------------------------------
create or replace function public.storefront_upsert_customer(
    p_customer_code text,
    p_customer_name text,
    p_contact text,
    p_delivery_address text default null,
    p_delivery_area text default null,
    p_notes text default null,
    p_increment_order boolean default false
)
returns table (
    id uuid, customer_code text, customer_name text, contact text,
    delivery_address text, delivery_area text, notes text,
    order_count integer, last_order_at timestamptz,
    created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_code text := nullif(upper(trim(coalesce(p_customer_code, ''))), '');
    normalized_contact text := lower(trim(coalesce(p_contact, '')));
    normalized_phone text := public.normalize_phone(p_contact);
    caller uuid := auth.uid();
    target_id uuid;
begin
    if char_length(trim(coalesce(p_customer_name, ''))) = 0 then
        raise exception 'Customer name is required';
    end if;
    if char_length(normalized_contact) = 0 then
        raise exception 'Customer contact is required';
    end if;

    -- Prefer the caller's own linked record, then code, then phone (normalized), then raw contact.
    if caller is not null then
        select c.id into target_id from public.storefront_customers c
        where c.auth_user_id = caller limit 1;
    end if;
    if target_id is null and normalized_code is not null then
        select c.id into target_id from public.storefront_customers c
        where c.customer_code = normalized_code limit 1;
    end if;
    -- ponytail: normalize_phone(c.contact) is a full scan (no functional index). Fine at this scale;
    -- add an index on normalize_phone(contact) if the customer table grows large.
    if target_id is null and normalized_phone is not null then
        select c.id into target_id from public.storefront_customers c
        where public.normalize_phone(c.contact) = normalized_phone
        order by c.updated_at desc limit 1;
    end if;
    if target_id is null then
        select c.id into target_id from public.storefront_customers c
        where lower(c.contact) = normalized_contact
        order by c.updated_at desc limit 1;
    end if;

    if target_id is null then
        insert into public.storefront_customers (
            customer_code, customer_name, contact, delivery_address,
            delivery_area, notes, order_count, last_order_at, auth_user_id
        )
        values (
            coalesce(normalized_code, public.generate_storefront_customer_code()),
            trim(p_customer_name), trim(p_contact),
            nullif(trim(coalesce(p_delivery_address, '')), ''),
            nullif(trim(coalesce(p_delivery_area, '')), ''),
            nullif(trim(coalesce(p_notes, '')), ''),
            case when p_increment_order then 1 else 0 end,
            case when p_increment_order then timezone('utc', now()) else null end,
            caller
        )
        returning storefront_customers.id into target_id;
    else
        update public.storefront_customers
        set
            customer_name = trim(p_customer_name),
            contact = trim(p_contact),
            delivery_address = coalesce(nullif(trim(coalesce(p_delivery_address, '')), ''), delivery_address),
            delivery_area = coalesce(nullif(trim(coalesce(p_delivery_area, '')), ''), delivery_area),
            notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes),
            order_count = order_count + case when p_increment_order then 1 else 0 end,
            last_order_at = case when p_increment_order then timezone('utc', now()) else last_order_at end,
            auth_user_id = case
                when caller is not null and auth_user_id is null then caller
                else auth_user_id
            end
        where storefront_customers.id = target_id;
    end if;

    return query
    select c.id, c.customer_code, c.customer_name, c.contact, c.delivery_address,
           c.delivery_area, c.notes, c.order_count, c.last_order_at, c.created_at, c.updated_at
    from public.storefront_customers c where c.id = target_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- #2 Portal lookup by code: mask the anonymous (no-security-answer) branch
-- ---------------------------------------------------------------------------------------------------
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
