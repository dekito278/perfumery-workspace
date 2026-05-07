create table if not exists public.storefront_customers (
    id uuid primary key default gen_random_uuid(),
    customer_code text not null unique,
    customer_name text not null,
    contact text not null,
    delivery_address text,
    delivery_area text,
    notes text,
    order_count integer not null default 0,
    last_order_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint storefront_customers_code_format check (customer_code ~ '^SOLI[0-9]{5}$'),
    constraint storefront_customers_name_not_blank check (char_length(trim(customer_name)) > 0),
    constraint storefront_customers_contact_not_blank check (char_length(trim(contact)) > 0),
    constraint storefront_customers_order_count_non_negative check (order_count >= 0)
);

create index if not exists storefront_customers_contact_idx
    on public.storefront_customers (lower(contact));

create index if not exists storefront_customers_last_order_at_idx
    on public.storefront_customers (last_order_at desc nulls last);

alter table public.storefront_orders
    add column if not exists customer_id uuid references public.storefront_customers(id) on delete set null,
    add column if not exists customer_code text;

create index if not exists storefront_orders_customer_id_idx
    on public.storefront_orders (customer_id);

create index if not exists storefront_orders_customer_code_idx
    on public.storefront_orders (customer_code);

drop trigger if exists storefront_customers_set_updated_at on public.storefront_customers;
create trigger storefront_customers_set_updated_at
before update on public.storefront_customers
for each row
execute function public.set_updated_at();

create or replace function public.generate_storefront_customer_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    candidate text;
begin
    loop
        candidate := 'SOLI' || lpad(floor(random() * 100000)::int::text, 5, '0');
        exit when not exists (
            select 1 from public.storefront_customers where customer_code = candidate
        );
    end loop;

    return candidate;
end;
$$;

create or replace function public.storefront_lookup_customer(p_customer_code text)
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
language sql
security definer
set search_path = public
as $$
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
    where c.customer_code = upper(trim(p_customer_code))
    limit 1;
$$;

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
        update public.storefront_customers
        set
            customer_name = trim(p_customer_name),
            contact = trim(p_contact),
            delivery_address = coalesce(nullif(trim(coalesce(p_delivery_address, '')), ''), delivery_address),
            delivery_area = coalesce(nullif(trim(coalesce(p_delivery_area, '')), ''), delivery_area),
            notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes),
            order_count = order_count + case when p_increment_order then 1 else 0 end,
            last_order_at = case when p_increment_order then timezone('utc', now()) else last_order_at end
        where storefront_customers.id = target_id;
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

alter table public.storefront_customers enable row level security;

drop policy if exists "storefront customers admin select" on public.storefront_customers;
create policy "storefront customers admin select"
on public.storefront_customers
for select
using (auth.role() = 'authenticated');

drop policy if exists "storefront customers admin update" on public.storefront_customers;
create policy "storefront customers admin update"
on public.storefront_customers
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "storefront customers admin delete" on public.storefront_customers;
create policy "storefront customers admin delete"
on public.storefront_customers
for delete
using (auth.role() = 'authenticated');
