# Backlog UX — SOLIVAGANT (audit 2026-09-07)

Diaudit langsung di production: jalur pembeli mobile (beranda → katalog → produk →
tambah ke keranjang → keranjang → checkout) plus penyisiran kode untuk masalah sistematis.

**Cara pakai (dipakai oleh /loop):** ambil item paling atas yang belum `[x]`, kerjakan
satu item saja per iterasi, jalankan `npm run selfcheck` + eslint + `vite build`, buka PR,
merge, lalu tandai `[x]` di sini beserta nomor PR. Jangan gabungkan dua item dalam satu PR.

---

## Gelombang 1 — jalur pembeli (paling berdampak)

- [x] (PR #45) **U-1 · Autofill checkout mati.** 6 dari 7 field checkout tanpa atribut `autocomplete`,
      jadi nama, alamat, dan kode pos tidak pernah terisi otomatis di HP. Pembeli mengetik
      alamat lengkap dengan tangan setiap kali. Tambahkan `autocomplete` (`name`, `street-address`,
      `postal-code`, `tel`) + `inputmode` yang tepat di checkout desktop dan mobile.
      Verifikasi: `document.querySelectorAll('input')` di /mobile/checkout, semua punya autocomplete.

- [x] (PR #46) **U-2 · Toast "added to cart" masih Inggris.** `MobileProductDetailPage.jsx:89` menulis
      `${product.name} added to cart` di storefront yang selebihnya Indonesia — muncul tepat di
      aksi paling penting. Ganti "…masuk keranjang". Sisir juga toast pembeli lain.

- [x] (PR #47) **U-3 · Keranjang menampilkan barang yang sama dua kali** dan punya dua tombol
      "Lanjut bayar" (ringkasan atas + daftar bawah). Satukan: ringkasan tanpa daftar mini,
      satu tombol utama.

- [x] (PR #47) **U-4 · Kotak voucher berada di bawah tombol "Lanjut bayar" pertama.** Pembeli bisa
      checkout tanpa pernah melihatnya. Pindahkan voucher ke atas tombol utama.

- [x] (PR #48) **U-5 · Placeholder dipakai sebagai label.** "KODE VOUCHER", "Catatan pengiriman atau
      request", "Nama pembeli" hanya placeholder abu besar; begitu diketik, konteksnya hilang,
      dan pembaca layar membacanya tanpa nama. Beri `<Label>` (boleh visually-hidden bila desain
      tidak boleh berubah) atau `aria-label` di semua field checkout dan bespoke.

- [x] (PR #49) **U-6 · Metode pembayaran tidak terlihat bisa dipilih.** "Transfer manual BCA" dan
      "DOKU Checkout" tampil seperti kartu informasi statis: tanpa radio, tanpa keadaan terpilih
      yang jelas. Beri penanda pilihan yang tegas.

- [x] (PR #50) **U-7 · Tiga indikator progres bersaing di checkout**: "LANGKAH 3/6", "2/6 BERES", dan
      "Lengkapi: Area, Kurir — 2 KURANG" tampil bersamaan dengan arti yang tumpang tindih.
      Sisakan satu yang jujur.

## Gelombang 2 — keterbacaan & sentuhan

- [x] (PR #51) **U-8 · Kontras teks di bawah ambang.** `text-[#9ca3af]` dipakai 32 kali di atas latar
      krem, sekitar 2.5:1, jauh di bawah 4.5:1. Ganti ke warna tubuh yang sudah ada
      (`#6b7280` ≈ 4.6:1) untuk teks yang harus terbaca.

- [x] (PR #52) **U-9 · Target sentuh di bawah 44px** di keranjang dan checkout (tombol jumlah 32×32,
      beberapa 40px). Naikkan ke minimal 44×44 tanpa mengubah tampilan visual (padding/inset).

- [x] **U-10 · TIDAK PERLU — temuan saya keliru.** Dugaan awal datang dari menghitung `focus-visible`
      per berkas: `studio.css` memang nol. Tapi semua stylesheet dimuat global di `main.jsx`, dan
      `storefront.css` memuat aturan tanpa scope
      `:is(a, button, input, select, textarea, [tabindex]):focus-visible` yang juga berlaku di studio.
      Diuji di production dengan menekan Tab sungguhan (bukan `focus()` lewat skrip, yang tidak selalu
      memicu `:focus-visible`): dua kontrol studio berbeda sama-sama menghasilkan
      `outline: solid 2px rgb(176,139,79)` dan `matches(':focus-visible') === true`. Tidak ada yang
      perlu diperbaiki.

## Gelombang 3 — tampilan (menyiapkan foto asli)

- [x] (PR #53) **U-11 · Kartu mood beranda terlihat kosong**: kotak pastel polos berisi satu kata.
      Beri isi yang tidak bergantung foto (tekstur/gradasi + nama nota khas).

- [x] **U-12 · TIDAK PERLU — temuan saya keliru.** Diukur di production, beranda desktop sudah
      berselang-seling: hero gelap (luminans 26), brandmark krem (241), koleksi krem, statement gelap
      (26), dua seksi krem, newsletter hijau tua (51). Tiga jangkar gelap, bukan satu. Kesan "serba
      terang" datang dari screenshot tab tersembunyi, tempat gambar dan animasi reveal belum sempat
      dilukis sehingga seksi bergambar tampak kosong. Pelajaran yang sama dengan U-10: verifikasi di
      tab yang benar-benar terlihat.

- [ ] **U-13 · Siapkan kartu produk untuk foto asli**: rasio tetap, `object-fit: cover`,
      skeleton saat memuat, dan fallback saat foto belum ada. (Foto botolnya sendiri dari owner.)

---

## Butuh owner, bukan kode

- **Foto produk.** Tidak ada satu pun botol asli terlihat di storefront; yang tampil kartu label
  bergaya media sosial berisi foto stok (kincir angin, ladang tulip) dengan URL tercetak.
  Untuk merek buatan tangan ini yang paling melemahkan. Satu sesi foto HP dekat jendela,
  latar gelap, 3–5 frame per botol, plus 10 foto proses.
- **Prompt "Tambah ke Home Screen"** muncul di beranda pembeli iOS setelah jeda. Keputusan produk.
- **17 `window.confirm()` bawaan browser** di studio. Mengganti dengan dialog bergaya aplikasi
  adalah pekerjaan menengah, bukan sapuan.
