// Every string the storefront shows a buyer, in both languages.
//
// No i18n library. This is one object and a lookup: adding react-i18next for a shop with exactly two
// languages buys a plural engine, a loader and a context provider that nothing here needs, and costs a
// dependency to keep current forever.
//
// Three rules make it safe rather than merely small:
//
//   1. Every key exists in BOTH languages. A missing `en` key is an Indonesian sentence in the middle of
//      the English shop, which reads as a broken shop rather than an untranslated one. The guard fails on
//      a missing key; at RUNTIME the lookup still falls back to Indonesian, because a blank button is
//      worse again.
//   2. Studio and admin screens are not in here. They have one reader, and he speaks Indonesian.
//   3. The English is not a translation where a translation would be a lie. An international buyer pays
//      the export price and signing in does not lower it — the member discount is an Indonesian-order
//      thing — so the English welcome page must not offer one. Same page, different true statement.

export const MESSAGES = {
  id: {
    'welcome.title': 'Selamat datang - Solivagant',
    'welcome.meta': 'Terima kasih sudah memilih Solivagant. Masuk dengan Google untuk harga member di seluruh katalog.',
    'welcome.eyebrow': 'DARI KARTU DI PAKETMU',
    'welcome.heading': 'Terima kasih sudah memilih Solivagant.',
    'welcome.lead': 'Parfum yang barusan sampai diracik di atelier ini. Harga di sini sudah di bawah marketplace — dan kalau lain kali memesan langsung, satu akun Google menurunkannya lagi ke harga member, plus riwayat pesanan dan pesan-lagi dalam sekali ketuk.',
    'welcome.alreadyMember': 'Kamu sudah member — lihat koleksi',
    'welcome.signIn': 'Masuk dengan Google — harga member',
    'welcome.browse': 'Lihat koleksi dulu',

    'pdp.loading': 'Memuat produk…',
    'pdp.notFoundTitle': 'Fragrance ini tidak ditemukan.',
    'pdp.backToCollection': 'Kembali ke koleksi',
    'pdp.home': 'Beranda',
    'pdp.collection': 'Koleksi',
    'pdp.size': 'UKURAN',
    'pdp.wearFor': 'COCOK DIPAKAI',
    'pdp.rawMaterials': 'RAW MATERIAL HIGHLIGHTS',
    'pdp.soldOut': 'Stok Habis',
    'pdp.inCart': 'Sudah di Keranjang',
    'pdp.addToCart': 'Tambah ke Keranjang',
    'pdp.addToCartWithPrice': 'Tambah ke Keranjang — {price}',
    'pdp.addedToast': '{name} masuk ke keranjang',
    'pdp.cartUpdated': 'Keranjang sudah diperbarui.',
    'pdp.viewCart': 'Lihat cart',
    'pdp.youMayLike': 'MUNGKIN KAMU SUKA',
    'pdp.youMayLikeSub': 'Signature tenang lainnya',
    'pdp.intensity': 'Intensitas {level}',
    'pdp.previewBadge': 'Preview admin — keranjang dimatikan',
    'pdp.previewDisabled': 'Mode preview — keranjang dimatikan',
    'pdp.outOfStockToast': 'Stok habis',
    'pdp.back': 'Kembali',
    'pdp.notFoundTab': 'Tidak ditemukan - SOLIVAGANT',
    'pdp.notFoundEyebrow': 'TIDAK DITEMUKAN',
    'pdp.soldOutOption': ' (Stok habis)',
    'pdp.addedSheetTitle': 'Masuk ke keranjang',
    'pdp.addedSheetBody': 'Lanjut belanja, atau langsung ke pembayaran.',
    'pdp.continueShopping': 'Lanjut belanja',
    'pdp.checkout': 'Checkout',

    'pyramid.title': 'PIRAMIDA AROMA',
    'pyramid.topCaption': 'Pembuka · menguar cepat',
    'pyramid.heartCaption': 'Inti · karakter utama',
    'pyramid.baseCaption': 'Dasar · jejak terlama',
    'pyramid.strengthLabel': 'Ketahanan {tier}: {percent} persen',

    'price.memberTier': 'Harga member',
    'price.resellerTier': 'Harga reseller',
    'price.memberIs': 'Member {price}',
    'price.saveShort': 'hemat {amount}',
    'price.save': 'Hemat {amount}',
    'price.signInGoogle': 'Masuk dengan Google',

    'stock.one': 'Tersisa 1 botol',
    'stock.many': 'Tersisa {count} botol',

    'export.heading': 'Kirim ke luar negeri',
    'export.priceLine': 'Harga untuk pengiriman ke luar negeri:',
    'export.notIncluded': '— belum termasuk ongkir.',
    'export.ask': 'Kirim ke luar negeri? Tanya ongkir',

    'catalog.tab': 'Koleksi - SOLIVAGANT',
    'catalog.eyebrow': 'KOLEKSI FRAGRANCE',
    'catalog.title': 'Koleksi',
    'catalog.lead': 'Objek parfum terbatas dan signature harian yang tenang dari atelier.',
    'catalog.searchPlaceholder': 'Cari notes, mood, atau nama...',
    'catalog.searchLabel': 'Cari fragrance berdasarkan nama, notes, atau mood',
    'catalog.all': 'Semua',
    'catalog.soldOutShort': 'Habis',
    'catalog.outOfStockToast': '{name} sedang habis',
    'catalog.addAria': 'Tambah {name} ke keranjang',
    'catalog.soldOutAria': '{name} stok habis',
    'catalog.noMatchEyebrow': 'TIDAK ADA',
    'catalog.noMatch': 'Tidak ada fragrance yang cocok dengan filter ini.',
    'catalog.notLoadedEyebrow': 'KOLEKSI BELUM TERMUAT',
    'catalog.notLoaded': 'Koleksi belum bisa dimuat. Coba muat ulang halaman sebentar lagi.',
    'catalog.noMatchMobile': 'Tidak ada fragrance yang cocok.',
    'catalog.notLoadedMobile': 'Katalog belum bisa dimuat.',
    'catalog.wearHeading': 'Pakai untuk momen apa?',
    'catalog.filterBy': 'Filter berdasarkan {facet}',
    'catalog.category': 'kategori',
    'catalog.quickAdd': 'Keranjang',
    'catalog.added': 'Ditambahkan',

    'wear.occasions': 'Momen',
    'wear.occasions.kerja': 'Kerja',
    'wear.occasions.santai': 'Santai',
    'wear.occasions.malam': 'Malam spesial',
    'wear.occasions.perayaan': 'Perayaan',
    'wear.occasions.perjalanan': 'Perjalanan',
    'wear.times': 'Waktu',
    'wear.times.pagi': 'Pagi',
    'wear.times.siang': 'Siang',
    'wear.times.sore': 'Sore',
    'wear.times.malam': 'Malam',
    'wear.weather': 'Cuaca',
    'wear.weather.panas': 'Panas',
    'wear.weather.hujan': 'Hujan',
    'wear.weather.sejuk': 'Sejuk',

    'stale.body': 'Koneksi ke server gagal, jadi katalog ini ditampilkan dari simpanan di perangkatmu. Harga dan deskripsinya bisa sudah tidak berlaku.',
    'stale.retry': 'Coba muat ulang',
  },
  en: {
    'welcome.title': 'Welcome - Solivagant',
    'welcome.meta': 'Thank you for choosing Solivagant. The atelier behind the bottle in your parcel.',
    'welcome.eyebrow': 'FROM THE CARD IN YOUR PARCEL',
    'welcome.heading': 'Thank you for choosing Solivagant.',
    // Deliberately not a translation of the Indonesian lead. That one offers a member discount, which an
    // international order does not get — outside Indonesia the price is the export price and shipping is
    // quoted by hand. Promising a discount this buyer cannot have is the bait-and-switch the export panel
    // exists to prevent, wearing a friendlier face.
    'welcome.lead': 'The perfume that just reached you was blended in this atelier, one bottle at a time. Ordering from here means buying from the person who made it. Outside Indonesia we price and quote shipping by hand — every product page shows the international price before you ask.',
    'welcome.alreadyMember': "You're signed in — see the collection",
    'welcome.signIn': 'Sign in with Google',
    'welcome.browse': 'Browse the collection',

    'pdp.loading': 'Loading product…',
    'pdp.notFoundTitle': 'This fragrance could not be found.',
    'pdp.backToCollection': 'Back to the collection',
    'pdp.home': 'Home',
    'pdp.collection': 'Collection',
    'pdp.size': 'SIZE',
    'pdp.wearFor': 'WEAR IT FOR',
    'pdp.rawMaterials': 'RAW MATERIAL HIGHLIGHTS',
    'pdp.soldOut': 'Sold out',
    'pdp.inCart': 'In your cart',
    'pdp.addToCart': 'Add to cart',
    'pdp.addToCartWithPrice': 'Add to cart — {price}',
    'pdp.addedToast': '{name} added to your cart',
    'pdp.cartUpdated': 'Your cart has been updated.',
    'pdp.viewCart': 'View cart',
    'pdp.youMayLike': 'YOU MAY ALSO LIKE',
    'pdp.youMayLikeSub': 'Other quiet signatures',
    'pdp.intensity': '{level} intensity',
    'pdp.previewBadge': 'Admin preview — cart disabled',
    'pdp.previewDisabled': 'Preview mode — cart disabled',
    'pdp.outOfStockToast': 'Out of stock',
    'pdp.back': 'Back',
    'pdp.notFoundTab': 'Not found - SOLIVAGANT',
    'pdp.notFoundEyebrow': 'NOT FOUND',
    'pdp.soldOutOption': ' (sold out)',
    'pdp.addedSheetTitle': 'Added to cart',
    'pdp.addedSheetBody': 'Keep browsing, or go to checkout.',
    'pdp.continueShopping': 'Keep browsing',
    'pdp.checkout': 'Checkout',

    'pyramid.title': 'SCENT PYRAMID',
    'pyramid.topCaption': 'Opening · lifts first',
    'pyramid.heartCaption': 'Heart · the character',
    'pyramid.baseCaption': 'Base · the longest trail',
    'pyramid.strengthLabel': '{tier} strength: {percent} percent',

    'price.memberTier': 'Member price',
    'price.resellerTier': 'Reseller price',
    'price.memberIs': 'Member {price}',
    'price.saveShort': 'save {amount}',
    'price.save': 'Save {amount}',
    'price.signInGoogle': 'Sign in with Google',

    'stock.one': '1 bottle left',
    'stock.many': '{count} bottles left',

    'export.heading': 'Shipping outside Indonesia',
    'export.priceLine': 'International price:',
    'export.notIncluded': '— shipping not included.',
    'export.ask': 'Ask about shipping to my country',

    'catalog.tab': 'Collection - SOLIVAGANT',
    'catalog.eyebrow': 'THE FRAGRANCE COLLECTION',
    'catalog.title': 'Collection',
    'catalog.lead': 'Limited perfume objects and quiet everyday signatures from the atelier.',
    'catalog.searchPlaceholder': 'Search notes, mood, or name...',
    'catalog.searchLabel': 'Search fragrances by name, notes, or mood',
    'catalog.all': 'All',
    'catalog.soldOutShort': 'Sold out',
    'catalog.outOfStockToast': '{name} is out of stock',
    'catalog.addAria': 'Add {name} to cart',
    'catalog.soldOutAria': '{name} is sold out',
    'catalog.noMatchEyebrow': 'NOTHING HERE',
    'catalog.noMatch': 'No fragrance matches these filters.',
    'catalog.notLoadedEyebrow': 'COLLECTION NOT LOADED',
    'catalog.notLoaded': 'The collection could not be loaded. Please reload the page in a moment.',
    'catalog.noMatchMobile': 'No fragrance matches.',
    'catalog.notLoadedMobile': 'The catalogue could not be loaded.',
    'catalog.wearHeading': 'What will you wear it for?',
    'catalog.filterBy': 'Filter by {facet}',
    'catalog.category': 'category',
    'catalog.quickAdd': 'Add',
    'catalog.added': 'Added',

    'wear.occasions': 'Occasion',
    'wear.occasions.kerja': 'Work',
    'wear.occasions.santai': 'Everyday',
    'wear.occasions.malam': 'A special evening',
    'wear.occasions.perayaan': 'Celebration',
    'wear.occasions.perjalanan': 'Travel',
    'wear.times': 'Time of day',
    'wear.times.pagi': 'Morning',
    'wear.times.siang': 'Midday',
    'wear.times.sore': 'Late afternoon',
    'wear.times.malam': 'Night',
    'wear.weather': 'Weather',
    'wear.weather.panas': 'Hot',
    'wear.weather.hujan': 'Rain',
    'wear.weather.sejuk': 'Cool',

    'stale.body': 'We could not reach the server, so this catalogue is being shown from your device. Its prices and descriptions may be out of date.',
    'stale.retry': 'Try again',
  },
};

export const MESSAGE_KEYS = Object.keys(MESSAGES.id);

/**
 * @param region 'id' | 'en'
 * @param key    a key from MESSAGES.id
 * @param vars   values for {placeholders}
 *
 * Falls back to Indonesian, then to the key itself. A raw key reaching the screen is a visible bug the
 * guard should already have caught — but it is still better than an empty button.
 */
export const translate = (region, key, vars = null) => {
  const text = MESSAGES[region]?.[key] ?? MESSAGES.id?.[key] ?? key;
  if (!vars) return text;
  return String(text).replace(/\{(\w+)\}/g, (whole, name) => (
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole
  ));
};
