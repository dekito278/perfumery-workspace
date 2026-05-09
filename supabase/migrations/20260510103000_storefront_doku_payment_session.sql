alter table public.storefront_orders
    add column if not exists payment_url text,
    add column if not exists payment_expires_at timestamptz,
    add column if not exists payment_session_id text,
    add column if not exists payment_response jsonb not null default '{}'::jsonb;

alter table public.storefront_orders
    drop constraint if exists storefront_orders_payment_response_object;

alter table public.storefront_orders
    add constraint storefront_orders_payment_response_object check (jsonb_typeof(payment_response) = 'object');

create index if not exists storefront_orders_payment_session_id_idx
    on public.storefront_orders (payment_session_id);
