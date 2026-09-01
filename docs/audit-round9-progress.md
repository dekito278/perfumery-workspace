# Audit round 9 — modul per modul (2026-08-31)

Metode: baca kode penuh per modul (bukan sampling), lalu setiap temuan wajib menyebut **jalur yang bisa
dicapai** (route + aksi user, atau request langsung ke REST). Temuan yang tidak punya jalur nyata dibuang.

Cakupan: 15 modul. Yang sudah dihabiskan di round 7/8 (raw material, formula workbench, journal editor,
batch) hanya di-spot-check; fokus round ini ada di commerce, auth, infra, dan pola sistemik.

---

## RINGKASAN — 5 hal paling janggal

| # | Temuan | Modul | Severity |
|---|--------|-------|----------|
| 1 | `storefront_orders` masih `for insert with check (true)` → semua harga server-side bisa dilewati | Order | **CRITICAL** |
| 2 | `storefront_products` `for select using (true)` → draft + COGS + SKU + batch bocor ke publik | Katalog | **HIGH** |
| 3 | 30+ tempat: gagal tulis DB → diam-diam simpan ke localStorage lalu lapor sukses | Sistemik | **HIGH** |
| 4 | Tombol "Reset semua" menghapus SELURUH katalog permanen, dilabeli "reset ke default" | Katalog | **HIGH** |
| 5 | Ganti password menurunkan sesi aal2 → aal1 tanpa re-challenge (blocker migrasi step 2) | Auth | **HIGH** |

---

## MODUL 1 — Auth & kontrol akses

File: `src/contexts/AuthContext.jsx`, `src/components/ProtectedRoute.jsx`,
`src/pages/LoginPage.jsx`, `src/pages/AuthenticatorSetupPage.jsx`, `src/pages/ResetPasswordPage.jsx`,
`src/utils/apiAdminAuth.js`

### A-1 · HIGH — Ganti password menjatuhkan sesi dari aal2 ke aal1, diam-diam
`reauthenticateWithPassword()` (AuthContext.jsx:449) memanggil `signInWithPassword` untuk membuktikan
password lama. Itu **membuat sesi baru di aal1**. Listener `onAuthStateChange` menerima `SIGNED_IN` dengan
user id yang sama dan tanpa challenge aktif, jadi masuk ke fast-path (AuthContext.jsx:257) →
`finishLoading(nextSession, undefined, false)`: aplikasi tetap menganggap user terverifikasi, TOTP tidak
pernah ditanya lagi.

Dampak hari ini: kecil (is_admin() belum cek aal). Dampak setelah `20260819127000_is_admin_requires_aal2.sql`
diterapkan: **owner ganti password → semua query studio balik kosong tanpa pesan error** (RLS memfilter, bukan
melempar error). Ini persis jebakan yang round 8 hindari di remember-me.

Perbaikan: setelah `updatePassword` sukses, paksa `verifyMfaCode` ulang atau `signOut()` + minta login lagi.

### A-2 · MEDIUM — MFA challenge fail-open
`resolveMfaChallenge` (AuthContext.jsx:186) menangkap semua error `listFactors`/`challenge` dan
`return null` → artinya "tidak perlu MFA". Jadi gangguan jaringan saat reload halaman = user masuk studio
dengan sesi aal1 tanpa pernah ditanya kode. Gate server (RLS) masih menahan setelah migrasi aal2, tapi
gate klien-nya fail-open, bukan fail-closed.

### A-3 · LOW — `/reset-password` publik tanpa penjaga sesi
Route `/reset-password` (App.jsx:464) render form tanpa cek ada-tidaknya sesi recovery. Buka langsung →
isi password → `updatePassword` gagal dengan "Auth session missing", tanpa penjelasan. Setelah sukses pun
sesi tidak di-sign-out, hanya `navigate('/login')`.

### A-4 · LOW — `signup()` mati
`AuthContext.signup` tidak punya satu pun pemanggil. 40 baris kode auth yang tidak pernah jalan.

### A-5 · LOW — `copySecret` tidak pakai util yang sudah ada
`AuthenticatorSetupPage.jsx:114` panggil `navigator.clipboard.writeText` langsung tanpa try/catch,
padahal `utils/clipboard.js` sudah punya fallback `execCommand` untuk webview yang memblokir Clipboard API.
Di webview, tombol "copy manual key" gagal diam-diam (unhandled rejection).

### Yang sudah benar (dikonfirmasi ulang)
- Gate admin `VITE_ADMIN_EMAILS` fail-closed. Allowlist kosong = tidak ada admin.
- Remember-me MFA hanya menekan prompt kalau Supabase sendiri melaporkan aal2 (perbaikan round 8 utuh).
- `disableAuthenticator` wajib kode TOTP hidup.
- `assertAdmin` di endpoint serverless memakai `is_admin()` dengan token pemanggil, bukan service-role.

---

## MODUL 2 — Routing & device routing

File: `src/App.jsx`, `src/utils/deviceRouting.js`

### R-1 · MEDIUM — 5 route desktop tidak punya peta ke mobile
`DESKTOP_TO_MOBILE_PATHS` (deviceRouting.js:6) tidak memetakan:
- `/studio/site-images` → padahal `/mobile/studio/site-images` **ada** (App.jsx:713)
- `/studio/products/inventory`, `/studio/stories`, `/authenticator`, `/reset-password`
- `/track/:code` dan `/track` — padahal `publicTrackingService.buildPublicTrackingPath()`
  (publicTrackingService.js:52) **menghasilkan link `/track/:code`** yang dibagikan ke pembeli.

Jadi pembeli yang membuka link lacak-pesanan dari HP mendapat halaman desktop; hanya `/track-order/:code`
yang dipetakan.

### R-2 · LOW — Route `/articles` tidak ada
`/articles` terdaftar di `storefrontRoutePrefixes` (App.jsx:177) dan di peta mobile, tapi tidak ada
`<Route path="/articles">`. Yang ada cuma `/articles/:slug`. Untung belum ada yang menautkannya.

### Yang sudah benar
- Semua item menu AppShell & MobileBottomNavigation punya route padanan (dicek otomatis, 0 link mati).
- Semua target `navigate()`/`to=` statis punya route.

---

## MODUL 3 — Katalog produk & inventory

File: `src/services/productCatalogService.js` (989 baris), `src/pages/ProductListPage.jsx`

### P-1 · HIGH — Draft, COGS, dan data produksi terbaca publik
`storefront_products` punya policy `for select using (true)`
(`20260507123000_storefront_products.sql:65`). Klien membaca `select('*')` dengan anon key
(productCatalogService.js:735). Penyaring publish (`isProductDraft`, tag `"Studio draft"`) **hanya berjalan
di JavaScript**, tersebar di 10 halaman.

Konsekuensi, dengan satu request `GET /rest/v1/storefront_products?select=*` + anon key (anon key ada di
bundle JS):
- Semua produk **draft** (nama, harga, deskripsi, gambar) terbaca sebelum dirilis.
- Kolom `tags` membawa 16 tag internal: `COGS per bottle:`, `Batch ID:`, `Formula ID:`, `SKU:`,
  `Initial stock:`, `Dilution percent:`, `Loss percent:`, plus sampai 20 blob JSON
  `Stock correction:` berisi catatan + aktor + stok sebelum/sesudah.

Ini kejadian **keempat** dari pola yang sama (setelah `product_stories`, `journal_posts`, storage bucket):
saklar publish dihormati di JS saja. Perbaikan: view publik atau policy `using (not is_draft)` + pindahkan
tag internal ke kolom sendiri.

### P-2 · HIGH — "Reset semua" menghapus seluruh katalog, permanen
`ProductListPage.jsx:138` merender tombol **"Reset semua"**. Konfirmasinya berbunyi
*"Reset semua produk custom ke default?"* (baris 84). Yang sebenarnya dijalankan:
`delete from storefront_products where source = 'custom'` (productCatalogService.js:869).

`toDatabasePayload` menulis `source: 'custom'` **hardcoded** untuk setiap produk (baris 601), jadi
"produk custom" = seluruh katalog. Tidak ada "default" yang dipulihkan — `featuredProducts` hanya array
lokal untuk cek keunikan slug, tidak pernah di-insert kembali. Satu klik + satu OK = katalog hilang.

Ditambah: kalau delete-nya gagal, `catch` menulis localStorage kosong dan **tetap** menampilkan toast
"Produk custom direset".

### P-3 · HIGH — Simpan/hapus produk melaporkan sukses walau tidak masuk DB
`saveCustomProduct` (baris 842) menangkap semua error selain stale-write dan jatuh ke
`saveLocalCustomProduct(input)` — menulis localStorage, mengembalikan objek produk seolah tersimpan.
`deleteCustomProduct` (baris 861) sama. Penolakan RLS, token kadaluwarsa, dan constraint violation
semuanya tampil sebagai "berhasil".

Lebih jauh, `mergeLocalFallbackProducts` (baris 675) menyuntikkan produk `custom-*` lokal itu ke daftar
katalog **hanya di browser admin tersebut**, jadi admin melihat produk hantu yang dikiranya sudah live.

### P-4 · MEDIUM — Fallback deduksi stok sisi klien tidak mungkin berhasil
`deductInventoryForOrder` (baris 907): kalau RPC `storefront_deduct_inventory_for_order` gagal, ia
membaca-ubah-tulis baris produk dari klien via `saveCustomProduct`. Untuk pembeli anon, UPDATE
`storefront_products` ditolak RLS → jatuh lagi ke `saveLocalCustomProduct` → tulis ke localStorage
pembeli. Hasil akhir: stok tidak pernah berkurang, dan tidak ada satu pun error yang muncul.
Sejak `20260819123000_revoke_public_execute_on_guarded_rpcs` diterapkan, jalur ini justru jadi jalur normal
untuk pembeli anon.

### P-5 · MEDIUM — Data terstruktur disimpan di dalam string `tags`
16 prefix tag (`PRODUCT_BATCH_*`, `PRODUCT_RESTOCK_THRESHOLD_TAG_PREFIX`, `PRODUCT_STOCK_CORRECTION_*`)
diparse dari `tags` yang dipecah dengan `split(',')` (baris 74). Riwayat koreksi stok disimpan sebagai
JSON ter-`encodeURIComponent` di dalam elemen tag. Berjalan (koma di-escape jadi `%2C`), tapi ini menjadikan
riwayat audit stok tidak bisa di-query, terpotong pada 20 entri (baris 566), dan ikut bocor via P-1.

---

## MODUL 4 — Keranjang

File: `src/services/cartService.js`, `src/utils/cartReconcile.js`, `src/hooks/useCart.js`

### C-1 · MEDIUM — Stok 0 diperlakukan sebagai "tanpa batas"
Pola `maxStock > 0 ? Math.min(...) : <tanpa batas>` diulang 3 kali:
cartService.js:101, :116, :125, dan cartReconcile.js:37. Untuk produk yang benar-benar habis
(`stock = 0`), cabang else yang jalan → pembeli bisa menaruh 99 botol produk kosong ke keranjang dan
melangkah sampai checkout. Yang menahan hanyalah RPC deduksi di ujung.

### C-2 · MEDIUM — Produk yang dihapus/di-draft tetap bertahan di keranjang dengan harga lama
`cartReconcile.js:15`: `if (!product) return item` — baris keranjang yang produknya sudah hilang dari
katalog dikembalikan apa adanya, lengkap dengan harga yang di-snapshot saat add-to-cart. Tidak ada
penanda "produk tidak tersedia". Baris itu ikut ke checkout dan baru ditolak endpoint dengan
`Unknown product: <slug>` — pesan mentah, bukan pesan yang bisa dimengerti pembeli.

### C-3 · LOW — Katalog gagal dimuat = harga keranjang beku
`cartReconcile.js:9`: `if (!catalog.length) return items`. Kalau fetch katalog gagal (bukan hanya masih
loading), rekonsiliasi dilewati total dan keranjang memakai harga lama. Server tetap memberi harga
otoritatif, jadi pembeli hanya melihat angka yang salah sampai halaman payment.

---

## MODUL 5 — Voucher

File: `src/utils/voucherValidation.js`, `src/services/voucherService.js`

### V-1 · MEDIUM — Semua kode voucher bisa dienumerasi publik
`storefront_vouchers` sengaja mempertahankan public SELECT
(`20260715121000_admin_write_rls_lockdown.sql:46`, komentar: "needed for checkout voucher validation").
Satu `GET /rest/v1/storefront_vouchers?select=*` dengan anon key mengembalikan **setiap kode, nilai diskon,
kuota, dan tanggal expiry** — termasuk voucher yang belum dirilis dan yang aktif tanpa batas kuota.

Validasi otoritatif sudah pindah ke `api/orders/create.js` (pakai service role), jadi read publik ini
sekarang hanya melayani preview pra-checkout. Bisa diganti RPC yang menerima satu kode dan hanya
mengembalikan verdict.

### V-2 · MEDIUM — Pemakaian voucher tidak dicatat server-side
`api/orders/create.js:283` sengaja tidak memanggil `storefront_record_voucher_usage`, mengandalkan halaman
memanggil `recordVoucherUsageForOrder` setelahnya. Kalau tab ditutup / jaringan putus di antara keduanya,
order tetap dapat diskon tapi kuota tidak pernah terpakai → voucher bisa dipakai melebihi limitnya.

### V-3 · LOW — `resetVouchers()` mati
`voucherService.js:257` menghapus semua voucher (`delete().neq('code','')`). Tidak ada pemanggil.

---

## MODUL 6 — Checkout & pembuatan order

File: `src/hooks/useCheckoutFlow.js`, `apps/web/api/orders/create.js`, `src/services/orderService.js`

### O-1b · HIGH — Jalur pembuatan order KETIGA yang tidak lewat endpoint (ditemukan saat gelombang 1)
`CustomerPortalPage.createReorderPayment()` — tombol "Pesan lagi" di portal pelanggan — menyusun item dan
subtotal di browser lalu memanggil `orderService.createOrder()` langsung
([CustomerPortalPage.jsx:1342](../apps/web/src/pages/CustomerPortalPage.jsx:1342)). Checklist di
`07_orders_anon_insert_revoke.sql` hanya menyebut dua jalur (cart + bespoke), jadi:

1. Reorder hari ini **client-priced** — sama rentannya dengan jalur lama, meski `repriceReorderItem`
   sudah mengambil harga hidup dari katalog (yang mengambil harga dari klien tetap `createOrder`).
2. Mencabut anon INSERT sekarang akan **mematikan fitur reorder** untuk semua pelanggan.

Reorder juga tidak punya `destinationId`/courier/service — ia memakai ulang ongkir dari order sumber —
jadi tidak bisa langsung diarahkan ke `/api/orders/create`, yang akan menghitung ongkir 0 tanpa destinasi.
**Ini prasyarat O-1.**

### O-1 · CRITICAL — Penetapan harga otoritatif masih bisa dilewati sepenuhnya
`storefront_orders` masih memakai policy `for insert with check (true)`
(`20260507103000_storefront_orders.sql:51-54`). Skrip pencabutannya ada, tapi disimpan **di luar**
folder migrasi: `docs/server-side-drafts/07_orders_anon_insert_revoke.sql`.

Artinya siapa pun, dengan anon key dari bundle JS, bisa:
```
POST /rest/v1/storefront_orders
{"order_number":"...","subtotal":1,"items":[...],"status":"pending_payment", ...}
```
lalu memakai order itu di `/api/doku/checkout` — endpoint itu jujur mengambil `subtotal` dari baris DB,
jadi DOKU akan menagih Rp 1.

Seluruh `api/orders/create.js` (280 baris rekomputasi harga, ongkir, dan voucher) benar dan berjalan
sebagai jalur normal (`authoritativeOrdersEnabled()` default true, orderService.js:1217), tapi ia baru
menjadi *penegakan* setelah policy insert anon dicabut. Prasyarat 1–3 di file draft itu sudah terpenuhi
sejak 2026-07-28.

### O-2 · MEDIUM — Endpoint pembuatan order tanpa auth, tanpa rate limit, langsung memesan stok
`POST /api/orders/create` terbuka. Setiap panggilan yang lolos akan menyisipkan order dan memanggil
`storefront_deduct_inventory_for_order` (create.js:257). Sweep pembebasan stok berjalan **sekali sehari**
(`vercel.json` cron `0 0 * * *`) dengan TTL 24 jam. Satu skrip bisa mengunci seluruh stok katalog hingga
~48 jam. Tidak ada captcha, rate limit, atau pembatasan origin.

### O-3 · MEDIUM — Order yang gagal tetap menaikkan `order_count` pelanggan
`create.js:207` memanggil `storefront_upsert_customer` dengan `p_increment_order: true` **sebelum**
insert order dan sebelum reservasi stok. Kalau stok kurang, order dibatalkan (baris 262) tapi penghitung
order pelanggan sudah naik dan tidak pernah dikembalikan.

### O-4 · MEDIUM — `checkoutDraft` dan `notes` masuk dari klien tanpa batas panjang
`create.js:245,247` menyalin `input.checkoutDraft` dan `input.notes` apa adanya ke baris DB. Tidak ada
batas ukuran.

### O-5 · LOW — `baseUrl` diambil dari header `Host`
`create.js:171`: `const baseUrl = \`https://${req.headers.host}\`` lalu dipakai untuk memanggil
`/api/shipping/rates`. Vercel merutekan berdasarkan Host, jadi eksploitasinya sempit, tapi harga ongkir
otoritatif seharusnya tidak bergantung pada header yang dikirim klien. Pakai
`process.env.VERCEL_URL`/env eksplisit.

### O-6 · LOW — Pesan error internal bocor
`create.js:302` mengembalikan `error.message` mentah, yang bisa berisi
`Supabase read failed: <isi respons PostgREST>`.

### O-7 · MEDIUM — Tulisan sisi-pembeli ke `storefront_orders` tidak berefek
Jalur transfer manual di `useCheckoutFlow.js:549` memanggil `updateOrderPaymentStatus(...)` dari browser
pembeli anon. UPDATE `storefront_orders` admin-only; PostgREST membalas 200 dengan 0 baris terpengaruh,
bukan error. Jadi `payment_reference` dan `payment_response` (detail bank) tidak pernah tersimpan, dan
tidak ada yang menyadarinya. Persis masalah yang sudah diperbaiki untuk jalur DOKU (dicatat di
`api/doku/checkout.js`) tapi belum untuk jalur manual.

---

## MODUL 7 — Pembayaran DOKU

File: `apps/web/api/doku/{checkout,notification,status,qris}.js`, `src/utils/dokuOrderGuards.js`

### D-1 · MEDIUM — `/api/doku/status` terbuka dan menulis ke DB tanpa batas
Endpoint ini tanpa auth (GET/POST). Setiap panggilan: (a) memanggil API DOKU dengan kredensial merchant,
(b) menulis satu baris ke `storefront_doku_payment_logs` dengan service role — termasuk untuk nomor order
yang tidak ada (status.js:318 di cabang error). Satu skrip bisa membanjiri tabel log dan menghabiskan
kuota API DOKU secara gratis.

### D-2 · LOW — Verifikasi jumlah bayar fail-open
`dokuOrderGuards.js:33`: `if (expected > 0 && paid > 0 && paid < expected)`. Kalau DOKU tidak mengirim
`amount` (paid = 0), pengecekan dilewati dan order ditandai lunas tanpa verifikasi nominal.

### D-3 · LOW — Webhook tidak mengecek kesegaran timestamp
`notification.js` memverifikasi HMAC dengan benar (timing-safe) tapi tidak pernah memeriksa
`Request-Timestamp` terhadap waktu sekarang. Notifikasi lama yang valid bisa diputar ulang; efeknya
diredam oleh guard transisi (`already_paid` / `order_closed`), jadi dampaknya terbatas.

### Yang sudah benar
- `api/doku/checkout.js` mengambil nominal dari `storefront_orders.subtotal` sisi server, menolak order
  yang sudah lunas, dan URL notifikasi hanya dari env server.
- Guard transisi dipakai bersama oleh webhook dan poller (perbaikan round 7 utuh).
- QRIS tetap dimatikan, dengan alasan tertulis lengkap di `cartService.js:24`.

---

## MODUL 8 — Ongkir & promo ongkir

File: `apps/web/api/shipping/{rates,destinations}.js`, `src/utils/shippingPromotion.js`

### S-1 · MEDIUM — Deteksi "Pulau Jawa" pakai substring, bukan batas kata
`shippingPromotion.js:131`: `searchText.includes(keyword)` pada gabungan label + kota + kecamatan +
provinsi, dengan kata kunci termasuk `'solo'` (baris 26) dan `'kediri'` (baris 33).

Akibatnya:
- **Solok, Sumatera Barat** → `'solok'.includes('solo')` → dianggap Jawa → **gratis ongkir**.
- **Kediri, Lombok Barat (NTB)** → dianggap Jawa → gratis ongkir.

Ini kebocoran uang langsung setiap kali promo `FREE_JAVA*` aktif. Perbaikan: cocokkan per token
(`searchText.split(' ').includes(keyword)`) atau andalkan `JAVA_PROVINCES` saja.

### S-2 · MEDIUM — Dua proxy RajaOngkir tanpa auth dan tanpa rate limit
`/api/shipping/destinations` (GET) dan `/api/shipping/rates` (POST) meneruskan request ke RajaOngkir
memakai `RAJAONGKIR_API_KEY` milik server, tanpa autentikasi apa pun. Kuota API berbayar bisa dihabiskan
siapa saja. (Sama kelasnya dengan D-1 — total **4 endpoint** terbuka yang memproksi API pihak ketiga
berbayar.)

### S-3 · LOW — Preview promo salah tanggal
`getShippingPromotionPreview` memformat `startsAt`/`endsAt` dengan `new Date(value)` langsung, bukan lewat
`getDateTime`. Nilai date-only diparse sebagai UTC → tampil mundur satu hari di WIB. Perhitungan
kelayakannya sendiri sudah benar (pakai `getDateTime`), hanya teksnya yang salah.

---

## MODUL 9 — Pelanggan & portal

File: `src/services/customerService.js`, `src/services/publicTrackingService.js`,
`src/pages/CustomerPortalPage.jsx`

### CU-1 · MEDIUM — Kode pelanggan palsu bisa ditunjukkan ke pembeli
`saveCustomer` (customerService.js:398) jatuh ke `saveLocalCustomer` bila RPC gagal, dan
`createLocalCustomerCode()` (baris 8) mengarang `SOLI` + 5 digit `Math.random()`. Kode itu ditampilkan ke
pembeli sebagai kode pelanggan mereka, padahal tidak ada di DB — dan bisa bertabrakan dengan kode asli
milik orang lain. Jalur ini hanya aktif di path `createOrder` legacy (non-otoritatif) dan dari studio.

### CU-2 · LOW — Portal jatuh ke cache localStorage
`getCustomerPortalByCode` (baris 263) menyajikan data pelanggan + order dari localStorage bila RPC gagal.
Isinya hanya apa yang browser itu sendiri tulis, tapi di perangkat bersama ini menampilkan data pesanan
sebelumnya.

### Yang sudah benar
- Semua lookup pelanggan lewat RPC SECURITY DEFINER dengan gate pertanyaan keamanan.
- Tracking publik memakai nama yang sudah dimask server-side.

---

## MODUL 10 — Cron, infra, header

File: `apps/web/api/orders/expire-reservations.js`, `apps/web/vercel.json`

### I-1 · MEDIUM — Cron sweep tanpa proteksi di luar production
`expire-reservations.js:17-22`: kalau `CRON_SECRET` kosong, endpoint hanya menolak bila
`VERCEL_ENV === 'production'`. Di preview deployment (yang biasanya memakai env Supabase yang sama),
endpoint ini **terbuka** — siapa pun yang menemukan URL preview bisa membatalkan massal semua order yang
belum dibayar di database produksi.

### I-2 · LOW — CSP mengizinkan `script-src 'unsafe-inline'`
`vercel.json` header CSP. Selebihnya ketat (`object-src 'none'`, `frame-ancestors 'none'`,
`connect-src` terkunci ke Supabase + DOKU), tapi `'unsafe-inline'` pada script menghapus sebagian besar
manfaat CSP terhadap XSS.

### I-3 · INFO — Hitungan fungsi serverless: 11 dari batas Hobby 12
`find apps/web/api -name '*.js' ! -name '_*' | wc -l` → 11. Satu slot tersisa. (Dua kali sudah kena
plafon ini menurut catatan round 8.)

### Yang sudah benar
- Rewrite `/api/(.*)` → `/api/not-found` berjalan *setelah* pencocokan filesystem, jadi endpoint asli
  tetap hidup dan path API yang tidak ada memberi 404 bersih. Sama untuk `/assets/(.*)`.
- Sweep sudah menghormati bukti transfer (`payment_proof_status`) dan tidak membatalkan order tanpa
  jendela pembayaran eksplisit.

---

## MODUL 11 — Storage (bukti transfer, gambar)

File: `src/services/{paymentProofStorageService,siteImageStorageService,productImageStorageService}.js`

Tidak ada temuan baru. Validasi tipe + ukuran ada di ketiganya, bucket bukti transfer privat dengan signed
URL 10 menit, dan pembersihan file format lain saat upload site image sudah benar. Keputusan round 8
tentang kepemilikan bukti transfer tetap berlaku.

---

## MODUL 12 — Konten publik (journal, story)

Sanitasi link/gambar markdown benar (`normalizeHref` mengubah `javascript:`/`data:` jadi `#`,
`JournalMarkdownContent.jsx:31`). Render pakai elemen React, bukan `innerHTML`.

**Masih menunggu apply manual (dari round 8):**
- `20260819124000_journal_and_story_public_access_lockdown.sql` — **mendesak**, ini lubang RLS-nya
- `20260819126000_journal_keep_published_at_on_unpublish.sql`
- `20260819127000_is_admin_requires_aal2.sql` — **jangan apply sebelum A-1 di atas diperbaiki**

---

## MODUL 13 — POLA SISTEMIK (bukan satu file)

### X-1 · HIGH — "Gagal tulis DB → simpan lokal → lapor sukses" ada di 30+ tempat
Hitungan per service (`console.warn` + fallback localStorage + return sukses):

| Service | jumlah |
|---|---|
| `orderService.js` | 21 |
| `customerService.js` | 7 |
| `productCatalogService.js` | 6 |
| `bespokeSettingsService.js` | 6 |
| `storefrontCategoryService.js` | 3 |
| `shippingPromotionService.js` | 3 |
| sisanya (batches, voucher, journal, story, tracking, cart) | 8 |

Contoh terparah — `updateOrderPaymentStatus` (orderService.js:1793): admin menekan "tandai lunas", DB
menolak, fungsi menangkap error, menulis status `paid` ke localStorage, **tidak melempar**. Pemanggil
langsung menampilkan toast sukses. Order tetap belum lunas di DB, dan perangkat lain melihat "unpaid".

Dua varian yang sama-sama diam:
1. **Error ditangkap** → tulis lokal → lapor sukses (di atas).
2. **RLS menolak** → PostgREST balas 200 dengan 0 baris → `error === null` → jalur sukses jalan tanpa
   apa pun berubah, bahkan fallback lokal pun tidak. Ini yang menimpa O-7.

Round 8 menemukan bentuk yang sama di `saveBatch` dan modal material. Perbaikan minimal yang menutup
keduanya sekaligus: pakai `.select()` pada setiap write dan perlakukan "0 baris" sebagai kegagalan;
buang fallback localStorage dari semua jalur tulis (biarkan hanya di jalur baca sebagai cache).

---

## MODUL 14-15 — Spot check (sudah dihabiskan round 7/8)

- **Production costing** (`utils/productionCosting.js`): matematikanya rapi. Margin di-cap 99% agar tidak
  divide-by-zero, `flat` = `min(cost, amount)` benar, `kg`→ml pakai densitas 1.0 dengan komentar
  `ponytail:` yang jujur. Tidak ada temuan.
- **Tanggal**: nol pemakaian `toISOString().slice(0,10)` di luar komentar `localDay.js` — perbaikan
  timezone round 7 bertahan.
- **Ops health / dashboard**: `checkDokuHealth` diam-diam membatasi pengecekan pada 5 order teratas
  (`opsHealthService.js:57`) tanpa memberi tahu; hanya health check, dampak rendah.

---

## STATUS

- **Gelombang 1 (kode, selesai)** — A-1, P-2, S-1, C-1, R-1. Commit `3272dfd`.
- **Gelombang 1b (kode, selesai)** — O-1b: reorder portal lewat keranjang + checkout normal.
- **Gelombang 2 (SQL, siap diterapkan)** — urutan, verifikasi, dan rollback ada di
  [audit-round9-runbook.md](audit-round9-runbook.md).
- **Gelombang 3** — belum dikerjakan; daftarnya di akhir runbook.

## URUTAN PENGERJAAN YANG DISARANKAN

1. **O-1b lalu O-1** — perbaiki dulu jalur reorder, baru jadikan `07_orders_anon_insert_revoke.sql`
   migrasi bertanggal dan apply. Prasyaratnya **belum** terpenuhi: checklist Juli melewatkan jalur ketiga.
2. **A-1** — paksa TOTP ulang setelah ganti password, **sebelum** menerapkan migrasi aal2.
3. **P-1a** (sudah ditulis: `20260901120000_storefront_products_hide_drafts_from_public.sql`) — sembunyikan
   baris draft dari anon. **P-1b** — pindahkan 16 tag internal (COGS, batch, SKU) keluar dari `tags` ke
   kolom khusus admin; RLS memfilter baris, bukan kolom, jadi tag internal pada produk terbit masih bocor
   sampai ini dikerjakan.
4. **P-2** — hapus atau ganti label tombol "Reset semua".
5. **S-1** — cocokkan kata kunci Jawa per token, bukan substring.
6. **X-1** — mulai dari `orderService` jalur tulis: `.select()` + gagal kalau 0 baris, buang fallback lokal.
7. Sisanya (P-3, O-2, O-7, D-1, S-2, V-1, V-2, I-1, R-1) sesuai prioritas.
