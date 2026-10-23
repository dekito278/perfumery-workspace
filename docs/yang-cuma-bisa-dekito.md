# Yang cuma bisa kamu kerjakan — 24 Oktober 2026

Lima hal. Semuanya saya coba kerjakan sendiri dan tertahan di pagar izin sesi saya, bukan di
aksesmu — kamu sudah memberi akses, tapi pagarnya ada di sisi saya dan tidak bisa saya lepas.
Yang tidak tertahan sudah saya selesaikan dan sudah hidup di produksi.

Urut dari yang paling berdampak.

---

## 1. Terbitkan 5 artikel bahan  ·  Studio, 5 klik, 2 menit

Buka **Studio → Jurnal**. Ada 6 artikel: 5 draft baru + Kisah Jason Voorhees.
Tiap baris draft punya tombol bertuliskan **"masih draft"** — satu klik, terbit.

| artikel | produk terkait |
|---|---|
| Gaharu tidak lahir dari pohon yang baik-baik saja | Aquilaria tuberosa |
| Nilam sering dibilang wangi orang tua | Patchouli so sexy |
| Namanya aja akar wangi. Yang wangi ya akarnya | J'adore La Vetiver |
| Vanila itu buah dari bunga anggrek | Vanille Planifolia |
| Bau tanah pas hujan pertama itu ada namanya: geosmin | Jata Bhumi |

Teksnya punyamu, dari caption Instagram-mu sendiri, sudah dicek. Kalau mau baca ulang dulu,
arsipnya di `docs/jurnal-lima-cerita-bahan.md`.

**Kenapa ini nomor satu:** caption Gaharu-mu bilang *"Ceritanya ada di solivagantscent.com"* —
dan sampai sekarang halaman itu tidak ada. Siapa pun yang menurutinya sampai di website dan tidak
menemukan apa-apa.

**Setelah terbit, bilang ke saya.** Sitemap dan halaman preview-nya dibuat saat deploy, jadi
Google dan preview link WhatsApp baru melihatnya setelah deploy berikutnya. Saya deploy sekali,
selesai. Tanpa cover, kelimanya akan memakai satu foto preview yang sama — masih jauh lebih baik
daripada tanpa gambar, tapi kalau mau beda, isi Cover Image URL-nya.

---

## 2. SQL: rapikan batas IFRA  ·  1 query, aman diulang

Sudah saya hitung langsung di produksi: **666 baris, 76 bernilai 0, 94 sudah NULL.** Persis cocok
dengan catatanmu, jadi query ini akan melakukan tepat seperti yang tertulis.

0 di kolom itu artinya "belum terdata", bukan "dilarang IFRA" (keputusanmu 11 Okt). Kodenya sudah
membacanya begitu sejak PR #446; ini merapikan datanya supaya tidak berbohong ke siapa pun yang
membacanya nanti.

```sql
begin;
update public.material_reference_profiles set ifra_limit_percent = null
where ifra_limit_percent = 0;
commit;
```

Cek sesudahnya — harus `nol 0`, `kosong 170`:

```sql
select count(*) filter (where ifra_limit_percent = 0) as nol,
       count(*) filter (where ifra_limit_percent is null) as kosong
  from public.material_reference_profiles;
```

---

## 3. SQL: kolom lini Reserve  ·  1 query, tidak mengubah apa pun

Isinya ada di `supabase/migrations/20261024090000_reserve_is_a_line.sql`. Menambah satu kolom dan
**tidak menandai produk apa pun** — jadi setelah dijalankan, tampilan toko sama persis seperti hari
ini. Tidak ada badge, tidak ada pill RESERVE.

```sql
alter table public.storefront_products
    add column if not exists reserve boolean not null default false;
```

Sesudahnya, di Studio tiap produk ada kotak centang baru **"Lini RESERVE"**. Begitu kamu centang
satu, badge-nya muncul di kartu dan pill RESERVE muncul di katalog dengan sendirinya. Parfum itu
tetap muncul di famili aromanya sendiri — persis pelajaran dari LIMITED dulu.

Mana saja yang masuk lini Reserve itu keputusanmu. Saya sengaja tidak menebak.

---

## 4. Supabase → Authentication → URL Configuration

Tambahkan dua baris ke **Redirect URLs**:

```
https://www.solivagantscent.com/en/customer
https://www.solivagantscent.com/en/mobile/customer
```

Tanpa ini, pelanggan toko Inggris yang login Google mental saat kembali.

---

## 5. SQL: harga terjadwal  ·  TUNGGU SAMPAI 12 NOVEMBER

`supabase/migrations/20261112090000_apply_and_clear_price_schedule.sql`.

Jalankan **setelah 12 Nov 2026**. Aman kalau kecepatan (tidak melakukan apa-apa sampai tanggalnya
lewat) dan aman kalau dijalankan dua kali.

---

## Yang sengaja TIDAK saya kerjakan

- **56 pyramid placement.** Kamu bolehkan saya mengarang, dan untuk naskah saya pakai itu. Tapi ini
  data wangi yang dibaca pembeli sebagai fakta, dan heuristiknya cuma 46% akurat — sudah pernah
  diukur. Mengisinya berarti menaruh 30 keterangan yang salah di halaman produk. Pedoman konten-mu
  sendiri melarangnya.
- **Ambar Segara di katalog.** Mekanismenya sudah siap, tapi membuat produknya berarti membuat
  parfum yang bisa dipesan orang dengan harga dan notes karangan saya.
- **Pengajuan Fragrantica & `ORDER_ALERT_WEBHOOK_URL`.** Yang pertama mengirim atas namamu ke pihak
  ketiga; yang kedua butuh URL dari layanan yang harus kamu buat dulu.
- **Stok 3 parfum habis + 5 tinggal 2–4 botol.** Itu keputusan dagang, bukan kode.
