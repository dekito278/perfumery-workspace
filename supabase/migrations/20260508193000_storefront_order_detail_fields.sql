alter table public.storefront_orders
    add column if not exists internal_notes text,
    add column if not exists status_timeline jsonb not null default '[]'::jsonb;

alter table public.storefront_orders
    drop constraint if exists storefront_orders_status_timeline_array;

alter table public.storefront_orders
    add constraint storefront_orders_status_timeline_array check (jsonb_typeof(status_timeline) = 'array');
