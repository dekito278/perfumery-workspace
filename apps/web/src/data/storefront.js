export const storefrontCategories = [
  {
    name: 'Fresh',
    description: 'Citrus, aquatic, and clean daily wear.',
    accent: 'bg-[#f7f1e5] text-[#1b1a16] border-[#1b1a16]/15',
  },
  {
    name: 'Floral',
    description: 'Soft petals, jasmine, rose, and powdery musk.',
    accent: 'bg-[#f4f2ec] text-[#1b1a16] border-[#1b1a16]/15',
  },
  {
    name: 'Woody',
    description: 'Sandalwood, cedar, vetiver, and warm drydown.',
    accent: 'bg-[#e7ebe1] text-[#1b1a16] border-[#1b1a16]/15',
  },
  {
    name: 'Gourmand',
    description: 'Vanilla, tonka, coffee, and edible warmth.',
    accent: 'bg-[#fffaf0] text-[#1b1a16] border-[#1b1a16]/15',
  },
];

export const storefrontSegments = [
  {
    name: 'Parfum reguler',
    description: 'Produk ready stock yang bisa dibeli kapan saja selama stok tersedia.',
    filter: 'regular',
  },
  {
    name: 'Parfum terbatas',
    description: 'Drop kecil, seasonal, atau batch khusus dengan jumlah terbatas.',
    filter: 'limited',
  },
  {
    name: 'Layanan custom',
    description: 'Custom perfume berbasis cerita, preferensi aroma, dan konsultasi personal.',
    filter: 'bespoke',
  },
];

export const perfumerProfile = {
  name: 'Dekito',
  title: 'Perfumer and fragrance developer with 4+ years of experience.',
  intro: 'Dekito is the perfumer behind Solivagant, focused on aroma chemicals, fine fragrance formulation, and ready-to-wear perfume built with stability, character, and commercial wearability in mind.',
  specialties: [],
  note: 'Personal profile for the perfumer behind Solivagant.',
  experienceSummary: 'More than 4 years of experience developing fragrance formulas, perfume sprays, and market-ready scent profiles.',
  experience: [
    {
      company: 'Soli Parfum',
      role: 'Perfumer',
      highlights: [
        'Developed fine fragrance formulas for commercial use.',
        'Created perfume spray and ready-to-sell perfume with stability and aroma quality standards.',
        'Adjusted scent character based on market trends and customer preferences.',
        'Blended raw materials to create signature scent profiles.',
      ],
    },
    {
      company: 'Eco Fragranica',
      role: 'Perfumer / Fragrance Developer',
      highlights: [
        'Worked intensively with aroma chemicals to build consistent and scalable fragrance compositions.',
        'Used synthetic and compound raw materials across fragrance development.',
        'Handled olfactory evaluation and formula refinement.',
        'Contributed to production from formulation stage to finished perfume.',
        'Experimented with and developed new scent variants.',
      ],
    },
  ],
};

export const feedbackFlowSteps = [
  {
    title: 'Try',
    description: 'Customer mencoba produk, sample, atau hasil bespoke.',
  },
  {
    title: 'Share feedback',
    description: 'Feedback dikumpulkan dari scent impression, longevity, mood, dan reorder intent.',
  },
  {
    title: 'Refine',
    description: 'Masukan dipakai untuk batch berikutnya atau revisi custom perfume.',
  },
];

export const featuredProducts = [
  {
    id: 'dk-01',
    slug: 'santal-morn',
    name: 'Santal Morn',
    category: 'Woody',
    price: 'Rp 289.000',
    priceNumber: 289000,
    size: '30 ml',
    notes: 'Sandalwood, bergamot, soft musk',
    topNotes: ['Bergamot', 'Cardamom'],
    heartNotes: ['Sandalwood', 'Iris'],
    baseNotes: ['Soft musk', 'Cedarwood'],
    mood: 'Quiet daily signature',
    description: 'A clean woody perfume with creamy sandalwood and a soft musky finish. Easy to wear for office, dinner, and daily rituals.',
    concentration: 'Eau de Parfum',
    stock: 12,
    variants: ['10 ml', '30 ml', '50 ml'],
    tags: ['Unisex', 'Daily', 'Soft woody'],
    intensity: 'Medium',
    featured: true,
    popularity: 96,
    visual: 'from-[#f5d78f] via-[#f8efe1] to-[#d7b98b]',
  },
  {
    id: 'dk-02',
    slug: 'petal-smoke',
    name: 'Petal Smoke',
    category: 'Floral',
    price: 'Rp 329.000',
    priceNumber: 329000,
    size: '30 ml',
    notes: 'Rose, pink pepper, amber woods',
    topNotes: ['Pink pepper', 'Mandarin'],
    heartNotes: ['Rose', 'Jasmine petals'],
    baseNotes: ['Amber woods', 'Cashmere musk'],
    mood: 'Warm floral with edge',
    description: 'A modern floral perfume with rose, gentle spice, and a smoky amber-wood base. Elegant without feeling too formal.',
    concentration: 'Eau de Parfum',
    stock: 8,
    variants: ['10 ml', '30 ml'],
    tags: ['Floral', 'Evening', 'Warm'],
    intensity: 'Medium strong',
    featured: true,
    popularity: 91,
    visual: 'from-[#f0b6c2] via-[#fff2f4] to-[#b97f88]',
  },
  {
    id: 'dk-03',
    slug: 'citrus-veil',
    name: 'Citrus Veil',
    category: 'Fresh',
    price: 'Rp 249.000',
    priceNumber: 249000,
    size: '30 ml',
    notes: 'Yuzu, neroli, white tea',
    topNotes: ['Yuzu', 'Lemon zest'],
    heartNotes: ['Neroli', 'White tea'],
    baseNotes: ['Clean musk', 'Light woods'],
    mood: 'Light, crisp, and polished',
    description: 'A fresh citrus scent with airy tea notes and clean musk. Built for humid days and effortless refresh.',
    concentration: 'Eau de Toilette',
    stock: 16,
    variants: ['10 ml', '30 ml', '50 ml'],
    tags: ['Fresh', 'Daytime', 'Clean'],
    intensity: 'Light',
    featured: true,
    popularity: 88,
    visual: 'from-[#a7d8d3] via-[#effaf8] to-[#efd37c]',
  },
  {
    id: 'dk-04',
    slug: 'vanilla-atelier',
    name: 'Vanilla Atelier',
    category: 'Gourmand',
    price: 'Rp 349.000',
    priceNumber: 349000,
    size: '30 ml',
    notes: 'Vanilla bean, tonka, roasted sugar',
    topNotes: ['Almond milk', 'Orange zest'],
    heartNotes: ['Vanilla bean', 'Tonka'],
    baseNotes: ['Roasted sugar', 'Sandalwood'],
    mood: 'Soft gourmand comfort',
    description: 'A smooth gourmand perfume that keeps vanilla polished and wearable, with tonka warmth and a soft woody base.',
    concentration: 'Eau de Parfum',
    stock: 6,
    variants: ['10 ml', '30 ml'],
    tags: ['Sweet', 'Cozy', 'Evening'],
    intensity: 'Medium strong',
    featured: false,
    popularity: 84,
    visual: 'from-[#e6bd82] via-[#fff4df] to-[#b8885b]',
  },
  {
    id: 'dk-05',
    slug: 'fig-linen',
    name: 'Fig Linen',
    category: 'Fresh',
    price: 'Rp 279.000',
    priceNumber: 279000,
    size: '30 ml',
    notes: 'Fig leaf, pear, linen musk',
    topNotes: ['Pear skin', 'Green fig'],
    heartNotes: ['Fig leaf', 'Violet leaf'],
    baseNotes: ['Linen musk', 'Blond woods'],
    mood: 'Green and airy',
    description: 'A fresh green scent inspired by sunlit linen and fig leaves. Minimal, relaxed, and quietly distinctive.',
    concentration: 'Eau de Parfum',
    stock: 10,
    variants: ['10 ml', '30 ml'],
    tags: ['Green', 'Minimal', 'Unisex'],
    intensity: 'Medium',
    featured: false,
    popularity: 79,
    visual: 'from-[#bad7b6] via-[#f6fbf0] to-[#d8c89b]',
  },
  {
    id: 'dk-06',
    slug: 'cedar-rain',
    name: 'Cedar Rain',
    category: 'Woody',
    price: 'Rp 309.000',
    priceNumber: 309000,
    size: '30 ml',
    notes: 'Cedar, vetiver, rain accord',
    topNotes: ['Rain accord', 'Grapefruit'],
    heartNotes: ['Cedarwood', 'Vetiver'],
    baseNotes: ['Moss', 'Mineral amber'],
    mood: 'Cool woody clarity',
    description: 'A crisp woody profile with wet cedar, vetiver, and mineral freshness. Built for people who like clean structure.',
    concentration: 'Eau de Parfum',
    stock: 9,
    variants: ['10 ml', '30 ml', '50 ml'],
    tags: ['Woody', 'Fresh', 'Structured'],
    intensity: 'Medium',
    featured: false,
    popularity: 82,
    visual: 'from-[#9fb8b3] via-[#eef5f2] to-[#8e806d]',
  },
];

export const storefrontStats = [
  { value: String(featuredProducts.length), label: 'Aroma' },
  { value: '4', label: 'Famili aroma' },
  { value: '1:1', label: 'Konsultasi custom' },
];

export const catalogSortOptions = [
  { value: 'featured', label: 'Rekomendasi' },
  { value: 'price-low', label: 'Harga terendah' },
  { value: 'price-high', label: 'Harga tertinggi' },
  { value: 'name', label: 'Nama A-Z' },
];

export const getProductBySlug = (slug) => featuredProducts.find((product) => product.slug === slug);

export const bespokeMoodOptions = [
  'Bersih dan segar',
  'Floral lembut',
  'Woody hangat',
  'Gourmand manis',
  'Gelap dan sensual',
  'Harian profesional',
];

export const bespokeOccasionOptions = [
  'Harian',
  'Kantor',
  'Malam spesial',
  'Pernikahan / acara',
  'Hadiah',
  'Aroma khas',
];

export const bespokeBottleSizeOptions = [
  { value: '30 ml', label: '30 ml', price: 350000 },
  { value: '50 ml', label: '50 ml', price: 500000 },
];

export const bespokeCapDesignOptions = [
  { value: 'Cap biasa', label: 'Cap biasa', price: 0, description: 'Simple, clean, ready stock.' },
  { value: 'Cap batu', label: 'Cap batu', price: 75000, description: 'Statement cap dengan feel natural stone.' },
  { value: 'Cap custom akrilik', label: 'Cap custom akrilik', price: 125000, description: 'Custom color/form acrylic look.' },
];

export const bespokeExoticMaterialOptions = [];

export const bespokeBudgetOptions = [
  'Budget otomatis mengikuti ukuran, cap, dan material tambahan.',
];

export const bespokeSizeOptions = bespokeBottleSizeOptions.map((option) => option.value);

export const bespokeCapOptions = bespokeCapDesignOptions.map((option) => option.value);

export const paymentProviderOptions = [
  {
    value: 'midtrans',
    label: 'Midtrans',
    description: 'VA, QRIS, cards, and e-wallet checkout.',
  },
  {
    value: 'xendit',
    label: 'Xendit',
    description: 'Invoice-style checkout and multiple local payment rails.',
  },
  {
    value: 'manual',
    label: 'Manual confirm',
    description: 'Confirm the order manually before payment.',
  },
];
