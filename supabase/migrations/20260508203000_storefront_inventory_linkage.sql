alter table public.storefront_orders
    add column if not exists inventory_deducted boolean not null default false,
    add column if not exists inventory_events jsonb not null default '[]'::jsonb,
    add column if not exists production_links jsonb not null default '{}'::jsonb;

alter table public.storefront_orders
    drop constraint if exists storefront_orders_inventory_events_array;

alter table public.storefront_orders
    add constraint storefront_orders_inventory_events_array check (
        jsonb_typeof(inventory_events) = 'array'
    );

alter table public.storefront_orders
    drop constraint if exists storefront_orders_production_links_object;

alter table public.storefront_orders
    add constraint storefront_orders_production_links_object check (
        jsonb_typeof(production_links) = 'object'
    );

create index if not exists storefront_orders_inventory_deducted_idx
    on public.storefront_orders (inventory_deducted);
