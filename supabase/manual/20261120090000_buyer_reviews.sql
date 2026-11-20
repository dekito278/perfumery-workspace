-- Ulasan dari pembeli terverifikasi (Dekito, 20 Nov 2026).
-- Jalankan SEKALI di Supabase SQL editor. Aman dijalankan dua kali.
--
-- Yang Dekito putuskan:
--   - hanya pembeli yang PESANANNYA SUDAH DIKIRIM (status dikirim / selesai) yang bisa memberi ulasan, dari
--     halaman Akun, satu ulasan per parfum per pesanan;
--   - bintang 1–5 wajib, tulisan boleh kosong (paling panjang 600 huruf);
--   - nama tampil "nama depan + inisial" ("Rina S.") atau anonim ("Pembeli terverifikasi");
--   - setiap ulasan DICEK DULU: masuk sebagai "menunggu", baru tampil sesudah Dekito menekan Tampilkan di
--     Studio → Ulasan. Dekito boleh menulis balasan;
--   - pembeli boleh mengubah ulasannya selama 30 hari; ulasan yang diubah kembali "menunggu".
--
-- Siapa "pembeli" sebuah pesanan, dua jalan (cukup salah satu):
--   a. akun Google yang tersambung ke data pelanggan (storefront_customers.auth_user_id) — jalur yang sama
--      dengan halaman Akun yang menampilkan riwayat pesanan;
--   b. akun yang sedang masuk waktu memesan: sejak 20 Nov 2026 server pesanan mencatatnya di
--      storefront_orders.client_context ->> 'buyer_account' (diambil dari sesi yang sudah diverifikasi).
-- Nama yang tampil diambil dari nama penerima di pesanan itu. Semua pemeriksaan ada di server (fungsi di
-- bawah), bukan di browser.
--
-- Isi:
--   1. tabel storefront_reviews (hanya admin yang bisa membaca/mengubah langsung);
--   2. view storefront_reviews_public  — ulasan yang sudah ditampilkan, tanpa data pribadi, untuk toko;
--   3. view storefront_review_stats    — rata-rata bintang dan jumlah ulasan per produk;
--   4. fungsi storefront_my_reviewable_items() dan storefront_submit_review(...) untuk pembeli.

begin;

-- 1. Tabel -------------------------------------------------------------------------------------------------

create table if not exists public.storefront_reviews (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.storefront_products (id) on delete cascade,
    order_id uuid not null references public.storefront_orders (id) on delete cascade,
    order_number text not null default '',
    customer_id uuid references public.storefront_customers (id) on delete set null,
    auth_user_id uuid references auth.users (id) on delete set null,
    rating smallint not null check (rating between 1 and 5),
    body text not null default '' check (char_length(body) <= 600),
    anonymous boolean not null default false,
    display_name text not null default '' check (char_length(display_name) <= 40),
    status text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
    reply text not null default '' check (char_length(reply) <= 600),
    replied_at timestamptz,
    published_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint storefront_reviews_one_per_order_product unique (order_id, product_id)
);

create index if not exists storefront_reviews_product_status_idx
    on public.storefront_reviews (product_id, status);
create index if not exists storefront_reviews_status_created_idx
    on public.storefront_reviews (status, created_at desc);

drop trigger if exists storefront_reviews_set_updated_at on public.storefront_reviews;
create trigger storefront_reviews_set_updated_at
before update on public.storefront_reviews
for each row
execute function public.set_updated_at();

alter table public.storefront_reviews enable row level security;

-- Pembeli dan pengunjung tidak menyentuh tabel ini langsung: pembeli lewat fungsi di bawah, toko lewat view.
revoke all on public.storefront_reviews from anon, authenticated;
grant select, update, delete on public.storefront_reviews to authenticated;

drop policy if exists "storefront reviews admin select" on public.storefront_reviews;
create policy "storefront reviews admin select"
on public.storefront_reviews for select
using (public.is_admin());

drop policy if exists "storefront reviews admin update" on public.storefront_reviews;
create policy "storefront reviews admin update"
on public.storefront_reviews for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "storefront reviews admin delete" on public.storefront_reviews;
create policy "storefront reviews admin delete"
on public.storefront_reviews for delete
using (public.is_admin());

-- 2. Yang tampil di toko ---------------------------------------------------------------------------------
-- Hanya ulasan "published", hanya produk yang tidak draf. Tidak ada id pesanan, id pelanggan, kontak, atau
-- nama lengkap: nama anonim menjadi null dan toko menulis "Pembeli terverifikasi".

create or replace view public.storefront_reviews_public as
    select
        r.id,
        p.slug as product_slug,
        p.name as product_name,
        r.rating,
        r.body,
        case when r.anonymous then null else nullif(r.display_name, '') end as display_name,
        nullif(r.reply, '') as reply,
        r.replied_at,
        coalesce(r.published_at, r.created_at) as published_at,
        r.created_at
    from public.storefront_reviews r
    join public.storefront_products p on p.id = r.product_id
    where r.status = 'published'
      and not public.storefront_product_is_draft(p.tags);

create or replace view public.storefront_review_stats as
    select
        product_slug,
        count(*)::integer as review_count,
        round(avg(rating)::numeric, 1) as average_rating
    from public.storefront_reviews_public
    group by product_slug;

grant select on public.storefront_reviews_public to anon, authenticated;
grant select on public.storefront_review_stats to anon, authenticated;

-- 3. Pembeli ---------------------------------------------------------------------------------------------

-- "Rina Sari Dewi" → "Rina D.", "rina" → "Rina". Nama kosong / "Walk-in customer" / "Customer" → kosong
-- (toko lalu menulis "Pembeli terverifikasi"). Situs punya salinan aturan ini untuk pratinjau di formulir
-- (src/utils/reviews.js → reviewDisplayName); yang disimpan selalu hasil fungsi ini.
create or replace function public.storefront_review_display_name(p_name text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
    cleaned text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
    parts text[];
    first_name text;
    last_initial text := '';
begin
    if cleaned = '' or lower(cleaned) in ('walk-in customer', 'customer', '-') then
        return '';
    end if;
    parts := string_to_array(cleaned, ' ');
    first_name := initcap(left(parts[1], 20));
    if array_length(parts, 1) > 1 then
        last_initial := ' ' || upper(left(parts[array_length(parts, 1)], 1)) || '.';
    end if;
    return left(first_name || last_initial, 40);
end;
$$;

-- Pesanan milik akun yang sedang masuk, yang sudah dikirim, dengan parfum di dalamnya (vial hadiah, baris
-- voucher dan produk draf tidak dihitung), beserta ulasan yang sudah ada. Satu baris per (pesanan, produk).
-- buyer_name = nama di pesanan itu sendiri (milik pembeli ini), untuk pratinjau "Tampil sebagai".
drop function if exists public.storefront_my_reviewable_items();
create function public.storefront_my_reviewable_items()
returns table (
    order_id uuid,
    order_number text,
    ordered_at timestamptz,
    buyer_name text,
    product_id uuid,
    product_slug text,
    product_name text,
    image_url text,
    review jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    caller uuid := auth.uid();
    me public.storefront_customers%rowtype;
begin
    if caller is null then
        return;
    end if;
    -- May find nothing: a buyer who signed in to order but never linked a customer code still has (b).
    select * into me from public.storefront_customers c where c.auth_user_id = caller limit 1;

    return query
    with mine as (
        select o.*
          from public.storefront_orders o
         where (
                   (me.id is not null and o.customer_id = me.id)
                or (me.customer_code is not null and o.customer_code = me.customer_code)
                or (o.client_context ->> 'buyer_account') = caller::text
               )
           and o.status <> 'cancelled'
           and o.payment_status <> 'refunded'
           and (o.status in ('shipped', 'completed') or o.shipment_status in ('shipped', 'delivered'))
    ),
    lines as (
        select distinct on (m.id, p.id)
               m.id as order_id, m.order_number, m.created_at as ordered_at, m.customer_name as buyer_name,
               p.id as product_id, p.slug as product_slug, p.name as product_name, p.image_url
          from mine m
          cross join lateral jsonb_array_elements(m.items) as item
          join public.storefront_products p
            on p.slug = coalesce(nullif(item ->> 'productSlug', ''), item ->> 'slug')
         where not public.storefront_product_is_draft(p.tags)
           and not exists (
                   select 1 from jsonb_array_elements_text(coalesce(p.tags, '[]'::jsonb)) as t(tag)
                    where lower(btrim(t.tag)) = 'vial hadiah'
               )
           and not exists (
                   select 1 from jsonb_array_elements_text(
                       case when jsonb_typeof(item -> 'tags') = 'array' then item -> 'tags' else '[]'::jsonb end
                   ) as t(tag)
                    where lower(btrim(t.tag)) = 'vial hadiah'
               )
         order by m.id, p.id
    )
    select l.order_id, l.order_number, l.ordered_at, l.buyer_name, l.product_id, l.product_slug, l.product_name, l.image_url,
           (select jsonb_build_object(
                'id', r.id, 'rating', r.rating, 'body', r.body, 'anonymous', r.anonymous,
                'display_name', r.display_name, 'status', r.status, 'reply', r.reply,
                'created_at', r.created_at, 'updated_at', r.updated_at,
                'editable_until', r.created_at + interval '30 days'
            )
              from public.storefront_reviews r
             where r.order_id = l.order_id and r.product_id = l.product_id) as review
      from lines l
     order by l.ordered_at desc, l.product_name;
end;
$$;

-- Simpan ulasan baru, atau ubah ulasan sendiri dalam 30 hari. Semua aturan diperiksa ulang di sini.
create or replace function public.storefront_submit_review(
    p_order_id uuid,
    p_product_id uuid,
    p_rating integer,
    p_body text default '',
    p_anonymous boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    caller uuid := auth.uid();
    me public.storefront_customers%rowtype;
    eligible record;
    existing public.storefront_reviews%rowtype;
    cleaned_body text;
    saved public.storefront_reviews%rowtype;
begin
    if caller is null then
        raise exception 'Masuk dulu untuk memberi ulasan.' using errcode = '28000';
    end if;
    if p_rating is null or p_rating < 1 or p_rating > 5 then
        raise exception 'Pilih 1 sampai 5 bintang.' using errcode = '22023';
    end if;

    -- Huruf kendali dibuang, spasi dirapikan, panjang dibatasi.
    cleaned_body := btrim(regexp_replace(coalesce(p_body, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));
    cleaned_body := regexp_replace(cleaned_body, '\n{3,}', E'\n\n', 'g');
    if char_length(cleaned_body) > 600 then
        raise exception 'Ulasan paling panjang 600 huruf.' using errcode = '22023';
    end if;

    select * into me from public.storefront_customers c where c.auth_user_id = caller limit 1;

    select * into eligible
      from public.storefront_my_reviewable_items() i
     where i.order_id = p_order_id and i.product_id = p_product_id
     limit 1;
    if eligible.order_id is null then
        raise exception 'Parfum ini belum bisa diulas dari pesanan ini.' using errcode = '42501';
    end if;

    select * into existing from public.storefront_reviews r
     where r.order_id = p_order_id and r.product_id = p_product_id
     for update;

    if existing.id is not null then
        if existing.created_at + interval '30 days' < timezone('utc', now()) then
            raise exception 'Ulasan hanya bisa diubah 30 hari sejak dikirim.' using errcode = '42501';
        end if;
        update public.storefront_reviews r
           set rating = p_rating,
               body = cleaned_body,
               anonymous = coalesce(p_anonymous, false),
               display_name = public.storefront_review_display_name(eligible.buyer_name),
               status = 'pending',
               published_at = null
         where r.id = existing.id
        returning * into saved;
    else
        insert into public.storefront_reviews (
            product_id, order_id, order_number, customer_id, auth_user_id,
            rating, body, anonymous, display_name, status
        ) values (
            p_product_id, p_order_id, eligible.order_number, me.id, caller,
            p_rating, cleaned_body, coalesce(p_anonymous, false),
            public.storefront_review_display_name(eligible.buyer_name), 'pending'
        )
        returning * into saved;
    end if;

    return jsonb_build_object(
        'id', saved.id, 'rating', saved.rating, 'body', saved.body, 'anonymous', saved.anonymous,
        'display_name', saved.display_name, 'status', saved.status, 'reply', saved.reply,
        'created_at', saved.created_at, 'updated_at', saved.updated_at,
        'editable_until', saved.created_at + interval '30 days'
    );
end;
$$;

revoke execute on function public.storefront_my_reviewable_items() from public, anon;
revoke execute on function public.storefront_submit_review(uuid, uuid, integer, text, boolean) from public, anon;
grant execute on function public.storefront_my_reviewable_items() to authenticated;
grant execute on function public.storefront_submit_review(uuid, uuid, integer, text, boolean) to authenticated;
grant execute on function public.storefront_review_display_name(text) to anon, authenticated;

commit;

-- CEK
--   select count(*) from public.storefront_reviews;            -> 0 (tabel ada)
--   select * from public.storefront_reviews_public limit 1;    -> kosong sampai ada ulasan yang ditampilkan
--   select public.storefront_review_display_name('rina sari dewi');   -> Rina D.
--
-- BATAL (menghapus semua ulasan!)
--   drop view if exists public.storefront_review_stats;
--   drop view if exists public.storefront_reviews_public;
--   drop function if exists public.storefront_submit_review(uuid, uuid, integer, text, boolean);
--   drop function if exists public.storefront_my_reviewable_items();
--   drop function if exists public.storefront_review_display_name(text);
--   drop table if exists public.storefront_reviews;
