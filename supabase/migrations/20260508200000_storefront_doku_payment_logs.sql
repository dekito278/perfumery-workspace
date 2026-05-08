create table if not exists public.storefront_doku_payment_logs (
    id uuid primary key default gen_random_uuid(),
    order_number text,
    request_id text,
    original_request_id text,
    transaction_status text,
    mapped_order_status text,
    mapped_payment_status text,
    processing_status text not null default 'received' check (
        processing_status in ('received', 'applied', 'ignored', 'rejected', 'error')
    ),
    http_status integer,
    signature_valid boolean,
    headers jsonb not null default '{}'::jsonb,
    payload jsonb not null default '{}'::jsonb,
    raw_body text,
    error_message text,
    received_at timestamptz not null default timezone('utc', now()),
    created_at timestamptz not null default timezone('utc', now()),
    constraint storefront_doku_logs_payload_object check (jsonb_typeof(payload) = 'object'),
    constraint storefront_doku_logs_headers_object check (jsonb_typeof(headers) = 'object')
);

create index if not exists storefront_doku_payment_logs_order_number_idx
    on public.storefront_doku_payment_logs (order_number);

create index if not exists storefront_doku_payment_logs_request_id_idx
    on public.storefront_doku_payment_logs (request_id);

create index if not exists storefront_doku_payment_logs_received_at_idx
    on public.storefront_doku_payment_logs (received_at desc);

alter table public.storefront_doku_payment_logs enable row level security;

drop policy if exists "storefront doku payment logs admin select" on public.storefront_doku_payment_logs;
create policy "storefront doku payment logs admin select"
on public.storefront_doku_payment_logs
for select
using (auth.role() = 'authenticated');
