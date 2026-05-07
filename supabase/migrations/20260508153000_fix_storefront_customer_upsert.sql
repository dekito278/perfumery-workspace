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
    id uuid,
    customer_code text,
    customer_name text,
    contact text,
    delivery_address text,
    delivery_area text,
    notes text,
    order_count integer,
    last_order_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_code text := nullif(upper(trim(coalesce(p_customer_code, ''))), '');
    normalized_contact text := lower(trim(coalesce(p_contact, '')));
    target_id uuid;
begin
    if char_length(trim(coalesce(p_customer_name, ''))) = 0 then
        raise exception 'Customer name is required';
    end if;

    if char_length(normalized_contact) = 0 then
        raise exception 'Customer contact is required';
    end if;

    if normalized_code is not null then
        select c.id into target_id
        from public.storefront_customers c
        where c.customer_code = normalized_code
        limit 1;
    end if;

    if target_id is null then
        select c.id into target_id
        from public.storefront_customers c
        where lower(c.contact) = normalized_contact
        order by c.updated_at desc
        limit 1;
    end if;

    if target_id is null then
        insert into public.storefront_customers (
            customer_code,
            customer_name,
            contact,
            delivery_address,
            delivery_area,
            notes,
            order_count,
            last_order_at
        )
        values (
            coalesce(normalized_code, public.generate_storefront_customer_code()),
            trim(p_customer_name),
            trim(p_contact),
            nullif(trim(coalesce(p_delivery_address, '')), ''),
            nullif(trim(coalesce(p_delivery_area, '')), ''),
            nullif(trim(coalesce(p_notes, '')), ''),
            case when p_increment_order then 1 else 0 end,
            case when p_increment_order then timezone('utc', now()) else null end
        )
        returning storefront_customers.id into target_id;
    else
        update public.storefront_customers c
        set
            customer_name = trim(p_customer_name),
            contact = trim(p_contact),
            delivery_address = coalesce(nullif(trim(coalesce(p_delivery_address, '')), ''), c.delivery_address),
            delivery_area = coalesce(nullif(trim(coalesce(p_delivery_area, '')), ''), c.delivery_area),
            notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), c.notes),
            order_count = c.order_count + case when p_increment_order then 1 else 0 end,
            last_order_at = case when p_increment_order then timezone('utc', now()) else c.last_order_at end
        where c.id = target_id;
    end if;

    return query
    select
        c.id,
        c.customer_code,
        c.customer_name,
        c.contact,
        c.delivery_address,
        c.delivery_area,
        c.notes,
        c.order_count,
        c.last_order_at,
        c.created_at,
        c.updated_at
    from public.storefront_customers c
    where c.id = target_id;
end;
$$;
