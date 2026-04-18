# Dekito Perfumery Workspace

Monorepo ini berisi:

- `apps/web`: frontend React + Vite
- `apps/api`: backend Express
- `apps/pocketbase`: database/app backend bawaan dari Horizon

## Kondisi awal yang sudah dicek

- install dependency berhasil
- `npm run lint` berhasil
- `npm run build` berhasil untuk frontend
- root project belum diinisialisasi sebagai Git repository

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

4. Sesuaikan nilai di `apps/api/.env`.
5. Jalankan semua service:

```bash
npm run dev
```

Service default:

- web: `http://localhost:3000`
- api: `http://localhost:3001`
- pocketbase: `http://localhost:8090`

## Langkah GitHub nanti

1. Inisialisasi repo:

```bash
git init
git add .
git commit -m "Initial project setup"
```

2. Buat repository kosong di GitHub.
3. Sambungkan remote:

```bash
git remote add origin <URL_REPO_GITHUB>
git branch -M main
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

## Catatan

- Jangan commit file `.env`
- Jangan commit `apps/pocketbase/pb_data`
- Saat siap migrasi, kita bisa mulai dari desain schema Supabase dulu agar perubahan di frontend lebih terarah
