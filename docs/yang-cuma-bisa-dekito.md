# Yang cuma bisa kamu kerjakan — 24 Oktober 2026

Enam hal. Semuanya saya coba kerjakan sendiri dan tertahan di pagar izin sesi saya, bukan di
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

## 4. SQL: posisi piramida 28 bahan  ·  1 query, aman diulang

`supabase/migrations/20261024120000_place_materials_whose_life_was_measured.sql`.

**Ini bukan tebakan, dan bukan karangan saya.** 549 bahan yang sudah KAMU isi posisinya terpisah
sempurna berdasarkan jam ketahanannya, tanpa tumpang tindih sama sekali:

| posisi | jumlah | rentang |
|---|---|---|
| top | 157 | 0 – 11 jam |
| middle | 281 | 12 – 112 jam |
| base | 111 | 120 – 2000 jam |

Jadi aturan "≤11 top, ≥120 base, sisanya middle" menghasilkan **549 dari 549** jawabanmu sendiri —
100%, saya ukur dengan query, bukan saya klaim. Jam-nya bukan pengganti aturanmu; itu MEMANG
aturan yang selama ini kamu pakai.

Query ini mengisi **28 bahan** yang jam-nya sudah terukur tapi posisinya belum pernah ditulis:
base 17, top 7, middle 4. Tidak ada satu pun yang dekat garis batas.

**195 bahan sisanya sengaja dibiarkan kosong** — jamnya belum pernah diukur, jadi tidak ada bukti
apa pun di belakangnya. Mengarang posisi untuk mereka justru kesalahan yang perbaikan ini mau
hapus. Dan yang sudah kamu isi sendiri tidak disentuh sama sekali.

Kalau mau bisa dibatalkan, ambil daftarnya DULU sebelum menjalankan:

```sql
select id, name, reference_life_hours from public.raw_materials
 where pyramid_placement is null and reference_life_hours > 0;
```

---

## 5. Supabase → Authentication → URL Configuration

Tambahkan dua baris ke **Redirect URLs**:

```
https://www.solivagantscent.com/en/customer
https://www.solivagantscent.com/en/mobile/customer
```

Tanpa ini, pelanggan toko Inggris yang login Google mental saat kembali.

---

## 6. SQL: harga terjadwal  ·  BERES-BERES SAJA, bukan sakelar

**Koreksi penting dari yang saya tulis sebelumnya.** Kalimat "jalankan setelah 12 Nov" tadi bisa
terbaca seolah harganya baru berganti kalau kamu menjalankan SQL ini. **Tidak.**

Harganya **berganti sendiri** pada 12 Nov 2026 pukul **00:00 WIB**, tanpa kamu melakukan apa pun.
Diverifikasi 25 Okt 2026 di tiga tempat yang semuanya harus sepakat, dan ternyata memang sepakat:

| yang memutuskan harga | membaca jadwal? |
|---|---|
| tampilan toko (`storefront_prices_for_me`) | ya, difilter `effective_at <= now()` |
| endpoint pembuatan order (`api/orders/create.js`) | ya, `asOf: Date.now()` |
| tabel jadwal (`storefront_price_schedule`) | 38 baris, semuanya 12 Nov 00:00 WIB |

Jadi pembeli tidak akan pernah melihat satu harga lalu ditagih harga lain. Komentar di kodenya
menegaskan aturannya: *jam SERVER yang memutuskan kapan harga berganti, bukan perangkat pembeli.*

Soal zona waktu: database jalan di UTC, tapi kolomnya `timestamptz` — menyimpan titik waktu
absolut. Jadi 00:00 WIB benar-benar tengah malam Jakarta, bukan jam 7 pagi.

**Lalu untuk apa SQL ini?** Beres-beres: memindahkan harga yang sudah berlaku ke tabel utama lalu
mengosongkan barisnya dari tabel jadwal, supaya kolom harga di Studio kembali berarti. Tidak ada
yang rusak kalau kamu lupa — cuma Studio terus menampilkan harga lama di kolom isiannya sementara
toko sudah memakai yang baru.

`supabase/migrations/20261112090000_apply_and_clear_price_schedule.sql`. Jalankan kapan saja
setelah 12 Nov. Aman kalau kecepatan dan aman kalau dijalankan dua kali.

---

## Yang sengaja TIDAK saya kerjakan

- **195 posisi piramida yang jamnya belum diukur.** Yang 28 sudah saya siapkan (nomor 4) karena ada
  buktinya. Sisanya tidak — bukan karena saya tidak boleh mengarang, tapi karena hasilnya akan
  menyesatkan alat racikmu sendiri. Isi dulu jam ketahanannya, nanti posisinya ikut dengan
  sendirinya.

  Catatan koreksi: saya pernah menolak ini dengan alasan "dibaca pembeli di halaman produk". **Itu
  salah.** Piramida di halaman produk dibaca dari deskripsi tulisanmu (`topNotes`/`heartNotes`/
  `baseNotes`), bukan dari kolom ini. Kolom ini cuma dipakai Studio. Begitu saya cek, ternyata
  bukan cuma boleh dikerjakan — ada jalan yang 100% akurat.
- **Ambar Segara di katalog.** Mekanismenya sudah siap, tapi membuat produknya berarti membuat
  parfum yang bisa dipesan orang dengan harga dan notes karangan saya.
- **Pengajuan Fragrantica & `ORDER_ALERT_WEBHOOK_URL`.** Yang pertama mengirim atas namamu ke pihak
  ketiga; yang kedua butuh URL dari layanan yang harus kamu buat dulu.
- **Stok 3 parfum habis + 5 tinggal 2–4 botol.** Itu keputusan dagang, bukan kode.
