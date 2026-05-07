create table if not exists public.storefront_orders (
    id uuid primary key default gen_random_uuid(),
    order_number text not null unique,
    status text not null default 'pending_payment' check (
        status in ('draft', 'pending_payment', 'paid', 'processing', 'shipped', 'completed', 'cancelled')
    ),
    customer_name text not null,
    contact text not null,
    notes text,
    items jsonb not null default '[]'::jsonb,
    quantity integer not null default 0,
    subtotal numeric(14,2) not null default 0,
    checkout_draft text,
    payment_provider text not null default 'manual',
    payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'expired', 'refunded')),
    payment_reference text,
    source text not null default 'storefront',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint storefront_orders_customer_name_not_blank check (char_length(trim(customer_name)) > 0),
    constraint storefront_orders_contact_not_blank check (char_length(trim(contact)) > 0),
    constraint storefront_orders_quantity_non_negative check (quantity >= 0),
    constraint storefront_orders_subtotal_non_negative check (subtotal >= 0),
    constraint storefront_orders_items_array check (jsonb_typeof(items) = 'array')
);

create index if not exists storefront_orders_status_idx
    on public.storefront_orders (status);

create index if not exists storefront_orders_created_at_idx
    on public.storefront_orders (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists storefront_orders_set_updated_at on public.storefront_orders;
create trigger storefront_orders_set_updated_at
before update on public.storefront_orders
for each row
execute function public.set_updated_at();

alter table public.storefront_orders enable row level security;

drop policy if exists "storefront orders public insert" on public.storefront_orders;
create policy "storefront orders public insert"
on public.storefront_orders
for insert
with check (true);

drop policy if exists "storefront orders admin select" on public.storefront_orders;
create policy "storefront orders admin select"
on public.storefront_orders
for select
using (auth.role() = 'authenticated');

drop policy if exists "storefront orders admin update" on public.storefront_orders;
create policy "storefront orders admin update"
on public.storefront_orders
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "storefront orders admin delete" on public.storefront_orders;
create policy "storefront orders admin delete"
on public.storefront_orders
for delete
using (auth.role() = 'authenticated');
