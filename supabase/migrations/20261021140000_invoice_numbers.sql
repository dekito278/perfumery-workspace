-- SOL-2026-005 and onwards. One number per invoice, never the same one twice.
--
-- Dekito's brief, §8: "Nomor urut SOL-2026-NNN; lanjutkan urutan, terakhir yang dibuat manual
-- SOL-2026-004." So the counter starts at 4 and the next number issued is 005.
--
-- WHY A COUNTER TABLE AND NOT max(invoice_number) + 1: two invoices generated in the same minute would
-- both read the same maximum and both take the same number. It is a one-person shop, so that is
-- unlikely rather than impossible — and an invoice number that appears twice is the one bookkeeping
-- error nobody can unpick afterwards, because both copies are already sent.
--
-- PER YEAR, because the format says the year. A single ever-rising sequence would hand out SOL-2027-005
-- after SOL-2026-004, which reads as four missing invoices.

create table if not exists public.storefront_invoice_counters (
    year integer primary key,
    last_number integer not null default 0 check (last_number >= 0),
    updated_at timestamptz not null default now()
);

alter table public.storefront_invoice_counters enable row level security;

drop policy if exists storefront_invoice_counters_admin on public.storefront_invoice_counters;
create policy storefront_invoice_counters_admin
    on public.storefront_invoice_counters for all
    using (public.is_admin())
    with check (public.is_admin());

-- The four already sent by hand.
insert into public.storefront_invoice_counters (year, last_number)
values (2026, 4)
on conflict (year) do nothing;

-- Where the number is kept once issued, so reprinting an invoice reprints the same one.
alter table public.storefront_orders
    add column if not exists invoice_number text;

create unique index if not exists storefront_orders_invoice_number_key
    on public.storefront_orders (invoice_number)
    where invoice_number is not null;

/**
 * Hand out the next number for the shop's current year, atomically.
 *
 * The update and the read are one statement: `update ... returning` takes a row lock, so two callers in
 * the same instant get different numbers rather than the same one. Admin only — it changes a counter.
 */
create or replace function public.storefront_next_invoice_number()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_year integer := extract(year from (now() at time zone 'Asia/Jakarta'))::integer;
    v_next integer;
begin
    if not public.is_admin() then
        raise exception 'admin only';
    end if;

    insert into public.storefront_invoice_counters (year, last_number)
    values (v_year, 0)
    on conflict (year) do nothing;

    update public.storefront_invoice_counters
       set last_number = last_number + 1, updated_at = now()
     where year = v_year
    returning last_number into v_next;

    return 'SOL-' || v_year::text || '-' || lpad(v_next::text, 3, '0');
end;
$$;

revoke all on function public.storefront_next_invoice_number() from anon;
grant execute on function public.storefront_next_invoice_number() to authenticated;

-- Verify (as Dekito, signed in): the first call returns SOL-2026-005, the second SOL-2026-006.
--   select public.storefront_next_invoice_number();
-- And with the anon key it must refuse:
--   curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/storefront_next_invoice_number" -H "apikey: $ANON" \
--        -H "Authorization: Bearer $ANON"      # -> error, admin only
--
-- Expect year 2026 at 4 before the first invoice is generated:
select year, last_number from public.storefront_invoice_counters order by year;

-- Rollback:
--   drop function if exists public.storefront_next_invoice_number();
--   drop index if exists public.storefront_orders_invoice_number_key;
--   alter table public.storefront_orders drop column if exists invoice_number;
--   drop table if exists public.storefront_invoice_counters;
