# Bot Telegram dua arah — perintah dari HP

> ## STATUS 25 Okt 2026: terpasang, BELUM menyala
>
> Semua kodenya hidup di produksi. Botnya tidak menjawab karena satu sebab yang sudah
> **terdiagnosis pasti**, bukan dugaan — log runtime Vercel mencatat:
>
> ```
> [telegram] refused: bad-secret
> ```
>
> Artinya nilai `TELEGRAM_WEBHOOK_SECRET` di Vercel berbeda dengan `secret_token` yang dikirim
> saat `setWebhook`. Bukan masalah kode, bukan masalah jaringan.
>
> **Dalam keadaan ini botnya aman** — ia menolak semua perintah, jadi tidak ada yang bisa
> dilakukan siapa pun lewat dia. Menunda tidak berbahaya.
>
> **Satu hal yang sebaiknya tidak ditunda lama:** token bot sempat terbuka di URL tab browser
> (`api.telegram.org/bot<TOKEN>/...`), jadi ia ada di riwayat browser. Siapa pun yang memegang
> token itu bisa memanggil `setWebhook` sendiri dan mengalihkan seluruh perintah ke server
> mereka. Mengganti token lewat `@BotFather` → `/revoke` gratis dan membatalkan yang lama.
>
> ### Urutan menyalakannya (sekaligus menutup kedua hal di atas)
> 1. `@BotFather` → `/revoke` → token baru
> 2. `openssl rand -hex 32` → secret baru
> 3. Vercel, **timpa** dua variabel:
>    `ORDER_ALERT_WEBHOOK_URL` = `https://api.telegram.org/bot<TOKEN-BARU>/sendMessage`
>    `TELEGRAM_WEBHOOK_SECRET` = secret baru
> 4. buka `https://api.telegram.org/bot<TOKEN-BARU>/setWebhook?url=https://www.solivagantscent.com/api/telegram/webhook&secret_token=<SECRET-BARU>`
> 5. minta deploy ulang, lalu kirim `/bantuan`
>
> Kalau masih diam: buka **Vercel → Logs**, cari `[telegram] refused:`. Kode alasannya
> menunjuk langsung — `bad-secret`, `wrong-chat`, atau `allowlist-not-configured`.
> `vercel logs` dari CLI TIDAK menampilkannya; harus lewat dashboard.


Notifikasi satu arah sudah hidup. Ini separuh keduanya: kamu kirim perintah, toko menjawab.

## Yang perlu kamu tahu dulu, sekali saja

Endpoint ini memakai `SUPABASE_SERVICE_ROLE_KEY` — kunci yang **melewati seluruh aturan RLS**.
Di Studio, tulisan yang sama dijaga login **dan** 2FA yang kamu pasang 6 September. Pesan chat
tidak punya keduanya.

Artinya: **siapa pun yang memegang HP-mu dalam keadaan terbuka, atau mengambil alih akun
Telegram-mu, bisa mengubah stok dan membuat produk** tanpa melewati 2FA. Kamu sudah memilih ini
setelah tahu, dan itu keputusanmu — yang di bawah ini adalah pagar yang membuatnya masih masuk akal.

**Tiga pagarnya:**
1. **Secret header Telegram** — tanpa itu, request ditolak sebelum satu byte pun dibaca
2. **Satu chat id** — hanya chat yang menerima notifikasi order, diambil dari `ORDER_ALERT_EXTRA`
3. **Konfirmasi** — tiap perintah yang mengubah data minta kode diketik ulang

Dan semuanya **gagal-tertutup**: secret belum diisi, allowlist belum diisi, body tak terbaca — semua
menolak. Endpoint yang menganggap "belum dikonfigurasi" sama dengan "tidak perlu dicek" itu terbuka
sejak detik ia naik.

## Pasangnya — dua langkah

### 1. Buat secret dan simpan di Vercel

Bikin teks acak panjang (minimal 32 karakter, bebas). Simpan di Vercel sebagai **Secret**,
Environment **Production**, dengan nama:

```
TELEGRAM_WEBHOOK_SECRET
```

Simpan juga teksnya sendiri — dipakai sekali di langkah 2.

### 2. Daftarkan webhook-nya ke Telegram

Buka alamat ini di browser, ganti `<TOKEN>` dan `<SECRET>`:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://www.solivagantscent.com/api/telegram/webhook&secret_token=<SECRET>
```

Balasan `{"ok":true,"result":true,...}` berarti terpasang. Setelah itu kirim `/bantuan` ke botmu.

> Kalau ingin mematikan bot dua arah kapan saja, buka
> `https://api.telegram.org/bot<TOKEN>/deleteWebhook`. Notifikasi order tetap jalan — itu jalur
> terpisah dan tidak terpengaruh.

## Perintahnya

### Baca
| perintah | hasilnya |
|---|---|
| `/stok` | semua stok, yang paling menipis di atas |
| `/stok vetiver` | hanya yang namanya cocok |
| `/order` | 5 order terakhir, nomor + total + status |
| `/bantuan` | daftar ini |

### Tulis — selalu minta konfirmasi
| perintah | hasilnya |
|---|---|
| `/stok aquilaria 12` | ubah stok jadi 12 |
| `/produk Ambar Segara` | produk **draft** baru |
| `/artikel Judul` lalu isinya di baris berikutnya | artikel **draft** baru |

Alurnya: kirim perintah → bot membalas dengan kode seperti `ya-7971` → kirim ulang perintah yang
sama dengan kode itu di akhir. Kodenya **terikat pada isi perintahnya**, jadi konfirmasi untuk
`/stok x 1` tidak bisa dipakai menjalankan `/stok x 1000`.

### Kenapa produk dan artikel dibuat sebagai DRAFT
Produk yang lahir dari satu kata di chat belum punya harga, varian, maupun foto. Kalau langsung
terlihat pembeli, ia bisa dipesan dengan harga apa pun yang kebetulan jadi nilai default kolom
kosong. Jadi bot membuat rangkanya, kamu yang menyelesaikan di Studio.

### Ubah stok butuh satu migrasi
`/stok <nama> <angka>` memanggil RPC `storefront_set_stock`, bukan menulis kolomnya langsung.
Jalankan dulu `supabase/migrations/20261025120000_set_stock_rpc.sql` — sebelum itu, perintah ubah
stok akan menjawab error dan perintah lainnya tetap jalan.

Alasannya bukan formalitas: stok hanya boleh bergerak lewat jalur yang atomik. RPC itu membaca ulang
barisnya di dalam statement dan **menolak kalau barisnya berubah sejak bot membacanya** — jadi stok
yang kamu set dari HP tidak bisa menimpa pengurangan dari order yang masuk pada detik yang sama.
Itu persis bug audit ronde 7, dan ini yang mencegahnya terulang lewat pintu baru.
