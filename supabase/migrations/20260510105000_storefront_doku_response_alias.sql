alter table public.storefront_orders
    add column if not exists doku_response jsonb not null default '{}'::jsonb;

update public.storefront_orders
set doku_response = payment_response
where doku_response = '{}'::jsonb
  and payment_response is not null
  and payment_response <> '{}'::jsonb;

alter table public.storefront_orders
    drop constraint if exists storefront_orders_doku_response_object;

alter table public.storefront_orders
    add constraint storefront_orders_doku_response_object check (jsonb_typeof(doku_response) = 'object');
