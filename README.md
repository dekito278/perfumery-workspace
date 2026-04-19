# Dekito Perfumery Workspace

## Active Stack

Workflow aktif sekarang berpusat di:

- `apps/web`: frontend React + Vite
- Supabase: auth + database operasional

Kalau tujuanmu adalah menjalankan app, melihat perubahan lokal, dan melanjutkan development harian, fokusnya ada di dua hal itu saja.

Root repo sekarang juga mengikuti alur itu:

- `npm run dev` menjalankan frontend aktif
- `npm run build` membangun frontend aktif
- `npm run lint` memeriksa frontend aktif

## Legacy Folders

Folder berikut masih ada di repo sebagai sisa struktur lama, tetapi bukan jalur utama aplikasi aktif:

- `apps/api`: backend Express legacy
- `apps/pocketbase`: backend/data legacy dari Horizon

Status audit saat ini:

- `apps/api` hanya mengekspose route `/health`
- frontend aktif tidak lagi memakai `VITE_API_BASE_URL`
- frontend aktif tidak lagi mengimpor helper PocketBase atau service API lama
- charting, auth, formula flow, dan inventory flow yang sudah kita cek berjalan lewat Supabase

Kesimpulan praktis:

- `apps/api` saat ini tidak dibutuhkan oleh workflow web aktif
- `apps/pocketbase` saat ini tidak dibutuhkan untuk menjalankan frontend lokal aktif
- keduanya tetap disimpan di repo hanya sebagai legacy reference, bukan jalur default

## Kondisi setup yang sudah dicek

- install dependency berhasil
- `npm run lint` berhasil
- `npm run build` berhasil untuk frontend
- frontend dev server merespons normal di lokal
- Vite sudah terpasang di `apps/web`, jadi tidak perlu install lagi terpisah

## Setup Lokal

1. Gunakan Node.js versi `20.19.1` sesuai file `.nvmrc`.
2. Install dependency dari root:

```bash
npm install
```

3. Siapkan environment web:

```bash
copy apps\web\.env.example apps\web\.env
```

4. Pastikan nilai Supabase di `apps/web/.env` benar.
5. Jalankan frontend aktif:

```bash
npm run dev
```

Kalau mau port tetap dan gampang saya cek juga dari lokal:

```bash
npm run dev:web:3002
```

Lalu buka:

- `http://localhost:3000` untuk `dev`
- `http://127.0.0.1:3002` untuk `dev:web:3002`

## Jika Memang Mau Menyalakan Stack Legacy

```bash
npm run dev:legacy
```

Service default monorepo lama:

- web: `http://localhost:3000`
- api: `http://localhost:3001`
- pocketbase: `http://localhost:8090`

Untuk kerja frontend sehari-hari, pakai `npm run dev` atau `npm run dev:web:3002`.

Kalau ingin preview build production frontend:

```bash
npm run build
npm run start
```

## Menjalankan migration Supabase

Setelah folder `supabase/` tersedia dan project Anda sudah siap, jalankan migration SQL ke project Supabase Anda. File awal yang sudah disiapkan:

- `supabase/migrations/20260419023000_raw_materials_and_categories.sql`

Migration ini menyiapkan:

- `raw_material_categories`
- `raw_materials`
- Row Level Security untuk data per user

## Langkah GitHub nanti

1. Buat repository kosong di GitHub.
2. Sambungkan remote:

```bash
git remote add origin <URL_REPO_GITHUB>
git push -u origin main
```

## Audit apps/api

Hasil audit saat ini menunjukkan:

1. `apps/api` adalah server Express kecil dengan dependency utama `express`, `cors`, `helmet`, `morgan`, dan `pocketbase`.
2. Route yang aktif saat ini hanya `GET /health`.
3. Frontend aktif tidak lagi mengarah ke `http://localhost:3001`, `VITE_API_BASE_URL`, atau helper `apiServerClient`.
4. Tidak ada referensi aktif dari `apps/web/src` ke service PocketBase atau service API lama yang sebelumnya sudah dibersihkan.

Kesimpulan:

- `apps/api` tidak dipakai oleh workflow frontend aktif saat ini.
- Penghapusan struktural bisa dilakukan sebagai fase terpisah, asalkan kita tetap menjaga `apps/web` dan `supabase/` utuh.

## Workspace Aktif

Root workspace sekarang difokuskan ke `apps/web`.
Folder legacy masih ada di repo, tetapi tidak lagi menjadi bagian dari jalur kerja utama.

## Next Cleanup Direction

Kalau ingin lanjut bersih-bersih tanpa mengganggu web app aktif, urutan amannya:

1. ubah default command repo ke web-only
2. tandai `apps/api` dan `apps/pocketbase` sebagai legacy di dokumentasi dan script
3. arsipkan atau keluarkan folder legacy dalam fase terpisah
4. setelah itu, evaluasi apakah root workspace masih perlu berbentuk monorepo

## Persiapan Supabase

Yang perlu tersedia sebelum migrasi penuh:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` untuk frontend
- `SUPABASE_SERVICE_ROLE_KEY` untuk backend saja, jangan pernah ditaruh di frontend
- keputusan apakah auth akan memakai Supabase Auth
- Docker Desktop jika ingin menjalankan Supabase lokal lewat CLI

Referensi resmi:

- [Supabase CLI Getting Started](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development)

## Catatan

- Jangan commit file `.env`
- Jangan commit `apps/pocketbase/pb_data`
- Untuk lihat hasil update UI lokal, gunakan `npm run dev` atau `npm run dev:web:3002`
