alter table public.storefront_orders
    add column if not exists payment_proof_url text,
    add column if not exists payment_proof_file_name text,
    add column if not exists payment_proof_content_type text,
    add column if not exists payment_proof_uploaded_at timestamptz,
    add column if not exists payment_proof_status text not null default 'missing',
    add column if not exists payment_proof_notes text;

alter table public.storefront_orders
    drop constraint if exists storefront_orders_payment_proof_status_check;

alter table public.storefront_orders
    add constraint storefront_orders_payment_proof_status_check
    check (payment_proof_status in ('missing', 'submitted', 'approved', 'rejected'));

create index if not exists storefront_orders_payment_proof_status_idx
    on public.storefront_orders (payment_proof_status);
