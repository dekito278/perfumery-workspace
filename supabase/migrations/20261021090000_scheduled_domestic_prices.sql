-- Harga domestik baru, berlaku 12 Nov 2026 00:00 WIB
--
-- Dekito's October 2026 brief, §2. Retail and member change; the international price does NOT.
--
-- WHY A SEPARATE TABLE, and not a column on storefront_product_prices:
--   * that table has unique (product_id, variant_id, tier), so the current member price and the
--     scheduled one cannot both sit in it;
--   * its tier check allows only member/reseller/overseas, so a scheduled RETAIL price is not even a
--     legal row there;
--   * three admin paths lean on that exact constraint — saveTierPrice upserts on it, listTierPriceIndex
--     reads one row per tier, deleteTierPrice removes every row for a tier. Changing it would break the
--     member-price screen in the same week the prices change.
-- So nothing above is touched. This table is additive, and dropping it undoes everything.
--
-- THE DATABASE'S CLOCK DECIDES, never the buyer's device: the functions below filter on now(), and the
-- order endpoint uses its own server clock. A visitor with a fast clock cannot buy at tomorrow's price.
--
-- Postponing or cancelling the change needs no deploy:
--   update public.storefront_price_schedule set effective_at = '2026-11-19 00:00:00+07';  -- a week later
--   delete from public.storefront_price_schedule where effective_at = '2026-11-12 00:00:00+07';         -- cancel

create table if not exists public.storefront_price_schedule (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.storefront_products (id) on delete cascade,
    -- '' is the product-level price; otherwise the variant's own id, e.g. '30-ml'.
    variant_id text not null default '',
    -- retail is allowed here and not in storefront_product_prices: a scheduled retail price is the whole
    -- point, and the old table's check constraint has no reason to change.
    tier text not null check (tier in ('retail', 'member', 'reseller', 'overseas')),
    price_number numeric(12, 0) not null check (price_number >= 0),
    effective_at timestamptz not null,
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (product_id, variant_id, tier, effective_at)
);

create index if not exists storefront_price_schedule_due_idx
    on public.storefront_price_schedule (effective_at);

alter table public.storefront_price_schedule enable row level security;

-- Same shape as storefront_product_prices: direct reads are admin-only, buyers come through the
-- security-definer functions below. A future price is commercially sensitive — it is the one thing a
-- competitor or a stockist would most like to read early.
drop policy if exists storefront_price_schedule_admin_all on public.storefront_price_schedule;
create policy storefront_price_schedule_admin_all
    on public.storefront_price_schedule for all
    using (public.is_admin())
    with check (public.is_admin());

-- The two readers. Both keep their exact return signature, so the guards that read their text still
-- hold; the only change is that each now merges the schedule and takes the row in force.
create or replace function public.storefront_prices_for_me(p_slugs text[] default null)
returns table (
    slug text,
    variant_id text,
    tier text,
    price_number numeric
)
language sql
stable
security definer
set search_path = public
as $$
    with in_force as (
        select pr.product_id, pr.variant_id, pr.tier, pr.price_number, null::timestamptz as effective_at
          from public.storefront_product_prices pr
        union all
        select sc.product_id, sc.variant_id, sc.tier, sc.price_number, sc.effective_at
          from public.storefront_price_schedule sc
         where sc.effective_at <= now()
    )
    select distinct on (f.product_id, f.variant_id, f.tier)
           p.slug, f.variant_id, f.tier, f.price_number
      from in_force f
      join public.storefront_products p on p.id = f.product_id
     where (p_slugs is null or p.slug = any (p_slugs))
       and f.tier in (public.storefront_my_price_tier(), 'overseas', 'retail')
       and not public.storefront_product_is_draft(p.tags)
     order by f.product_id, f.variant_id, f.tier, f.effective_at desc nulls last;
$$;

create or replace function public.storefront_member_prices(p_slugs text[] default null)
returns table (
    slug text,
    variant_id text,
    tier text,
    price_number numeric
)
language sql
stable
security definer
set search_path = public
as $$
    with in_force as (
        select pr.product_id, pr.variant_id, pr.tier, pr.price_number, null::timestamptz as effective_at
          from public.storefront_product_prices pr
        union all
        select sc.product_id, sc.variant_id, sc.tier, sc.price_number, sc.effective_at
          from public.storefront_price_schedule sc
         where sc.effective_at <= now()
    )
    select distinct on (f.product_id, f.variant_id, f.tier)
           p.slug, f.variant_id, f.tier, f.price_number
      from in_force f
      join public.storefront_products p on p.id = f.product_id
     where (p_slugs is null or p.slug = any (p_slugs))
       and f.tier = 'member'
       and not public.storefront_product_is_draft(p.tags)
     order by f.product_id, f.variant_id, f.tier, f.effective_at desc nulls last;
$$;

grant execute on function public.storefront_prices_for_me(text[]) to anon, authenticated;
grant execute on function public.storefront_member_prices(text[]) to anon, authenticated;

-- The 19 live products, mapped from the price each one carries TODAY, not from its name:
--   Rp 359.000 -> 479.000 / member 429.000   (10 products, tier A)
--   Rp 429.000 -> 569.000 / member 509.000   ( 7 products, tier B)
--   Rp 649.000 -> 849.000 / member 765.000   (Aquilaria tuberosa)
--   Rp 750.000 -> 950.000 / member 855.000   (Maskumambang)
-- Bespoke is not here: its price is not a catalogue row. Bloody Luwak is not here either — it is not a
-- product in this shop (Dekito, 2026-10-21).
insert into public.storefront_price_schedule (product_id, variant_id, tier, price_number, effective_at, note)
values
  ((select id from public.storefront_products where slug = 'la-tulipe'), '30-ml', 'retail', 479000, '2026-11-12 00:00:00+07', 'Nov 2026: La Tulipe 359000 -> 479000'),
  ((select id from public.storefront_products where slug = 'la-tulipe'), '30-ml', 'member', 429000, '2026-11-12 00:00:00+07', 'Nov 2026: La Tulipe member 429000'),
  ((select id from public.storefront_products where slug = 'ayang-ayang'), '30-ml', 'retail', 479000, '2026-11-12 00:00:00+07', 'Nov 2026: Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀) 359000 -> 479000'),
  ((select id from public.storefront_products where slug = 'ayang-ayang'), '30-ml', 'member', 429000, '2026-11-12 00:00:00+07', 'Nov 2026: Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀) member 429000'),
  ((select id from public.storefront_products where slug = 'hug-n-1'), '30-ml', 'retail', 479000, '2026-11-12 00:00:00+07', 'Nov 2026: HUG N°1 359000 -> 479000'),
  ((select id from public.storefront_products where slug = 'hug-n-1'), '30-ml', 'member', 429000, '2026-11-12 00:00:00+07', 'Nov 2026: HUG N°1 member 429000'),
  ((select id from public.storefront_products where slug = 'wayback'), '30-ml', 'retail', 569000, '2026-11-12 00:00:00+07', 'Nov 2026: .Wayback 429000 -> 569000'),
  ((select id from public.storefront_products where slug = 'wayback'), '30-ml', 'member', 509000, '2026-11-12 00:00:00+07', 'Nov 2026: .Wayback member 509000'),
  ((select id from public.storefront_products where slug = 'soli-extended-j-adore-la-vanille'), '30-ml', 'retail', 479000, '2026-11-12 00:00:00+07', 'Nov 2026: J’adore la Vanille 359000 -> 479000'),
  ((select id from public.storefront_products where slug = 'soli-extended-j-adore-la-vanille'), '30-ml', 'member', 429000, '2026-11-12 00:00:00+07', 'Nov 2026: J’adore la Vanille member 429000'),
  ((select id from public.storefront_products where slug = 'aquilaria-tuberosa'), '30-ml', 'retail', 849000, '2026-11-12 00:00:00+07', 'Nov 2026: Aquilaria tuberosa 649000 -> 849000'),
  ((select id from public.storefront_products where slug = 'aquilaria-tuberosa'), '30-ml', 'member', 765000, '2026-11-12 00:00:00+07', 'Nov 2026: Aquilaria tuberosa member 765000'),
  ((select id from public.storefront_products where slug = 'animal-farm'), 'variant-1779213046244', 'retail', 479000, '2026-11-12 00:00:00+07', 'Nov 2026: Animal Farm 359000 -> 479000'),
  ((select id from public.storefront_products where slug = 'animal-farm'), 'variant-1779213046244', 'member', 429000, '2026-11-12 00:00:00+07', 'Nov 2026: Animal Farm member 429000'),
  ((select id from public.storefront_products where slug = 'j-adore-la-vetiver'), '30-ml', 'retail', 479000, '2026-11-12 00:00:00+07', 'Nov 2026: J’adore La Vetiver 359000 -> 479000'),
  ((select id from public.storefront_products where slug = 'j-adore-la-vetiver'), '30-ml', 'member', 429000, '2026-11-12 00:00:00+07', 'Nov 2026: J’adore La Vetiver member 429000'),
  ((select id from public.storefront_products where slug = 'jata-bhumi'), '10-ml', 'retail', 479000, '2026-11-12 00:00:00+07', 'Nov 2026: Jata Bhumi 359000 -> 479000'),
  ((select id from public.storefront_products where slug = 'jata-bhumi'), '10-ml', 'member', 429000, '2026-11-12 00:00:00+07', 'Nov 2026: Jata Bhumi member 429000'),
  ((select id from public.storefront_products where slug = 'la-rose'), '30-ml', 'retail', 569000, '2026-11-12 00:00:00+07', 'Nov 2026: La Rose 429000 -> 569000'),
  ((select id from public.storefront_products where slug = 'la-rose'), '30-ml', 'member', 509000, '2026-11-12 00:00:00+07', 'Nov 2026: La Rose member 509000'),
  ((select id from public.storefront_products where slug = 'lintang-asmoro'), '30-ml', 'retail', 569000, '2026-11-12 00:00:00+07', 'Nov 2026: Lintang Asmoro 429000 -> 569000'),
  ((select id from public.storefront_products where slug = 'lintang-asmoro'), '30-ml', 'member', 509000, '2026-11-12 00:00:00+07', 'Nov 2026: Lintang Asmoro member 509000'),
  ((select id from public.storefront_products where slug = 'maskumambang'), '30-ml', 'retail', 999000, '2026-11-12 00:00:00+07', 'Nov 2026: Maskumambang 750000 -> 999000 (dikoreksi 22 Okt)'),
  ((select id from public.storefront_products where slug = 'maskumambang'), '30-ml', 'member', 899000, '2026-11-12 00:00:00+07', 'Nov 2026: Maskumambang member 899000 (dikoreksi 22 Okt)'),
  ((select id from public.storefront_products where slug = 'l-iris'), '30-ml', 'retail', 569000, '2026-11-12 00:00:00+07', 'Nov 2026: L’iris 429000 -> 569000'),
  ((select id from public.storefront_products where slug = 'l-iris'), '30-ml', 'member', 509000, '2026-11-12 00:00:00+07', 'Nov 2026: L’iris member 509000'),
  ((select id from public.storefront_products where slug = 'pantura'), '30-ml', 'retail', 569000, '2026-11-12 00:00:00+07', 'Nov 2026: Pantura 429000 -> 569000'),
  ((select id from public.storefront_products where slug = 'pantura'), '30-ml', 'member', 509000, '2026-11-12 00:00:00+07', 'Nov 2026: Pantura member 509000'),
  ((select id from public.storefront_products where slug = 'jason-voorhees'), '30-ml', 'retail', 479000, '2026-11-12 00:00:00+07', 'Nov 2026: Jason Voorhees 359000 -> 479000'),
  ((select id from public.storefront_products where slug = 'jason-voorhees'), '30-ml', 'member', 429000, '2026-11-12 00:00:00+07', 'Nov 2026: Jason Voorhees member 429000'),
  ((select id from public.storefront_products where slug = 'vanille-planifolia'), '10-ml', 'retail', 479000, '2026-11-12 00:00:00+07', 'Nov 2026: Vanille Planifolia 359000 -> 479000'),
  ((select id from public.storefront_products where slug = 'vanille-planifolia'), '10-ml', 'member', 429000, '2026-11-12 00:00:00+07', 'Nov 2026: Vanille Planifolia member 429000'),
  ((select id from public.storefront_products where slug = 'sudra'), '30-ml', 'retail', 569000, '2026-11-12 00:00:00+07', 'Nov 2026: Sudra 429000 -> 569000'),
  ((select id from public.storefront_products where slug = 'sudra'), '30-ml', 'member', 509000, '2026-11-12 00:00:00+07', 'Nov 2026: Sudra member 509000'),
  ((select id from public.storefront_products where slug = 'patchouli-so-sexy'), '30-ml', 'retail', 479000, '2026-11-12 00:00:00+07', 'Nov 2026: Patchouli so sexy 359000 -> 479000'),
  ((select id from public.storefront_products where slug = 'patchouli-so-sexy'), '30-ml', 'member', 429000, '2026-11-12 00:00:00+07', 'Nov 2026: Patchouli so sexy member 429000'),
  ((select id from public.storefront_products where slug = 'wongka'), '30-ml', 'retail', 569000, '2026-11-12 00:00:00+07', 'Nov 2026: Wongka! 429000 -> 569000'),
  ((select id from public.storefront_products where slug = 'wongka'), '30-ml', 'member', 509000, '2026-11-12 00:00:00+07', 'Nov 2026: Wongka! member 509000')
on conflict (product_id, variant_id, tier, effective_at) do update
  set price_number = excluded.price_number, note = excluded.note, updated_at = now();

-- Verify. Expect 38 rows: 19 retail + 19 member, all at the same instant.
select tier, count(*) as baris, min(price_number) as termurah, max(price_number) as termahal
  from public.storefront_price_schedule
 where effective_at = '2026-11-12 00:00:00+07'
 group by tier order by tier;

-- Nothing is in force yet (run before 12 Nov). Expect 0.
select count(*) as sudah_berlaku from public.storefront_price_schedule where effective_at <= now();

-- The international price must not move. Expect the same 19 overseas rows as before, untouched.
select count(*) as overseas_rows from public.storefront_product_prices where tier = 'overseas';

-- Rollback, complete:
--   drop function if exists public.storefront_prices_for_me(text[]);
--   drop function if exists public.storefront_member_prices(text[]);
--   -- then re-run 20260913090000 and 20260914200000 to restore the previous bodies, and:
--   drop table if exists public.storefront_price_schedule;
