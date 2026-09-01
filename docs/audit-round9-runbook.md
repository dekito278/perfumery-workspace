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

---

## Sisa yang belum dikerjakan (gelombang 3)

Urut dari yang paling berdampak:

1. **X-1 — `orderService` SELESAI** (commit `966a8a1`). Semua write lewat `updateOrderRow()` yang
   `.select()` dan melempar kalau 0 baris; 11 mirror localStorage dihapus; 5 call site yang tadinya tanpa
   penanganan error ditutup. Dijaga `orderWrites.selfcheck.mjs` di tingkat source.
   **Masih tersisa di service lain** (9 titik): `bespokeSettingsService` (6),
   `storefrontCategoryService` (3), `shippingPromotionService` (3), `customerService` (7 — lihat CU-1),
   plus `productCatalogService` (lihat P-3 di bawah).
2. **P-1b** — pindahkan 16 tag internal keluar dari `tags`.
3. **P-3** — `saveCustomProduct` / `deleteCustomProduct` berhenti melapor sukses palsu.
4. **O-2, D-1, S-2** — rate limit / auth untuk 4 endpoint terbuka yang memproksi API berbayar dan
   memesan stok.
5. **V-1, V-2** — tutup enumerasi voucher, catat pemakaian voucher server-side.
6. **I-1** — `CRON_SECRET` wajib juga di preview, bukan hanya production.
7. **O-7** — jalur transfer manual masih menulis ke `storefront_orders` dari browser pembeli, yang
   selalu difilter RLS tanpa error.
