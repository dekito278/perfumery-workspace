-- Introduce a DB-level admin role so RLS can tell the studio owner apart from
-- customers who now authenticate via Google. Before customer login existed, every
-- authenticated session was the owner, so admin tables used `auth.role() = 'authenticated'`.
-- That assumption is no longer safe: a logged-in customer is also 'authenticated' and
-- could read/write admin tables directly through the anon client. This migration adds
-- `is_admin()` and locks down the highest-risk, admin-only tables whose customer-facing
-- reads already go exclusively through SECURITY DEFINER RPCs (so nothing customer-facing
-- breaks). Each table block is guarded with to_regclass so absent tables are skipped.

-- 1) Admin registry ---------------------------------------------------------------
create table if not exists public.storefront_admins (
    user_id uuid primary key references auth.users (id) on delete cascade,
    email text,
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.storefront_admins enable row level security;

drop policy if exists "storefront admins read self" on public.storefront_admins;
create policy "storefront admins read self"
on public.storefront_admins
for select
using (auth.uid() = user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.storefront_admins a where a.user_id = auth.uid()
    );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- Seed the owner. Safe to re-run; does nothing if the account hasn't logged in yet.
insert into public.storefront_admins (user_id, email)
select id, email from auth.users where lower(email) = 'aderizki68@gmail.com'
on conflict (user_id) do nothing;

-- 2) Lock down PII / admin-only tables to is_admin() (skip if table absent) --------
do $$
begin
  if to_regclass('public.storefront_customers') is not null then
    execute $q$drop policy if exists "storefront customers admin select" on public.storefront_customers$q$;
    execute $q$create policy "storefront customers admin select" on public.storefront_customers for select using (public.is_admin())$q$;
    execute $q$drop policy if exists "storefront customers admin update" on public.storefront_customers$q$;
    execute $q$create policy "storefront customers admin update" on public.storefront_customers for update using (public.is_admin()) with check (public.is_admin())$q$;
    execute $q$drop policy if exists "storefront customers admin delete" on public.storefront_customers$q$;
    execute $q$create policy "storefront customers admin delete" on public.storefront_customers for delete using (public.is_admin())$q$;
  end if;

  if to_regclass('public.storefront_doku_payment_logs') is not null then
    execute $q$drop policy if exists "storefront doku payment logs admin select" on public.storefront_doku_payment_logs$q$;
    execute $q$create policy "storefront doku payment logs admin select" on public.storefront_doku_payment_logs for select using (public.is_admin())$q$;
  end if;

  if to_regclass('public.storefront_order_audit_logs') is not null then
    execute $q$drop policy if exists "storefront order audit logs admin select" on public.storefront_order_audit_logs$q$;
    execute $q$create policy "storefront order audit logs admin select" on public.storefront_order_audit_logs for select using (public.is_admin())$q$;
    execute $q$drop policy if exists "storefront order audit logs admin insert" on public.storefront_order_audit_logs$q$;
    execute $q$create policy "storefront order audit logs admin insert" on public.storefront_order_audit_logs for insert with check (public.is_admin())$q$;
  end if;

  if to_regclass('public.storefront_voucher_usage_records') is not null then
    execute $q$drop policy if exists "storefront voucher usage admin select" on public.storefront_voucher_usage_records$q$;
    execute $q$create policy "storefront voucher usage admin select" on public.storefront_voucher_usage_records for select using (public.is_admin())$q$;
  end if;
end $$;
