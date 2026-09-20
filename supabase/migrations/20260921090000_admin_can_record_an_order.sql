-- Admin boleh mencatat order dari Studio.
--
-- KENAPA. Tombol "Buat order (toko EN)" di Studio -> Ongkir ekspor gagal di produksi:
--
--   POST /rest/v1/storefront_orders  ->  403
--   "new row violates row-level security policy for table storefront_orders"
--
-- Order dari browser memang dilarang, dan itu BENAR: lubang anon-INSERT ditutup setelah audit round 9,
-- supaya tidak ada yang bisa menyuntik order dengan harga karangan sendiri. Pembeli wajib lewat
-- /api/orders/create yang menghitung ulang semua harga di server.
--
-- Tapi penjualan internasional tidak datang dari checkout. Ia datang dari percakapan WhatsApp, dan yang
-- mencatatnya adalah Dekito sendiri di Studio. Endpoint otoritatif tidak bisa melayaninya: ia menghitung
-- ulang harga dari tier domestik (Rp 279.000, bukan Rp 980.000) dan ongkir dari RajaOngkir, yang tidak
-- tahu alamat Malaysia.
--
-- Jadi yang dibuka di sini SEMPIT: bukan "browser boleh menulis order", melainkan "akun yang terdaftar
-- di storefront_admins boleh". Anonim tetap ditolak. Pembeli tetap wajib lewat endpoint.
--
-- Tanpa begin/commit — editor Supabase-mu menolaknya diam-diam.


-- ============================================================
-- BLOK 1 — KEBIJAKAN INSERT UNTUK ADMIN
--
-- public.is_admin() sudah ada sejak 20260715120000: ia mengecek keanggotaan di storefront_admins,
-- bukan sekadar "sudah login". Seorang pelanggan yang punya akun TIDAK lolos.
-- ============================================================
drop policy if exists "storefront orders admin insert" on public.storefront_orders;
create policy "storefront orders admin insert"
on public.storefront_orders
for insert
to authenticated
with check (public.is_admin());


-- ============================================================
-- BLOK 2 — CEK. Harus keluar 1 baris: INSERT | storefront orders admin insert
-- ============================================================
select cmd, policyname, roles::text, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'storefront_orders'
  and cmd = 'INSERT';


-- ============================================================
-- BLOK 3 — CEK kedua: pastikan TIDAK ADA kebijakan insert yang mengizinkan anon.
-- Harus keluar 0 baris. Kalau ada, lubang audit round 9 terbuka lagi.
-- ============================================================
select policyname, roles::text, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'storefront_orders'
  and cmd = 'INSERT'
  and (roles::text like '%anon%' or with_check = 'true');


-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop policy if exists "storefront orders admin insert" on public.storefront_orders;
