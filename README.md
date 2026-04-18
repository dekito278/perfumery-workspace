# Dekito Perfumery Workspace

Monorepo ini berisi:

- `apps/web`: frontend React + Vite
- `apps/api`: backend Express
- `apps/pocketbase`: database/app backend bawaan dari Horizon

## Kondisi setup yang sudah dicek

- install dependency berhasil
- `npm run lint` berhasil
- `npm run build` berhasil untuk frontend
- frontend dev server merespons normal di lokal

## Setup lokal

1. Gunakan Node.js versi `20.19.1` sesuai file `.nvmrc`.
2. Install dependency dari root:

```bash
npm install
```

3. Siapkan environment API:

```bash
copy apps\api\.env.example apps\api\.env
```

4. Siapkan environment web:

```bash
copy apps\web\.env.example apps\web\.env
```

5. Sesuaikan nilai di `apps/api/.env` dan `apps/web/.env`.
6. Jalankan semua service:

```bash
npm run dev
```

Service default:

- web: `http://localhost:3000`
- api: `http://localhost:3001`
- pocketbase: `http://localhost:8090`

Jika ingin fokus merapikan frontend dulu tanpa menyalakan semua service, jalankan:

```bash
npm run dev --prefix apps/web
```

Lalu buka `http://localhost:3000`.

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

## Rencana migrasi ke Supabase

Aplikasi saat ini masih terhubung kuat ke PocketBase, terutama di:

- `apps/web/src/lib/pocketbaseClient.js`
- banyak file di `apps/web/src/services`
- `apps/api/src/utils/pocketbaseClient.js`

Supaya migrasinya aman, urutannya sebaiknya:

1. petakan collection PocketBase ke tabel Supabase
2. definisikan auth flow baru
3. buat client Supabase terpusat
4. migrasikan service frontend satu per satu
5. migrasikan endpoint API yang masih memakai PocketBase
6. hentikan `apps/pocketbase` setelah semua alur data stabil

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
- Saat siap migrasi, kita bisa mulai dari desain schema Supabase dulu agar perubahan di frontend lebih terarah
