-- Fix storefront_upsert_customer 400 (Postgres 42702 "column reference \"delivery_address\" is ambiguous").
-- The function's RETURNS TABLE output columns (delivery_address, delivery_area, notes, order_count,
-- last_order_at) share names with the table columns referenced bare on the RHS of the UPDATE ... SET.
-- PL/pgSQL couldn't tell the OUT variable from the column, so the UPDATE path (returning / logged-in
-- customers) failed — INSERT path (new customers) was unaffected, which is why new orders still saved.
-- One-line fix: `#variable_conflict use_column` resolves any such clash to the table column, which is
-- exactly what every RHS reference here means. Also fixes: Google account linking (auth_user_id set in
-- that UPDATE) and phone-dedup consolidation (both live in the UPDATE branch). Body identical to
-- 20260730120000 apart from the pragma.
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
#variable_conflict use_column
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
