-- SIAPA YANG BOLEH MENULIS. Hanya membaca — tidak mengubah apa pun, aman dijalankan kapan saja.
--
-- Satu-satunya pertanyaan tentang database ini yang tidak bisa dijawab dari luar.
-- `node apps/web/tools/audit-migrations-are-applied.mjs` sudah membuktikan 27 tabel, 1 view, 107 kolom
-- dan 28 fungsi yang dideklarasikan migrasi memang ada di produksi, dan dengan kunci anon ia juga
-- membuktikan apa yang bisa DIBACA orang asing (4 relasi mengembalikan baris, 18 ditahan RLS).
--
-- Yang tidak bisa ia lihat: 195 `create policy`. PostgREST tidak mengekspos `pg_policies`, dan alat itu
-- sengaja tidak pernah menulis — satu percobaan INSERT yang berhasil akan membuat baris sungguhan.
-- Jadi sisi TULIS harus dibaca dari dalam, di SQL Editor. Ini blok itu.
--
-- Cara pakai: Supabase -> SQL Editor -> tempel seluruh berkas ini -> Run. Lalu baca tiga jawabannya.
--
-- DIJALANKAN 17 Okt 2026, dan jawabannya: BLOK 1 nol baris, BLOK 2 nol baris. Tidak ada jalur tulis
-- yang tidak bergerbang, dan tidak ada tabel `public` yang RLS-nya mati — jadi 195 kebijakan itu
-- memang berlaku, bukan hiasan. BLOK 3 memperlihatkan 58 kebijakan tulis: seluruh `storefront_*`
-- bergerbang `is_admin()`, seluruh tabel Studio bergerbang `auth.uid() = user_id` atau lewat tabel
-- induknya, dan `journal_posts` menuntut keduanya. `storefront_customers` tidak punya kebijakan INSERT
-- dan `storefront_doku_payment_logs` tidak punya kebijakan tulis sama sekali: order dan customer
-- dibuat dari server lewat service role, yang memang bentuk paling aman.

-- ============================================================
-- BLOK 1 — PERTANYAAN UTAMA: ada tulisan yang terbuka untuk anonim?
--
-- HARUS 0 BARIS.
--
-- Satu baris di sini berarti seseorang dengan kunci anon dari bundle browser bisa menulis langsung ke
-- tabel itu, melewati /api/orders/create yang menghitung ulang semua harga di server. Itu lubang
-- CRITICAL audit round 9 (order dengan harga karangan sendiri), dan BLOK 3 dari
-- supabase/migrations/20260921090000_admin_can_record_an_order.sql hanya memeriksanya untuk SATU tabel.
-- Yang ini memeriksa seluruh skema public.
--
-- `with_check = 'true'` ikut dicari karena kebijakan yang tidak memeriksa apa pun sama terbukanya
-- dengan yang menyebut anon secara eksplisit.
--
-- DIPERBAIKI 17 Okt 2026. Versi pertama blok ini juga mencari `roles = '{public}'` dan karena itu
-- memberi ALARM PALSU berisi puluhan baris: `{public}` bukan "terbuka", itu cakupan role — ia memang
-- mencakup anon, tetapi yang menolak adalah EKSPRESINYA. Untuk anon `auth.uid()` bernilai NULL,
-- sehingga `auth.uid() = user_id` menghasilkan NULL dan tulisannya ditolak. Hampir seluruh tabel Studio
-- memakai bentuk itu. Jadi yang dicari sekarang adalah gerbangnya, bukan nama role-nya: kebijakan yang
-- menyebut anon, yang tidak memeriksa apa pun, atau yang syaratnya tidak menyinggung `is_admin()`
-- maupun `auth.uid()` sama sekali.
-- ============================================================
select tablename,
       cmd,
       policyname,
       roles::text as untuk_role,
       coalesce(with_check, qual) as syarat
from pg_policies
where schemaname = 'public'
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and (
    roles::text like '%anon%'
    or coalesce(with_check, qual, 'true') = 'true'
    or coalesce(with_check, qual) !~* 'is_admin|auth\.uid'
  )
order by tablename, cmd;


-- ============================================================
-- BLOK 2 — TABEL YANG RLS-NYA MATI.
--
-- HARUS 0 BARIS.
--
-- Kebijakan sebanyak apa pun tidak berarti kalau RLS-nya sendiri tidak dinyalakan di tabel itu: tanpa
-- `enable row level security`, setiap kebijakan diabaikan dan tabelnya terbuka penuh. Ini kondisi yang
-- tidak pernah terlihat dari kode, dan tidak akan pernah terlihat.
-- ============================================================
select c.relname as tabel,
       case when c.relrowsecurity then 'nyala' else 'MATI' end as rls,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as jumlah_kebijakan
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
order by c.relname;


-- ============================================================
-- BLOK 3 — GAMBARAN LENGKAP, untuk dibaca sekali lalu disimpan.
--
-- Bukan lulus/gagal: daftar siapa boleh menulis ke apa. Yang diharapkan adalah kolom `untuk_role`
-- berisi `{authenticated}` dengan `with_check` memanggil `is_admin()`, atau `{service_role}`.
-- `is_admin()` memeriksa keanggotaan di storefront_admins — pelanggan yang punya akun Google TIDAK
-- lolos, dan itu seluruh alasan fungsi itu ada.
-- ============================================================
select tablename,
       cmd,
       policyname,
       roles::text as untuk_role,
       coalesce(with_check, qual) as syarat
from pg_policies
where schemaname = 'public'
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
order by tablename, cmd, policyname;
