-- Pesanan lama bisa disambungkan ke akun, supaya pembelinya bisa memberi ulasan (Dekito, 26 Nov 2026: "untuk
-- masalah pembeli lama bisa memberi ulasan, ini juga boleh").
-- Jalankan SEKALI di Supabase SQL editor, SESUDAH 20261120090000_buyer_reviews.sql. Aman dijalankan dua kali.
--
-- Masalahnya: ulasan hanya bisa dari pesanan yang dibuat sambil masuk Google (atau akun yang tersambung ke kode
-- pelanggan). Sebagian besar pembeli lama memesan tanpa masuk, jadi bagian "Ulasan kamu" tidak pernah muncul untuk
-- mereka.
--
-- Caranya: di halaman Akun, pembeli yang sudah masuk Google mengetik NOMOR ORDER + NOMOR WHATSAPP yang dipakai waktu
-- memesan. Kalau keduanya cocok dengan satu pesanan, pesanan itu dicatat sebagai milik akun itu
-- (client_context.buyer_account — tanda yang sama yang dipakai pesanan baru sejak 20 Nov 2026). Sesudah itu parfum
-- dari pesanan yang sudah dikirim bisa diulas seperti biasa.
--
-- Aman:
--   - harus masuk akun; nomor order DAN nomor WhatsApp harus cocok (nomor dinormalkan: 0812…, +62812…, 62812…);
--   - pesanan yang sudah tersambung ke akun LAIN tidak bisa diambil;
--   - salah 10 kali dalam satu jam → dikunci satu jam (mencegah tebak-tebakan);
--   - tidak membuka data apa pun: yang dikembalikan hanya nomor order itu sendiri. Isi pesanan, alamat, harga tidak
--     tampil di mana-mana lewat fungsi ini. Data pesanan tidak diubah selain tanda buyer_account.

begin;

create table if not exists public.storefront_order_claim_attempts (
    id bigserial primary key,
    auth_user_id uuid not null references auth.users (id) on delete cascade,
    succeeded boolean not null default false,
    attempted_at timestamptz not null default timezone('utc', now())
);

create index if not exists storefront_order_claim_attempts_user_time_idx
    on public.storefront_order_claim_attempts (auth_user_id, attempted_at desc);

alter table public.storefront_order_claim_attempts enable row level security;
revoke all on public.storefront_order_claim_attempts from anon, authenticated;

-- Answers with a reason instead of raising for a wrong guess: a raise would roll back the attempt it just recorded,
-- and the one-hour lock would never count anything. Reasons: 'linked' | 'already_yours' | 'not_found' | 'taken' |
-- 'too_many' | 'missing'.
drop function if exists public.storefront_claim_order(text, text);
create function public.storefront_claim_order(p_order_number text, p_contact text)
returns table (ok boolean, reason text, order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
    caller uuid := auth.uid();
    wanted_number text := upper(btrim(coalesce(p_order_number, '')));
    wanted_phone text := public.normalize_phone(p_contact);
    wanted_contact text := lower(btrim(coalesce(p_contact, '')));
    recent_failures integer;
    found public.storefront_orders%rowtype;
    owner text;
begin
    if caller is null then
        raise exception 'Masuk dulu untuk menyambungkan pesanan.' using errcode = '28000';
    end if;
    if wanted_number = '' or wanted_contact = '' then
        return query select false, 'missing', null::text;
        return;
    end if;

    select count(*) into recent_failures
      from public.storefront_order_claim_attempts a
     where a.auth_user_id = caller
       and not a.succeeded
       and a.attempted_at > timezone('utc', now()) - interval '1 hour';
    if recent_failures >= 10 then
        return query select false, 'too_many', null::text;
        return;
    end if;

    select * into found
      from public.storefront_orders o
     where upper(o.order_number) = wanted_number
       and (
             (wanted_phone is not null and public.normalize_phone(o.contact) = wanted_phone)
          or lower(btrim(o.contact)) = wanted_contact
       )
     limit 1;

    if found.id is null then
        insert into public.storefront_order_claim_attempts (auth_user_id, succeeded) values (caller, false);
        return query select false, 'not_found', null::text;
        return;
    end if;

    owner := found.client_context ->> 'buyer_account';
    if owner is not null and owner <> caller::text then
        insert into public.storefront_order_claim_attempts (auth_user_id, succeeded) values (caller, false);
        return query select false, 'taken', null::text;
        return;
    end if;

    if owner is null then
        update public.storefront_orders o
           set client_context = coalesce(o.client_context, '{}'::jsonb) || jsonb_build_object('buyer_account', caller::text)
         where o.id = found.id;
    end if;
    insert into public.storefront_order_claim_attempts (auth_user_id, succeeded) values (caller, true);
    return query select true, case when owner is null then 'linked' else 'already_yours' end, found.order_number;
end;
$$;

revoke execute on function public.storefront_claim_order(text, text) from public, anon;
grant execute on function public.storefront_claim_order(text, text) to authenticated;

commit;

-- CEK
--   select proname from pg_proc where proname = 'storefront_claim_order';   -> 1 baris
--
-- BATAL
--   drop function if exists public.storefront_claim_order(text, text);
--   drop table if exists public.storefront_order_claim_attempts;
--   (pesanan yang sudah tersambung tetap tersambung; hapus tandanya dengan:
--    update public.storefront_orders set client_context = client_context - 'buyer_account';  -- HATI-HATI: semua pesanan)
