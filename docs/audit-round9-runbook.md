# Audit round 9 — runbook penerapan

Urutan ini mengikat. Setiap langkah punya cara verifikasi dan cara mundur.
Semua SQL dijalankan manual di **Supabase SQL editor** — `supabase db push` tidak dipakai di sini.

---

## Langkah 0 — deploy kode (gelombang 1 + rework reorder)

Commit: `3272dfd`, `9781fc0`, dan rework "Pesan lagi".

Setelah live, cek cepat:
- [ ] Login studio masih normal.
- [ ] Ganti password di `/authenticator` → otomatis logout → login lagi **diminta kode authenticator**.
- [ ] Portal pelanggan → "Pesan lagi" → item masuk keranjang → checkout terisi nama/alamat → order jadi.
- [ ] Vercel log: `POST /api/orders/create 200` untuk order reorder tadi.

Kalau reorder bermasalah, hentikan di sini. Langkah 3 bergantung penuh padanya.

---

## Langkah 1 — RLS journal & product stories (nunggak dari round 8, paling mendesak)

```sql
-- isi file supabase/migrations/20260819124000_journal_and_story_public_access_lockdown.sql
```

Ini menutup lubang aktif: pemilik akun pelanggan mana pun bisa menerbitkan artikel di storefront.

Verifikasi:
- [ ] Login sebagai pelanggan biasa → `insert into journal_posts (...)` ditolak.
- [ ] `/journal` dan `/articles/<slug>` masih tampil normal.
- [ ] Studio journal masih bisa buat/edit/hapus artikel.

Mundur: ada di header file itu.

Menyusul, opsional, kalau langkah ini aman:
```sql
-- 20260819126000_journal_keep_published_at_on_unpublish.sql
```

---

## Langkah 2 — Sembunyikan produk draft dari publik

```sql
-- supabase/migrations/20260901120000_storefront_products_hide_drafts_from_public.sql
```

Sudah dibungkus transaksi, jadi kalau `create policy` gagal, `drop policy` ikut batal — tabel tidak
pernah kehilangan policy SELECT.

Verifikasi:
- [ ] Buka storefront dalam mode incognito (logout): produk draft **tidak** muncul.
- [ ] `curl 'https://<project>.supabase.co/rest/v1/storefront_products?select=slug' -H 'apikey: <anon>'`
      → slug produk draft tidak ada di hasil.
- [ ] Studio `/studio/products`: produk draft **masih** tampil dengan badge "Draft".
- [ ] Katalog publik masih lengkap (jumlah produk terbit tidak berubah).

Mundur ada di header file.

> Belum tertutup di langkah ini: tag internal (`COGS per bottle:`, `Batch ID:`, `SKU:`, riwayat koreksi
> stok) masih ikut pada produk **terbit**, karena RLS memfilter baris bukan kolom. Itu P-1b — perlu
> memindahkan tag internal ke kolom sendiri lebih dulu.

---

## Langkah 3 — Cabut anon INSERT pada `storefront_orders` (yang CRITICAL)

**Prasyarat: langkah 0 hijau, termasuk reorder.** Cek ulang sebelum menekan run:

```bash
grep -rn 'createOrder(' apps/web/src | grep -v 'createOrderNumber\|createOrderAuditLog'
```
Harus hanya menyisakan dua escape hatch yang di-gate `authoritativeOrdersEnabled()`:
`useCheckoutFlow.js` dan `orderService.createBespokeRequest`.

Dan pastikan di Vercel **`VITE_AUTHORITATIVE_ORDERS` tidak di-set `'false'`**.

```sql
-- isi docs/server-side-drafts/07_orders_anon_insert_revoke.sql
drop policy if exists "storefront orders public insert" on public.storefront_orders;
```

Verifikasi, berurutan:
- [ ] Insert langsung sebagai anon **ditolak**:
      `curl -X POST '.../rest/v1/storefront_orders' -H 'apikey: <anon>' -d '{"order_number":"TEST","subtotal":1,...}'`
- [ ] Checkout cart normal → order jadi, `subtotal` di DB sama dengan yang dilihat pembeli.
- [ ] Checkout bespoke → order jadi.
- [ ] Reorder dari portal → order jadi.
- [ ] Stok berkurang untuk order katalog; voucher tercatat sekali.

Mundur (satu baris, di header file yang sama):
```sql
create policy "storefront orders public insert" on public.storefront_orders for insert with check (true);
```

---

## Langkah 4 — `is_admin()` wajib aal2

**Prasyarat: langkah 0 hijau, khususnya ganti-password → logout → login dengan TOTP.**
Tanpa itu, ganti password akan membuat semua data studio hilang diam-diam.

```sql
-- supabase/migrations/20260819127000_is_admin_requires_aal2.sql
```

Verifikasi:
- [ ] Login studio dengan TOTP → semua data tampil.
- [ ] Login di browser yang pernah pakai "remember this device" → tetap diminta TOTP, data tampil.
- [ ] Ganti password → logout → login ulang → data tampil.

Mundur ada di file itu. Kalau terkunci: SQL editor Supabase terhubung sebagai pemilik tabel dan
melewati RLS, jadi rollback selalu bisa dijalankan.

**Gejala kalau sesi masih aal1 (kejadian 2026-09-07, di HP):** studio terbuka, formula/material tampil
(policy-nya `auth.uid() = user_id`), tapi Order **0 aktif / 0 total**, bukti 0, customer kosong — semua tabel
yang dijaga `is_admin()` menjawab 200 dengan nol baris, bukan error. Sejak fix ini, `AdminSessionNotice`
(dirender di `AppShell` dan `MobileAppShell`) menanyakan `getAuthenticatorAssuranceLevel()` dan memasang
panel merah "Data admin tidak akan tampil" dengan tombol logout/daftar authenticator. Obatnya tetap sama:
logout → login ulang → masukkan kode TOTP.

---

## ✅ SELESAI (2026-09-06): `CRON_SECRET` terpasang, sweep terverifikasi

Dipasang owner lewat dashboard akun `aderizki68-1969s-projects` (tipe Secret, Production), lalu redeploy.
Verifikasi dari luar:

```
tanpa header  → {"ok":false,"message":"Unauthorized"}
dengan Bearer → 200 {"ok":true,"checked":6,"expired":[],"errors":[],"ttlHours":24}
```

Enam order berstatus bayar aktif diperiksa, tidak ada yang kedaluwarsa, tidak ada yang dibatalkan.
Cron `0 0 * * *` UTC (07:00 WIB) sekarang benar-benar berjalan. Riwayat temuannya di bawah dibiarkan
apa adanya sebagai catatan.

Catatan infra yang ditemukan sepanjang jalan: ada **dua** project Vercel untuk repo ini. Yang melayani
domain adalah `aderizki68-1969s-projects/perfumery-workspace`. Yang di team
`tech-team-indonesia-s-projects` adalah duplikat mati (nol domain, build 0 ms, tanpa serverless function)
— koneksi Git-nya sudah diputus supaya berhenti ikut build tiap push; `vercel git connect` untuk membalik.

## (riwayat) TEMUAN SAAT VERIFIKASI DEPLOY: sweep reservasi TIDAK PERNAH JALAN

`GET /api/orders/expire-reservations` di produksi menjawab:

```
{"ok":false,"message":"CRON_SECRET is not configured; refusing to sweep"}
```

Cabang itu menyala **murni karena `process.env.CRON_SECRET` kosong**, tidak peduli requestnya bawa
header apa. Artinya `CRON_SECRET` tidak pernah di-set di Vercel — dan kode LAMA pun sudah menolak
(`VERCEL_ENV === 'production'` → 401). Jadi cron harian di `vercel.json` sudah gagal sejak dipasang.

**Akibatnya, selama ini:** order yang lewat batas bayar tidak pernah dibatalkan, **stok yang direservasi
tidak pernah dilepas**, kuota voucher yang dipesan tidak pernah dikembalikan, dan order menumpuk di
"Menunggu bayar". Ini bukan disebabkan perubahan round 9 — perubahan itu hanya membuat pesannya cukup
spesifik untuk membedakan "secret tidak ada" dari "secret salah".

**Perbaikan (di Vercel, bukan di kode):**
1. Project Settings → Environment Variables → tambah `CRON_SECRET` dengan nilai acak panjang, untuk
   **Production dan Preview**.
2. Redeploy. Vercel mengirimkannya sendiri sebagai `Authorization: Bearer <CRON_SECRET>` pada setiap
   pemanggilan cron terjadwal.
3. Verifikasi: log Vercel untuk `/api/orders/expire-reservations` harus 200 (bukan 401) pada run
   berikutnya, dan `expired` di responsnya menunjukkan order yang benar-benar dibersihkan.
4. Sekali jalan pertama kemungkinan membatalkan **banyak** order lama sekaligus dan melepas stoknya.
   Cek dulu daftar order "Menunggu bayar" sebelum menyalakannya supaya tidak kaget.

---

## Gelombang 3 — status

### Selesai

1. **X-1 SELESAI di semua service.** `orderService` (commit `966a8a1`), lalu `shippingPromotionService`,
   `storefrontCategoryService`, `bespokeSettingsService`, `productCatalogService` (`6be7713`) dan
   `customerService` (`33dbadb`). Setiap tulisan yang bisa ditolak RLS sekarang `.select()` baris
   terdampak dan gagal lantang; semua mirror localStorage di jalur tulis dihapus. Dijaga
   `orderWrites.selfcheck.mjs`.
2. **O-7 SELESAI** (`9af4584`) — sekaligus menutup regresi yang dibuat oleh X-1 sendiri: tujuh tulisan
   sisi-pembeli yang dulu diam kini melempar dan mematikan checkout. Semuanya duplikasi dari yang sudah
   ditulis server, jadi dihapus.
3. **P-3 SELESAI** (`6be7713`) — plus `mergeLocalFallbackProducts` dihapus, yang membuat produk hantu
   sembuh sendiri pada fetch berhasil pertama.
4. **CU-1 SELESAI** (`33dbadb`) — generator kode `SOLI#####` palsu dihapus beserta seluruh cache
   pelanggan di localStorage.
5. **I-1 SELESAI** — `CRON_SECRET` wajib di semua environment, tanpa pengecualian.
6. **O-2 sebagian** — `/api/doku/status` menolak order tak dikenal sebelum memanggil DOKU dan menulis log;
   `/api/orders/create` membatasi 50 baris item dan 100 qty per baris.

### Diperiksa sendiri setelah workflow review gagal

Workflow verifikasi adversarial atas diff gelombang 3 gagal — kelima agennya kena batas sesi akun, nol
temuan. Penggantinya pemeriksaan manual terarah; hasilnya:

- **Referensi menggantung:** nol. Semua yang dihapus (`saveLocalCustomProduct`, `writeStoredProducts`,
  `mergeLocalFallbackProducts`, seluruh cache pelanggan) tidak punya pemanggil tersisa.
- **Klaim 22P02 benar:** `storefront_products.id` dan `storefront_product_categories.id` dua-duanya
  `uuid primary key`, jadi cabang id lokal memang perlu.
- **Satu celah nyata ditemukan dan ditutup:** `api/doku/checkout.js` menulis seluruh sesi DOKU tapi
  **tidak** `payment_status`. Tulisan klien yang saya hapus dulu yang men-set `'pending'` — dan itu tidak
  pernah berhasil untuk pembeli, jadi order DOKU selalu tertinggal di `'unpaid'`. Sekarang penulis sesinya
  yang memilikinya. Bukan regresi, tapi niatnya jadi tidak bertuan kalau dibiarkan.
- **Jalur pembeli vs RPC tercabut:** aman. `storefront_restore_inventory_for_order` hanya dicapai lewat
  fungsi admin, dan `releaseVoucherUsageForOrder` memang dirancang tidak pernah melempar.

**Yang tetap belum terverifikasi mata: seluruh jalur tulis admin.** Butuh login studio. Lihat daftar uji
di bawah.

### Uji setelah deploy (butuh login studio)

- [ ] Tandai satu order lunas → **refresh** → status bertahan.
- [ ] Approve satu bukti transfer → refresh → tetap approved.
- [ ] Ubah status pengiriman + isi resi → refresh → bertahan.
- [ ] Simpan produk, lalu hapus satu produk uji → keduanya benar-benar berubah di DB.
- [ ] Simpan kategori baru, lalu hapus → cek tombol hapus **tidak** muncul untuk 7 scent family bawaan.
- [ ] Nyalakan lalu matikan promo ongkir → checkout benar-benar ikut berubah.
- [ ] Hapus satu opsi bespoke → hilang juga di form bespoke publik.
- [ ] Buka `/studio/customers` → daftar tampil (kalau gagal, sekarang muncul pesan merah, bukan "Belum ada customer").
- [ ] **Cek cron:** pastikan `CRON_SECRET` ada di Vercel. Kalau tidak ada, sweep sudah 401 sejak dulu dan
      stok order kedaluwarsa tidak pernah dilepas — sekarang gagalnya sama, tapi di semua environment.

### Ditunda, dengan alasan

**P-1b — pindahkan tag internal keluar dari `tags`. DITUNDA.**
Bentuk yang ditulis di temuan tidak bisa dijalankan: admin dan pelanggan yang login Google sama-sama
memakai role `authenticated`, jadi tidak ada GRANT kolom, view, atau policy yang bisa membuat satu kolom
"admin-only" pada baris yang publik. Satu-satunya bentuk yang benar adalah membalik arahnya — policy
SELECT tabel jadi `is_admin()` saja, lalu view publik terpisah yang menyaring baris draft dan membuang
tag internal — dan itu mengubah jalur baca utama storefront. Pemeriksaan adversarial menemukan enam
konsumen tag yang tidak masuk rencana, termasuk `data/publicStorefront.js` (jalur publik),
`ProductInventoryPage`, dan gate visibilitas seksi "Sumber batch" di form produk. Perlu dikerjakan
sendiri, dengan verifikasi di browser, bukan disisipkan di akhir gelombang.
Sementara ini yang bocor pada produk **terbit**: `COGS per bottle:`, `Batch ID:`, `SKU:`,
`Initial stock:`, `Restock threshold:`, dan sampai 20 blob riwayat koreksi stok.

**V-1 / V-2 — voucher. DITUNDA, ada jebakan.**
V-2 (catat pemakaian voucher di `api/orders/create.js`) terdengar sepele tapi memindahkan reservasi kuota
ke saat order dibuat. Hari ini bespoke dan DOKU mencatat pemakaian **setelah** `createDokuCheckout`
berhasil, jadi kegagalan DOKU tidak memakan kuota. Kalau dipindah ke create, kegagalan DOKU akan menghanguskan
kuota secara permanen — karena pelepasannya (`storefront_release_voucher_usage`) dicabut dari `anon`, jadi
pembatalan dari browser tidak bisa mengembalikannya. Urutan yang benar: pindahkan **pelepasan** ke server
lebih dulu, baru pencatatannya. V-1 (RPC lookup + cabut SELECT publik) aman dikerjakan sendiri, tapi
sebaiknya satu paket dengan V-2 supaya `voucherService` tidak diaduk dua kali.

**Rate limiting endpoint terbuka — DITUNDA, sebagian besar teater.**
Di Vercel Hobby tidak ada Redis dan instance-nya berumur pendek serta tidak berbagi memori, jadi penghitung
in-memory praktis tidak berguna. Yang benar-benar bekerja adalah tabel Supabase + RPC, dengan biaya satu
round trip di setiap request checkout. Dua mitigasi termurah sudah diambil (lihat nomor 6). Sisanya —
terutama proteksi `/api/orders/create` dari pemesanan stok massal — perlu keputusan: tabel rate limit,
captcha, atau menerima risikonya. `applyShippingPromotionToRates` juga masih memanggil
`/api/shipping/rates` lewat `req.headers.host`; hindari header caching di sini, tombol health check admin
(`opsHealthService.checkShippingHealth`) memakai endpoint yang sama sebagai probe.

### Belum tersentuh

- **A-2** MFA challenge fail-open, **A-3/A-4/A-5** (kecil).
- **R-2** route `/articles` tidak ada.
- **P-4/P-5** fallback deduksi stok klien dan data terstruktur di dalam `tags`.
- **D-2/D-3** verifikasi nominal DOKU fail-open, webhook tanpa cek kesegaran timestamp.
- **S-3** preview promo salah tanggal.
- **I-2** CSP `script-src 'unsafe-inline'`.
