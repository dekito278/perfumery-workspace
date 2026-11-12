-- A member code never makes an existing member pay more.
--
-- MANUAL APPLY, AFTER 20261110120000_member_codes.sql. Run the whole file once in the Supabase SQL editor.
-- Safe to run twice.
--
-- WHY. Since #591 (Dekito, 12 Nov 2026) a code pays EXACTLY its percentage, also when that is above the
-- product member price: each community gets the percentage Dekito chose for it. Right for a new community
-- member. Wrong for someone who was already a member: the account page tells them "Punya kode dari
-- komunitasmu? Masukkan di bawah.", and a 5% code replaced a product member price of ~10% — silently, and
-- for good, because the latest code wins and there is no way back to "no code". 20261110120000 promised
-- "nobody loses a price they already have"; this file keeps that promise after a code is typed.
--
-- THE RULE. A member who was a member before, and apart from, their code pays the CHEAPER of the code and
-- the product member price, per perfume. That is:
--   * an account that existed when 20261110120000 ran ("legacy"), whether or not it has redeemed since;
--   * a customer an admin set to 'member' by hand;
--   * a customer with a paid order placed BEFORE the account joined through a code. Orders paid after
--     joining do not count: otherwise a 5% community would get the product member price from its second
--     order on, and the percentage Dekito set for it would mean nothing.
-- Everyone else who holds a code pays exactly its percentage, as #591 decided.
--
-- ONE RULE, TWO READERS, as before. storefront_member_status gains a fourth column, keeps_member_price.
-- The storefront (tierPricingService.getMyPriceTier) and api/orders/create.js both read it, and both read a
-- missing column as false, so before this file runs they keep agreeing on today's rule.

begin;

-- 1. Remember who was a member before codes existed -----------------------------------------------------
alter table public.storefront_member_accounts
    add column if not exists kept_member_price boolean not null default false;

-- A legacy row that has redeemed a code since was rewritten to source = 'code', so 'legacy' alone misses
-- exactly the people this file is for. What survives is time: the legacy batch was the first thing ever
-- written to this table (the table was created in the same transaction), so any account created before
-- the table's first row was a legacy account.
update public.storefront_member_accounts a
   set kept_member_price = true,
       updated_at = now()
 where not a.kept_member_price
   and (
        a.source = 'legacy'
     or exists (
            select 1
              from auth.users u
             where u.id = a.auth_user_id
               and u.created_at < (select min(m.created_at) from public.storefront_member_accounts m)
        )
   );

-- 2. The rule, with the fourth column -------------------------------------------------------------------
-- The return type changes, so the functions are dropped and created again (create or replace cannot change
-- the columns of a returns-table function). storefront_my_price_tier reads only .tier and needs no change.
drop function if exists public.storefront_my_member_status();
drop function if exists public.storefront_member_status(uuid);

create function public.storefront_member_status(p_auth_user_id uuid)
returns table (tier text, member_percent numeric, code_name text, keeps_member_price boolean)
language sql
stable
security definer
set search_path = public
as $$
    with account as (
        select k.discount_percent, k.name, a.kept_member_price, a.source, a.created_at as joined_at
          from public.storefront_member_accounts a
          left join public.storefront_member_codes k on k.id = a.member_code_id
         where a.auth_user_id = p_auth_user_id
    ),
    customer as (
        select c.id, c.tier
          from public.storefront_customers c
         where c.auth_user_id = p_auth_user_id
    ),
    paid as (
        select o.created_at
          from public.storefront_orders o
          join customer on customer.id = o.customer_id
         where o.payment_status = 'paid'
           and o.status <> 'cancelled'
    )
    select
        case
            when p_auth_user_id is null then 'retail'
            when exists (select 1 from customer where customer.tier = 'reseller') then 'reseller'
            when exists (select 1 from account)
              or exists (select 1 from customer where customer.tier = 'member')
              or exists (select 1 from paid)
            then 'member'
            else 'retail'
        end,
        (select account.discount_percent from account),
        (select account.name from account),
        p_auth_user_id is not null and (
               exists (select 1 from account where account.kept_member_price)
            or exists (select 1 from customer where customer.tier = 'member')
            -- A paid order before the code: "pernah belanja" made them a member first. With no code row at
            -- all there is no percentage to compare, so the answer does not matter there.
            or exists (
                   select 1 from paid
                    where paid.created_at < coalesce(
                              (select account.joined_at from account where account.source = 'code'),
                              'infinity'::timestamptz)
               )
        );
$$;

revoke all on function public.storefront_member_status(uuid) from public, anon, authenticated;
grant execute on function public.storefront_member_status(uuid) to service_role;

create function public.storefront_my_member_status()
returns table (tier text, member_percent numeric, code_name text, keeps_member_price boolean)
language sql
stable
security definer
set search_path = public
as $$
    select s.tier, s.member_percent, s.code_name, s.keeps_member_price
      from public.storefront_member_status(auth.uid()) s;
$$;

revoke all on function public.storefront_my_member_status() from public;
grant execute on function public.storefront_my_member_status() to anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- Verify (read-only), after running:
--   select source, kept_member_price, count(*) from public.storefront_member_accounts group by 1, 2;
--     -> every 'legacy' row true; 'code' rows true only for accounts older than the legacy batch
--   select * from public.storefront_member_status(null);
--     -> retail, null, null, false
--   select proname, proacl from pg_proc where proname in ('storefront_member_status', 'storefront_my_member_status');
--     -> storefront_member_status: service_role only
--
-- Rollback (back to #591: a code pays exactly its percentage for everyone): run the section "4. The rule"
-- and the storefront_my_member_status definition from 20261110120000_member_codes.sql, after
--   drop function if exists public.storefront_my_member_status();
--   drop function if exists public.storefront_member_status(uuid);
-- Both readers then see no keeps_member_price and treat it as false. The column may stay.
