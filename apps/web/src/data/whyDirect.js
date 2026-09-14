// Why buy here rather than on a marketplace — the four things a marketplace cannot offer.
//
// The greeting card in every parcel sends buyers to this site; this is what the site says to them once
// they arrive. Pure data, rendered by one component on both homes so the two never drift. Paths are
// desktop; the component prefixes /mobile when it needs to.
//
// The WhatsApp reason carries no number. The number lives in ONE place (VITE_STOREFRONT_WHATSAPP_NUMBER,
// read through getStorefrontWhatsAppNumber) and the component builds the link — a second copy of the
// number is how the collaboration button on the home page ended up hardcoding it.

export const WHY_DIRECT_REASONS = [
  {
    key: 'member',
    title: 'Harga member',
    body: 'Masuk dengan Google dan setiap harga di katalog turun. Potongan yang biasanya jadi biaya marketplace, di sini jadi milikmu.',
    to: '/customer',
    cta: 'Masuk',
  },
  {
    key: 'atelier',
    title: 'Langsung dari perfumer',
    body: 'Diracik dan dikemas di atelier oleh Dekito sendiri. Tidak lewat gudang, tidak lewat reseller.',
    to: '/bespoke',
    cta: 'Bespoke ritual',
  },
  {
    key: 'first',
    title: 'Lebih dulu tahu',
    body: 'Koleksi baru, ukuran khusus, dan kartu ucapan di tiap paket — hanya untuk yang memesan langsung.',
    to: '/catalog',
    cta: 'Lihat koleksi',
  },
  {
    key: 'whatsapp',
    title: 'Tanya langsung',
    body: 'Ragu antara dua aroma, atau mau tanya stok? WhatsApp atelier dibalas oleh orang yang meraciknya.',
    whatsapp: true,
    cta: 'Chat WhatsApp',
  },
];
