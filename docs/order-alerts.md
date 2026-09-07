# Pemberitahuan order masuk

Sebelum ini tidak ada apa pun yang memberi tahu saat order datang — satu-satunya cara tahu
adalah membuka Studio dan melihat. Pembeli transfer manual yang sudah mengirim uang menunggu
sampai ada yang sadar.

Sekarang server mengirim satu pesan pada dua momen:

| Kapan | Isi |
|---|---|
| Order dibuat (`/api/orders/create`) | `ORDER BARU` + total + pembeli + langkah berikutnya |
| DOKU konfirmasi lunas (`/api/doku/notification`) | `PEMBAYARAN MASUK` |

Kalau tidak diatur, tidak ada yang dikirim. Kalau endpoint-nya mati atau lambat, order tetap
jalan — notifikasi tidak pernah menggagalkan checkout (timeout 4 detik, error ditelan).

## Cara menyalakan

Isi di Vercel → Settings → Environment Variables, lalu redeploy.

| Variabel | Wajib | Isi |
|---|---|---|
| `ORDER_ALERT_WEBHOOK_URL` | ya | URL tujuan, di-POST sebagai JSON |
| `ORDER_ALERT_EXTRA` | kadang | JSON, digabung ke body — untuk penerima (`chat_id`, `target`) |
| `ORDER_ALERT_HEADERS` | kadang | JSON, header tambahan — untuk token |
| `SITE_URL` | tidak | supaya pesan memuat link ke `/studio/orders` |

Pesan dikirim di tiga nama field sekaligus (`text`, `message`, `content`), jadi sebagian besar
endpoint langsung cocok tanpa perantara.

### Telegram (gratis, paling cepat dipasang)

1. Chat `@BotFather` → `/newbot` → salin token.
2. Kirim satu pesan ke bot itu, lalu buka
   `https://api.telegram.org/bot<TOKEN>/getUpdates` dan salin `chat.id`.

```
ORDER_ALERT_WEBHOOK_URL = https://api.telegram.org/bot<TOKEN>/sendMessage
ORDER_ALERT_EXTRA       = {"chat_id":"<CHAT_ID>"}
```

### WhatsApp lewat Fonnte

```
ORDER_ALERT_WEBHOOK_URL = https://api.fonnte.com/send
ORDER_ALERT_EXTRA       = {"target":"628xxxxxxxxxx"}
ORDER_ALERT_HEADERS     = {"Authorization":"<TOKEN_FONNTE>"}
```

### Zapier / Make / n8n

Pakai URL webhook-nya apa adanya. Body JSON berisi `text`, `orderNumber`, `total`, `customer`,
`contact`, `paymentProvider`, `event` (`created` / `paid`).

## Yang belum tercakup

Upload bukti transfer tidak lewat API — pembeli menulis langsung ke database lewat RPC. Untuk
alert di momen itu, pasang Supabase → Database → Webhooks pada `storefront_orders`, kondisi
kolom bukti berubah, arahkan ke URL yang sama.

## Cek cepat

```bash
node apps/web/src/utils/orderNotifier.selfcheck.mjs
```
