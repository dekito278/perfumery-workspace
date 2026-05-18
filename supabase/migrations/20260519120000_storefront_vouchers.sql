create table if not exists public.storefront_vouchers (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    discount_type text not null default 'fixed',
    discount_value integer not null default 0,
    minimum_order integer not null default 0,
    expires_at date,
    active boolean not null default true,
    usage_limit_total integer not null default 0,
    usage_count integer not null default 0,
    eligible_product_slugs jsonb not null default '[]'::jsonb,
    eligible_categories jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint storefront_vouchers_code_not_blank check (char_length(trim(code)) > 0),
    constraint storefront_vouchers_code_uppercase check (code = upper(regexp_replace(trim(code), '\s+', '', 'g'))),
    constraint storefront_vouchers_discount_type_valid check (discount_type in ('percent', 'fixed')),
    constraint storefront_vouchers_discount_value_positive check (discount_value > 0),
    constraint storefront_vouchers_minimum_order_non_negative check (minimum_order >= 0),
    constraint storefront_vouchers_usage_limit_non_negative check (usage_limit_total >= 0),
    constraint storefront_vouchers_usage_count_non_negative check (usage_count >= 0),
    constraint storefront_vouchers_eligible_product_slugs_array check (jsonb_typeof(eligible_product_slugs) = 'array'),
    constraint storefront_vouchers_eligible_categories_array check (jsonb_typeof(eligible_categories) = 'array')
);

alter table public.storefront_vouchers
    add column if not exists eligible_product_slugs jsonb not null default '[]'::jsonb,
    add column if not exists eligible_categories jsonb not null default '[]'::jsonb;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'storefront_vouchers_eligible_product_slugs_array'
    ) then
        alter table public.storefront_vouchers
            add constraint storefront_vouchers_eligible_product_slugs_array
            check (jsonb_typeof(eligible_product_slugs) = 'array');
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'storefront_vouchers_eligible_categories_array'
    ) then
        alter table public.storefront_vouchers
            add constraint storefront_vouchers_eligible_categories_array
            check (jsonb_typeof(eligible_categories) = 'array');
    end if;
end $$;

create index if not exists storefront_vouchers_code_idx
    on public.storefront_vouchers (code);

create index if not exists storefront_vouchers_active_idx
    on public.storefront_vouchers (active);

drop trigger if exists storefront_vouchers_set_updated_at on public.storefront_vouchers;
create trigger storefront_vouchers_set_updated_at
before update on public.storefront_vouchers
for each row
execute function public.set_updated_at();

create table if not exists public.storefront_voucher_usage_records (
    id uuid primary key default gen_random_uuid(),
    voucher_id uuid not null references public.storefront_vouchers(id) on delete cascade,
    voucher_code text not null,
    order_id uuid,
    order_number text,
    amount integer not null default 1,
    used_at timestamptz not null default timezone('utc', now()),
    constraint storefront_voucher_usage_amount_positive check (amount > 0),
    constraint storefront_voucher_usage_order_present check (order_id is not null or char_length(trim(coalesce(order_number, ''))) > 0)
);

create unique index if not exists storefront_voucher_usage_order_id_idx
    on public.storefront_voucher_usage_records (voucher_code, order_id)
    where order_id is not null;

create unique index if not exists storefront_voucher_usage_order_number_idx
    on public.storefront_voucher_usage_records (voucher_code, order_number)
    where order_number is not null and order_number <> '';

create index if not exists storefront_voucher_usage_used_at_idx
    on public.storefront_voucher_usage_records (used_at desc);

alter table public.storefront_vouchers enable row level security;
alter table public.storefront_voucher_usage_records enable row level security;

drop policy if exists "storefront vouchers public select" on public.storefront_vouchers;
create policy "storefront vouchers public select"
on public.storefront_vouchers
for select
using (true);

drop policy if exists "storefront vouchers admin insert" on public.storefront_vouchers;
create policy "storefront vouchers admin insert"
on public.storefront_vouchers
for insert
with check (auth.role() = 'authenticated');

drop policy if exists "storefront vouchers admin update" on public.storefront_vouchers;
create policy "storefront vouchers admin update"
on public.storefront_vouchers
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "storefront vouchers admin delete" on public.storefront_vouchers;
create policy "storefront vouchers admin delete"
on public.storefront_vouchers
for delete
using (auth.role() = 'authenticated');

drop policy if exists "storefront voucher usage admin select" on public.storefront_voucher_usage_records;
create policy "storefront voucher usage admin select"
on public.storefront_voucher_usage_records
for select
using (auth.role() = 'authenticated');

create or replace function public.storefront_record_voucher_usage(
    p_voucher_code text,
    p_order_id uuid default null,
    p_order_number text default null,
    p_amount integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_code text := upper(regexp_replace(trim(coalesce(p_voucher_code, '')), '\s+', '', 'g'));
    v_amount integer := greatest(coalesce(p_amount, 1), 1);
    v_voucher public.storefront_vouchers%rowtype;
    v_record public.storefront_voucher_usage_records%rowtype;
    v_existing public.storefront_voucher_usage_records%rowtype;
begin
    if v_code = '' then
        raise exception 'Kode voucher wajib diisi';
    end if;

    select *
    into v_voucher
    from public.storefront_vouchers
    where code = v_code
    for update;

    if not found then
        raise exception 'Voucher tidak ditemukan';
    end if;

    select *
    into v_existing
    from public.storefront_voucher_usage_records
    where voucher_code = v_code
      and (
        (p_order_id is not null and order_id = p_order_id)
        or (coalesce(p_order_number, '') <> '' and order_number = p_order_number)
      )
    limit 1;

    if found then
        return jsonb_build_object(
            'tracked', false,
            'already_tracked', true,
            'record', to_jsonb(v_existing),
            'voucher', to_jsonb(v_voucher)
        );
    end if;

    if v_voucher.usage_limit_total > 0 and v_voucher.usage_count + v_amount > v_voucher.usage_limit_total then
        raise exception 'Kuota voucher sudah habis';
    end if;

    insert into public.storefront_voucher_usage_records (
        voucher_id,
        voucher_code,
        order_id,
        order_number,
        amount
    ) values (
        v_voucher.id,
        v_code,
        p_order_id,
        nullif(trim(coalesce(p_order_number, '')), ''),
        v_amount
    )
    returning * into v_record;

    update public.storefront_vouchers
    set usage_count = usage_count + v_amount
    where id = v_voucher.id
    returning * into v_voucher;

    return jsonb_build_object(
        'tracked', true,
        'already_tracked', false,
        'record', to_jsonb(v_record),
        'voucher', to_jsonb(v_voucher)
    );
end;
$$;

grant execute on function public.storefront_record_voucher_usage(text, uuid, text, integer) to anon, authenticated;
