create table if not exists public.storefront_order_audit_logs (
    id uuid primary key default gen_random_uuid(),
    order_id uuid references public.storefront_orders(id) on delete set null,
    order_number text not null,
    action text not null check (
        action in (
            'order_status_updated',
            'payment_status_updated',
            'shipment_updated',
            'order_cancelled',
            'order_deleted'
        )
    ),
    actor_id uuid,
    actor_email text,
    actor_name text,
    previous_values jsonb not null default '{}'::jsonb,
    next_values jsonb not null default '{}'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists storefront_order_audit_logs_order_number_idx
    on public.storefront_order_audit_logs (order_number, created_at desc);

create index if not exists storefront_order_audit_logs_action_idx
    on public.storefront_order_audit_logs (action, created_at desc);

create index if not exists storefront_order_audit_logs_actor_id_idx
    on public.storefront_order_audit_logs (actor_id, created_at desc);

alter table public.storefront_order_audit_logs enable row level security;

drop policy if exists "storefront order audit logs admin select" on public.storefront_order_audit_logs;
create policy "storefront order audit logs admin select"
on public.storefront_order_audit_logs
for select
using (auth.role() = 'authenticated');

drop policy if exists "storefront order audit logs admin insert" on public.storefront_order_audit_logs;
create policy "storefront order audit logs admin insert"
on public.storefront_order_audit_logs
for insert
with check (auth.role() = 'authenticated');
