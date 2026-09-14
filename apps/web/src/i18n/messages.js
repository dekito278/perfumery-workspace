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
