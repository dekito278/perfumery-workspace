-- Phase 2: link Google-authenticated customers to their storefront_customers record
-- so a login carries address + order history the same way the SOLIxxxxx code does.
-- The code stays the primary identity for anon buyers; auth_user_id is an additive link.

alter table public.storefront_customers
    add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create unique index if not exists storefront_customers_auth_user_id_key
    on public.storefront_customers (auth_user_id)
    where auth_user_id is not null;

-- 1) Auto-link at checkout: extend the existing upsert to bind the record to the
--    caller's auth account (only when authenticated, and only if unclaimed). Same
--    signature + return shape, so the frontend is unchanged.
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
    caller uuid := auth.uid();
    target_id uuid;
begin
    if char_length(trim(coalesce(p_customer_name, ''))) = 0 then
        raise exception 'Customer name is required';
    end if;
    if char_length(normalized_contact) = 0 then
        raise exception 'Customer contact is required';
    end if;

    -- Prefer the caller's own linked record, then code, then contact.
    if caller is not null then
        select c.id into target_id from public.storefront_customers c
        where c.auth_user_id = caller limit 1;
    end if;
    if target_id is null and normalized_code is not null then
        select c.id into target_id from public.storefront_customers c
        where c.customer_code = normalized_code limit 1;
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
            -- claim the record for the caller only if it isn't already linked to someone else
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

-- Shared payload: customer (incl. own delivery_address) + full order history, by customer id.
create or replace function public.storefront_account_payload(p_customer_id uuid)
returns table (customer jsonb, orders jsonb)
language sql
security definer
set search_path = public
as $$
    select
        (
            select jsonb_build_object(
                'id', c.id, 'customer_code', c.customer_code, 'customer_name', c.customer_name,
                'contact', c.contact, 'delivery_address', c.delivery_address,
                'delivery_area', c.delivery_area, 'notes', c.notes,
                'security_question', c.security_question, 'requires_security', false,
                'order_count', c.order_count, 'last_order_at', c.last_order_at,
                'created_at', c.created_at, 'updated_at', c.updated_at
            )
            from public.storefront_customers c where c.id = p_customer_id
        ) as customer,
        coalesce((
            select jsonb_agg(to_jsonb(o) order by o.created_at desc)
            from public.storefront_orders o
            join public.storefront_customers c on c.id = p_customer_id
            where o.customer_id = c.id or o.customer_code = c.customer_code
        ), '[]'::jsonb) as orders;
$$;

-- 2) Auto-load portal by account (no code entry needed for logged-in customers).
create or replace function public.storefront_customer_account()
returns table (customer jsonb, orders jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
    caller uuid := auth.uid();
    target_id uuid;
begin
    if caller is null then
        return;
    end if;
    select c.id into target_id from public.storefront_customers c where c.auth_user_id = caller limit 1;
    if target_id is null then
        return;
    end if;
    return query select * from public.storefront_account_payload(target_id);
end;
$$;

-- 3) Claim an existing SOLIxxxxx code and bind it to the caller's account.
--    Security-question-protected codes require the correct answer; unprotected codes
--    can only be claimed if not already linked to another account.
create or replace function public.storefront_claim_customer_code(
    p_customer_code text,
    p_security_answer text default null
)
returns table (customer jsonb, orders jsonb)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    caller uuid := auth.uid();
    rec public.storefront_customers%rowtype;
begin
    if caller is null then
        raise exception 'Authentication required';
    end if;

    select * into rec from public.storefront_customers
    where customer_code = upper(trim(coalesce(p_customer_code, ''))) limit 1;
    if rec.id is null then
        raise exception 'Customer code not found';
    end if;

    if rec.auth_user_id is not null and rec.auth_user_id <> caller then
        raise exception 'This code is already linked to another account';
    end if;

    if rec.security_answer_hash is not null then
        if p_security_answer is null
           or rec.security_answer_hash <> crypt(lower(trim(p_security_answer)), rec.security_answer_hash) then
            raise exception 'Security answer is incorrect';
        end if;
    end if;

    update public.storefront_customers set auth_user_id = caller where id = rec.id;
    return query select * from public.storefront_account_payload(rec.id);
end;
$$;

-- 4) Save/update the caller's own profile + address (address book), creating the
--    record with a fresh code if they have never ordered.
create or replace function public.storefront_save_customer_account(
    p_customer_name text,
    p_contact text,
    p_delivery_address text default null,
    p_delivery_area text default null
)
returns table (customer jsonb, orders jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
    caller uuid := auth.uid();
    target_id uuid;
begin
    if caller is null then
        raise exception 'Authentication required';
    end if;
    if char_length(trim(coalesce(p_customer_name, ''))) = 0
       or char_length(trim(coalesce(p_contact, ''))) = 0 then
        raise exception 'Name and contact are required';
    end if;

    select c.id into target_id from public.storefront_customers c where c.auth_user_id = caller limit 1;

    if target_id is null then
        insert into public.storefront_customers (
            customer_code, customer_name, contact, delivery_address, delivery_area, auth_user_id
        )
        values (
            public.generate_storefront_customer_code(), trim(p_customer_name), trim(p_contact),
            nullif(trim(coalesce(p_delivery_address, '')), ''),
            nullif(trim(coalesce(p_delivery_area, '')), ''), caller
        )
        returning id into target_id;
    else
        update public.storefront_customers set
            customer_name = trim(p_customer_name),
            contact = trim(p_contact),
            delivery_address = coalesce(nullif(trim(coalesce(p_delivery_address, '')), ''), delivery_address),
            delivery_area = coalesce(nullif(trim(coalesce(p_delivery_area, '')), ''), delivery_area)
        where id = target_id;
    end if;

    return query select * from public.storefront_account_payload(target_id);
end;
$$;

grant execute on function public.storefront_customer_account() to authenticated;
grant execute on function public.storefront_claim_customer_code(text, text) to authenticated;
grant execute on function public.storefront_save_customer_account(text, text, text, text) to authenticated;
grant execute on function public.storefront_account_payload(uuid) to authenticated, anon;
