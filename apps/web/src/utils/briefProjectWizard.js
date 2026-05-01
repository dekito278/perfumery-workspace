const STAGE_LABELS = {
  top: 'Top',
  middle: 'Middle',
  base: 'Base',
};

const DEFAULT_STAGE_TARGETS = {
  top: {
    preferred_letters: ['C', 'G', 'H', 'F', 'B', 'L', 'M'],
    preferred_functions: ['diffuser', 'modifier', 'support', 'hero'],
    impact_band: 'medium',
    life_range_hours: [2, 24],
  },
  middle: {
    preferred_letters: ['R', 'J', 'M', 'L', 'S', 'F', 'O', 'N'],
    preferred_functions: ['hero', 'bridge', 'support', 'blender', 'modifier'],
    impact_band: 'medium',
    life_range_hours: [10, 96],
  },
  base: {
    preferred_letters: ['W', 'Q', 'X', 'Y', 'V', 'T', 'U'],
    preferred_functions: ['fixative', 'support', 'blender', 'bridge', 'hero'],
    impact_band: 'medium',
    life_range_hours: [36, 240],
  },
};

const IMPACT_BAND_RANK = {
  low: 0,
  medium: 1,
  high: 2,
};

const IMPACT_BAND_LABELS = {
  low: 'Soft impact',
  medium: 'Balanced impact',
  high: 'Strong impact',
};

const TAG_SIGNAL_MAP = {
  citrus: { letters: ['C'], functions: ['diffuser', 'modifier'], impact_band: 'medium', life_hint: [2, 16] },
  sparkling: { letters: ['B', 'C'], functions: ['diffuser'], impact_band: 'high', life_hint: [2, 12] },
  bright: { letters: ['B', 'C', 'L'], functions: ['diffuser', 'modifier'], impact_band: 'high', life_hint: [2, 18] },
  aromatic: { letters: ['H', 'G'], functions: ['diffuser', 'support'], impact_band: 'medium', life_hint: [4, 30] },
  clean: { letters: ['A', 'L', 'M', 'X'], functions: ['blender', 'support'], impact_band: 'low', life_hint: [4, 72] },
  fresh: { letters: ['C', 'G', 'H', 'M'], functions: ['diffuser', 'modifier'], impact_band: 'medium', life_hint: [2, 24] },
  transparent: { letters: ['B', 'L', 'M'], functions: ['bridge', 'blender'], impact_band: 'low', life_hint: [4, 36] },
  watery: { letters: ['B', 'C', 'M'], functions: ['diffuser', 'bridge'], impact_band: 'low', life_hint: [2, 24] },
  mineral: { letters: ['G', 'W', 'X'], functions: ['modifier', 'bridge'], impact_band: 'low', life_hint: [8, 72] },
  fruit: { letters: ['F'], functions: ['hero', 'modifier'], impact_band: 'medium', life_hint: [6, 36] },
  juicy: { letters: ['F'], functions: ['hero', 'modifier'], impact_band: 'high', life_hint: [4, 30] },
  playful: { letters: ['F', 'B'], functions: ['modifier', 'hero'], impact_band: 'high', life_hint: [4, 24] },
  green: { letters: ['G', 'H'], functions: ['modifier', 'support'], impact_band: 'medium', life_hint: [4, 36] },
  crisp: { letters: ['G', 'C', 'M'], functions: ['diffuser', 'modifier'], impact_band: 'medium', life_hint: [2, 18] },
  leafy: { letters: ['G', 'H'], functions: ['modifier', 'bridge'], impact_band: 'medium', life_hint: [4, 36] },
  stemmy: { letters: ['G', 'S'], functions: ['modifier'], impact_band: 'medium', life_hint: [4, 30] },
  spice: { letters: ['S', 'P'], functions: ['modifier', 'hero'], impact_band: 'medium', life_hint: [8, 96] },
  airy: { letters: ['B', 'L', 'M'], functions: ['diffuser', 'bridge'], impact_band: 'low', life_hint: [2, 18] },
  lift: { letters: ['B', 'C', 'L'], functions: ['diffuser'], impact_band: 'high', life_hint: [2, 18] },
  petal: { letters: ['R', 'M', 'J'], functions: ['hero', 'bridge'], impact_band: 'medium', life_hint: [6, 72] },
  floral: { letters: ['J', 'L', 'M', 'N', 'R'], functions: ['hero', 'bridge', 'support'], impact_band: 'medium', life_hint: [8, 96] },
  rose: { letters: ['R'], functions: ['hero', 'bridge'], impact_band: 'medium', life_hint: [10, 120] },
  white_floral: { letters: ['J', 'M', 'N'], functions: ['hero', 'support'], impact_band: 'medium', life_hint: [10, 120] },
  tea: { letters: ['H', 'M', 'L'], functions: ['bridge', 'modifier'], impact_band: 'low', life_hint: [6, 48] },
  powder: { letters: ['I', 'X'], functions: ['blender', 'support'], impact_band: 'low', life_hint: [18, 120] },
  soft: { letters: ['L', 'M', 'X'], functions: ['blender', 'support'], impact_band: 'low', life_hint: [6, 72] },
  silky: { letters: ['L', 'M', 'X'], functions: ['bridge', 'blender'], impact_band: 'low', life_hint: [10, 84] },
  textural: { letters: ['S', 'W', 'Y'], functions: ['bridge', 'support'], impact_band: 'medium', life_hint: [12, 132] },
  round: { letters: ['D', 'L', 'V'], functions: ['blender', 'support'], impact_band: 'medium', life_hint: [12, 96] },
  warm: { letters: ['Q', 'V', 'W'], functions: ['support', 'hero'], impact_band: 'medium', life_hint: [18, 168] },
  creamy: { letters: ['D', 'V', 'W'], functions: ['blender', 'support'], impact_band: 'medium', life_hint: [18, 144] },
  milky: { letters: ['D', 'V'], functions: ['blender', 'support'], impact_band: 'low', life_hint: [18, 120] },
  sandalwood: { letters: ['W'], functions: ['support', 'fixative', 'bridge'], impact_band: 'medium', life_hint: [36, 240] },
  vanilla: { letters: ['V'], functions: ['support', 'blender'], impact_band: 'medium', life_hint: [30, 240] },
  cedar: { letters: ['W'], functions: ['support', 'fixative'], impact_band: 'medium', life_hint: [30, 240] },
  vetiver: { letters: ['W', 'Y'], functions: ['support', 'fixative'], impact_band: 'medium', life_hint: [30, 240] },
  woody: { letters: ['W', 'Y'], functions: ['support', 'fixative', 'bridge'], impact_band: 'medium', life_hint: [24, 240] },
  structured: { letters: ['W', 'Q'], functions: ['support', 'bridge'], impact_band: 'medium', life_hint: [24, 200] },
  amber: { letters: ['Q', 'V'], functions: ['support', 'fixative', 'hero'], impact_band: 'medium', life_hint: [30, 240] },
  resin: { letters: ['Q', 'T'], functions: ['support', 'fixative'], impact_band: 'medium', life_hint: [30, 240] },
  musk: { letters: ['X'], functions: ['fixative', 'blender', 'support'], impact_band: 'low', life_hint: [36, 240] },
  skin: { letters: ['X', 'I'], functions: ['blender', 'support'], impact_band: 'low', life_hint: [24, 240] },
  patchouli: { letters: ['Y', 'W', 'Q'], functions: ['hero', 'fixative', 'support'], impact_band: 'medium', life_hint: [36, 240] },
  earthy: { letters: ['Y'], functions: ['support', 'fixative'], impact_band: 'low', life_hint: [36, 240] },
  dark: { letters: ['Y', 'T', 'Q'], functions: ['hero', 'fixative'], impact_band: 'medium', life_hint: [36, 240] },
  oud: { letters: ['T', 'W', 'Q'], functions: ['hero', 'fixative', 'support'], impact_band: 'high', life_hint: [36, 240] },
  smoky: { letters: ['T', 'Q'], functions: ['hero', 'modifier'], impact_band: 'medium', life_hint: [24, 240] },
  balsamic: { letters: ['Q', 'V', 'T'], functions: ['support', 'fixative'], impact_band: 'medium', life_hint: [30, 240] },
  radiant: { letters: ['B', 'J', 'V'], functions: ['hero', 'diffuser'], impact_band: 'high', life_hint: [6, 72] },
  persistent: { functions: ['fixative', 'support'], impact_band: 'medium', life_hint: [72, 240] },
  tenacious: { functions: ['fixative', 'support'], impact_band: 'medium', life_hint: [72, 240] },
  projecting: { functions: ['diffuser', 'hero'], impact_band: 'high', life_hint: [4, 36] },
  controlled: { functions: ['bridge', 'blender', 'support'], impact_band: 'medium', life_hint: [12, 96] },
  balanced: { functions: ['bridge', 'support', 'blender'], impact_band: 'medium', life_hint: [12, 120] },
  lush: { functions: ['hero', 'support'], impact_band: 'high', life_hint: [18, 144] },
  sheer: { functions: ['diffuser', 'bridge'], impact_band: 'low', life_hint: [4, 36] },
  intimate: { functions: ['blender', 'support'], impact_band: 'low', life_hint: [8, 96] },
};

const createOption = (value, label, { tags = [], hint = '', signal = null } = {}) => ({
  value,
  label,
  tags,
  hint,
  signal,
});

const createQuestion = (id, title, description, optionsByBranch, defaultBranch = 'default') => ({
  id,
  title,
  description,
  optionsByBranch,
  defaultBranch,
});

const questionBank = {
  top: [
    createQuestion('objective', 'Opening goal', 'Tentukan kesan pertama yang ingin langsung terasa saat parfum dibuka.', {
      default: [
        createOption('sparkling_welcome', 'Sparkling and attention-grabbing', {
          tags: ['sparkling', 'bright', 'lift'],
          hint: 'Cocok untuk opening yang langsung terasa hidup dan naik.',
          signal: { impact_band: 'high', life_range_hours: [2, 12], preferred_functions: ['diffuser', 'hero'] },
        }),
        createOption('clean_fresh', 'Clean and freshly polished', {
          tags: ['clean', 'fresh', 'transparent'],
          hint: 'Mengarahkan opening jadi rapi, bersih, dan modern.',
          signal: { impact_band: 'medium', life_range_hours: [4, 18], preferred_functions: ['diffuser', 'bridge'] },
        }),
        createOption('soft_elegant', 'Soft and elegant', {
          tags: ['soft', 'airy', 'sheer'],
          hint: 'Lebih halus, tidak terlalu meledak di awal.',
          signal: { impact_band: 'low', life_range_hours: [4, 20], preferred_functions: ['bridge', 'support'] },
        }),
        createOption('green_natural', 'Green and naturally alive', {
          tags: ['green', 'leafy', 'fresh'],
          hint: 'Membuka kesan natural, airy, dan hidup.',
          signal: { impact_band: 'medium', life_range_hours: [4, 24], preferred_letters: ['G', 'H'] },
        }),
      ],
    }),
    createQuestion('impact_preference', 'Opening impact', 'Seberapa besar Anda ingin opening ini terasa di semprotan awal.', {
      default: [
        createOption('soft', 'Soft and close', {
          tags: ['soft', 'controlled', 'intimate'],
          hint: 'Tetap terasa, tapi tidak terlalu menyambar.',
          signal: { impact_band: 'low' },
        }),
        createOption('balanced', 'Balanced and noticeable', {
          tags: ['balanced', 'clean'],
          hint: 'Terasa jelas, tetapi masih aman dan rapi.',
          signal: { impact_band: 'medium' },
        }),
        createOption('strong', 'Strong and projecting', {
          tags: ['projecting', 'radiant', 'bright'],
          hint: 'Mendorong material opening yang punya lift lebih besar.',
          signal: { impact_band: 'high' },
        }),
      ],
    }),
    createQuestion('lifetime_preference', 'Opening lifetime', 'Berapa lama Anda ingin nuansa opening ini masih terasa before heart mengambil alih.', {
      default: [
        createOption('short', 'Quick sparkle', {
          tags: ['sparkling', 'sheer'],
          hint: 'Sekitar 2-8 jam, cepat memberi lift lalu turun.',
          signal: { life_range_hours: [2, 8] },
        }),
        createOption('balanced', 'Balanced transition', {
          tags: ['balanced', 'fresh'],
          hint: 'Sekitar 6-18 jam, masih terasa cukup lama.',
          signal: { life_range_hours: [6, 18] },
        }),
        createOption('lasting', 'Longer opening presence', {
          tags: ['persistent', 'radiant'],
          hint: 'Sekitar 12-30 jam untuk opening yang lebih tahan tinggal.',
          signal: { life_range_hours: [12, 30] },
        }),
      ],
    }),
    createQuestion('family', 'Opening tone', 'Pilih keluarga aroma yang paling mendekati arah brief untuk top notes.', {
      default: [
        createOption('sparkling_citrus', 'Sparkling citrus', {
          tags: ['citrus', 'sparkling', 'bright'],
          hint: 'Bergamot, lemon, yuzu, dan efek peel yang hidup.',
        }),
        createOption('clean_aromatic', 'Clean aromatic', {
          tags: ['aromatic', 'clean', 'fresh'],
          hint: 'Aromatik segar dengan kesan rapi dan wearable.',
        }),
        createOption('juicy_fruity', 'Juicy fruit', {
          tags: ['fruit', 'juicy', 'playful'],
          hint: 'Membuka dengan nuansa buah yang terasa fresh dan modern.',
        }),
        createOption('crisp_green', 'Crisp green', {
          tags: ['green', 'crisp', 'fresh'],
          hint: 'Lebih leafy, bitter-green, atau snapped stem.',
        }),
        createOption('airy_spice', 'Airy spice', {
          tags: ['spice', 'airy', 'lift'],
          hint: 'Spice ringan yang memberi kilau di pembukaan.',
        }),
        createOption('petal_fresh', 'Petal fresh', {
          tags: ['petal', 'floral', 'lift'],
          hint: 'Soft floral opening tanpa langsung masuk heart terlalu berat.',
        }),
        createOption('watery_citrus', 'Watery citrus', {
          tags: ['watery', 'citrus', 'transparent'],
          hint: 'Citrus yang lebih sheer, dingin, dan cair.',
        }),
        createOption('tea_green', 'Tea green', {
          tags: ['tea', 'green', 'airy'],
          hint: 'Memberi kesan refined, ringan, dan sedikit herbal.',
        }),
      ],
    }),
    createQuestion('nuance', 'Opening texture', 'Detailkan tekstur opening supaya pilihan material lebih kaya dan tidak berulang.', {
      sparkling_citrus: [
        createOption('zesty_peel', 'Zesty peel', { tags: ['citrus', 'bright', 'dry'] }),
        createOption('cold_sparkle', 'Cold sparkle', { tags: ['sparkling', 'clean', 'watery'] }),
        createOption('sunlit_citrus', 'Sunlit citrus', { tags: ['bright', 'soft', 'warm'] }),
        createOption('neroli_twist', 'Neroli twist', { tags: ['petal', 'citrus', 'radiant'] }),
      ],
      clean_aromatic: [
        createOption('lavender_clean', 'Lavender clean', { tags: ['aromatic', 'clean', 'soft'] }),
        createOption('herbal_breeze', 'Herbal breeze', { tags: ['herbal', 'airy', 'fresh'] }),
        createOption('tea_crisp', 'Tea crisp', { tags: ['tea', 'crisp', 'sheer'] }),
        createOption('rosemary_lift', 'Rosemary lift', { tags: ['aromatic', 'lift', 'green'] }),
      ],
      juicy_fruity: [
        createOption('pear_fresh', 'Pear fresh', { tags: ['fruit', 'watery', 'fresh'] }),
        createOption('berry_glow', 'Berry glow', { tags: ['fruit', 'bright', 'soft'] }),
        createOption('stonefruit_velvet', 'Stonefruit velvet', { tags: ['fruit', 'round', 'soft'] }),
        createOption('cassis_pop', 'Cassis pop', { tags: ['fruit', 'green', 'projecting'] }),
      ],
      crisp_green: [
        createOption('leaf_snap', 'Leaf snap', { tags: ['leafy', 'green', 'crisp'] }),
        createOption('stem_bite', 'Stem bite', { tags: ['stemmy', 'green', 'dry'] }),
        createOption('galbanum_air', 'Galbanum air', { tags: ['green', 'airy', 'bright'] }),
        createOption('tea_leaf_cool', 'Tea leaf cool', { tags: ['tea', 'leafy', 'transparent'] }),
      ],
      airy_spice: [
        createOption('pink_pepper_glow', 'Pink pepper glow', { tags: ['spice', 'sparkling', 'rosy'] }),
        createOption('cardamom_cool', 'Cardamom cool', { tags: ['spice', 'cool', 'lift'] }),
        createOption('saffron_sheer', 'Saffron sheer', { tags: ['spice', 'dry', 'sheer'] }),
        createOption('ginger_fizz', 'Ginger fizz', { tags: ['spice', 'sparkling', 'watery'] }),
      ],
      petal_fresh: [
        createOption('dewy_petals', 'Dewy petals', { tags: ['petal', 'dewy', 'fresh'] }),
        createOption('powder_petals', 'Powder petals', { tags: ['powder', 'petal', 'soft'] }),
        createOption('rose_water_air', 'Rose water air', { tags: ['rose', 'airy', 'clean'] }),
        createOption('white_blossom_air', 'White blossom air', { tags: ['white_floral', 'transparent', 'lift'] }),
      ],
      watery_citrus: [
        createOption('yuzu_water', 'Yuzu water', { tags: ['watery', 'citrus', 'bright'] }),
        createOption('bergamot_mist', 'Bergamot mist', { tags: ['citrus', 'transparent', 'clean'] }),
        createOption('neroli_splash', 'Neroli splash', { tags: ['petal', 'watery', 'radiant'] }),
        createOption('lime_ice', 'Lime ice', { tags: ['citrus', 'cold', 'sparkling'] }),
      ],
      tea_green: [
        createOption('green_tea_sheer', 'Green tea sheer', { tags: ['tea', 'sheer', 'transparent'] }),
        createOption('mate_breeze', 'Mate breeze', { tags: ['green', 'airy', 'textural'] }),
        createOption('jasmine_tea', 'Jasmine tea', { tags: ['tea', 'floral', 'clean'] }),
        createOption('oolong_lift', 'Oolong lift', { tags: ['tea', 'bright', 'soft'] }),
      ],
      default: [
        createOption('clear_lift', 'Clear lift', { tags: ['clear', 'lift'] }),
      ],
    }),
  ],
  middle: [
    createQuestion('objective', 'Heart role', 'Tentukan peran utama heart: apakah mau jadi identitas utama, jembatan, atau body pendukung.', {
      default: [
        createOption('signature_heart', 'Main signature identity', {
          tags: ['floral', 'balanced', 'hero'],
          hint: 'Heart menjadi wajah utama parfum.',
          signal: { preferred_functions: ['hero', 'bridge'], impact_band: 'medium', life_range_hours: [18, 96] },
        }),
        createOption('soft_body', 'Soft body and volume', {
          tags: ['soft', 'silky', 'round'],
          hint: 'Menambah body dan continuity tanpa terlalu dominan.',
          signal: { preferred_functions: ['support', 'blender'], impact_band: 'low', life_range_hours: [16, 96] },
        }),
        createOption('radiant_floral', 'Radiant floral bloom', {
          tags: ['radiant', 'floral', 'lush'],
          hint: 'Lebih berani, lebih berbunga, lebih terasa.',
          signal: { preferred_functions: ['hero', 'support'], impact_band: 'high', life_range_hours: [18, 120] },
        }),
        createOption('textured_bridge', 'Textured bridge to base', {
          tags: ['textural', 'woody', 'balanced'],
          hint: 'Menyambungkan heart ke drydown dengan lebih rapat.',
          signal: { preferred_functions: ['bridge', 'support'], impact_band: 'medium', life_range_hours: [20, 132] },
        }),
      ],
    }),
    createQuestion('impact_preference', 'Heart impact', 'Seberapa dominan heart yang Anda mau rasakan di tubuh parfum.', {
      default: [
        createOption('soft', 'Soft and close', {
          tags: ['soft', 'intimate'],
          signal: { impact_band: 'low' },
        }),
        createOption('balanced', 'Balanced and signature-ready', {
          tags: ['balanced', 'controlled'],
          signal: { impact_band: 'medium' },
        }),
        createOption('rich', 'Rich and expressive', {
          tags: ['lush', 'radiant', 'projecting'],
          signal: { impact_band: 'high' },
        }),
      ],
    }),
    createQuestion('lifetime_preference', 'Heart lifetime', 'Tentukan seberapa panjang bagian heart ini ingin bertahan sebelum base sepenuhnya mendominasi.', {
      default: [
        createOption('moderate', 'Moderate heart arc', {
          tags: ['balanced'],
          hint: 'Sekitar 10-36 jam.',
          signal: { life_range_hours: [10, 36] },
        }),
        createOption('long', 'Long heart presence', {
          tags: ['persistent', 'balanced'],
          hint: 'Sekitar 24-72 jam.',
          signal: { life_range_hours: [24, 72] },
        }),
        createOption('very_long', 'Extended heart trail', {
          tags: ['persistent', 'tenacious'],
          hint: 'Sekitar 48-120 jam.',
          signal: { life_range_hours: [48, 120] },
        }),
      ],
    }),
    createQuestion('family', 'Heart identity', 'Pilih keluarga aroma utama yang akan membentuk karakter middle.', {
      default: [
        createOption('rose_petals', 'Rose petal', { tags: ['rose', 'petal', 'floral'], hint: 'Rose heart yang bisa natural, modern, atau sedikit spicy.' }),
        createOption('clean_floral', 'Clean floral', { tags: ['floral', 'clean', 'transparent'], hint: 'Floral yang rapi dan wearable.' }),
        createOption('creamy_floral', 'Creamy floral', { tags: ['creamy', 'floral', 'round'], hint: 'Lebih penuh, halus, dan menyatu.' }),
        createOption('spicy_floral', 'Spiced floral', { tags: ['spice', 'floral', 'warm'], hint: 'Heart dengan aksen spice yang memberi karakter.' }),
        createOption('fruity_floral', 'Fruity floral', { tags: ['fruit', 'floral', 'juicy'], hint: 'Floral yang terasa lebih youthful dan modern.' }),
        createOption('woody_floral', 'Woody floral', { tags: ['woody', 'floral', 'textural'], hint: 'Menyambungkan floral dengan base lebih cepat.' }),
        createOption('white_floral', 'White floral', { tags: ['white_floral', 'radiant', 'floral'], hint: 'Tuberose, jasmine, orange blossom, dan sejenisnya.' }),
        createOption('powder_floral', 'Powder floral', { tags: ['powder', 'soft', 'floral'], hint: 'Nuansa makeup, iris, atau cloud-like softness.' }),
      ],
    }),
    createQuestion('nuance', 'Heart texture', 'Tambahkan detail tekstur supaya hasil generate lebih kaya dan tidak mengulang kandidat serupa.', {
      rose_petals: [
        createOption('fresh_rose', 'Fresh rose', { tags: ['rose', 'fresh', 'petal'] }),
        createOption('jammy_rose', 'Jammy rose', { tags: ['rose', 'warm', 'round'] }),
        createOption('dry_rose', 'Dry rose', { tags: ['rose', 'dry', 'spice'] }),
        createOption('rose_suede', 'Rose suede', { tags: ['rose', 'silky', 'textural'] }),
      ],
      clean_floral: [
        createOption('soapy_white', 'Soapy white floral', { tags: ['clean', 'white_floral', 'soft'] }),
        createOption('tea_floral', 'Tea floral', { tags: ['tea', 'floral', 'airy'] }),
        createOption('aldehydic_floral', 'Aldehydic floral', { tags: ['bright', 'floral', 'clean'] }),
        createOption('linen_petals', 'Linen petals', { tags: ['clean', 'transparent', 'soft'] }),
      ],
      creamy_floral: [
        createOption('milky_petals', 'Milky petals', { tags: ['milky', 'petal', 'soft'] }),
        createOption('sandal_floral', 'Sandal floral', { tags: ['sandalwood', 'creamy', 'floral'] }),
        createOption('vanillic_floral', 'Vanillic floral', { tags: ['vanilla', 'creamy', 'floral'] }),
        createOption('suede_petals', 'Suede petals', { tags: ['creamy', 'textural', 'warm'] }),
      ],
      spicy_floral: [
        createOption('clove_rose', 'Clove rose', { tags: ['spice', 'rose', 'warm'] }),
        createOption('pepper_petals', 'Pepper petals', { tags: ['pepper', 'petal', 'dry'] }),
        createOption('saffron_rose', 'Saffron rose', { tags: ['saffron', 'rose', 'dry'] }),
        createOption('cinnamon_bloom', 'Cinnamon bloom', { tags: ['spice', 'warm', 'round'] }),
      ],
      fruity_floral: [
        createOption('berry_rose', 'Berry rose', { tags: ['berry', 'rose', 'lush'] }),
        createOption('lychee_floral', 'Lychee floral', { tags: ['fruit', 'floral', 'bright'] }),
        createOption('peach_petals', 'Peach petals', { tags: ['fruit', 'petal', 'round'] }),
        createOption('plum_blossom', 'Plum blossom', { tags: ['fruit', 'floral', 'textural'] }),
      ],
      woody_floral: [
        createOption('cedar_rose', 'Cedar rose', { tags: ['cedar', 'rose', 'dry'] }),
        createOption('cashmere_floral', 'Cashmere floral', { tags: ['woody', 'soft', 'floral'] }),
        createOption('vetiver_floral', 'Vetiver floral', { tags: ['vetiver', 'floral', 'textural'] }),
        createOption('sandal_iris', 'Sandal iris', { tags: ['sandalwood', 'powder', 'silky'] }),
      ],
      white_floral: [
        createOption('solar_tuberose', 'Solar tuberose', { tags: ['white_floral', 'radiant', 'lush'] }),
        createOption('jasmine_satin', 'Jasmine satin', { tags: ['white_floral', 'silky', 'balanced'] }),
        createOption('orange_blossom_creme', 'Orange blossom creme', { tags: ['white_floral', 'creamy', 'bright'] }),
        createOption('gardenia_milk', 'Gardenia milk', { tags: ['white_floral', 'milky', 'round'] }),
      ],
      powder_floral: [
        createOption('iris_suede', 'Iris suede', { tags: ['powder', 'silky', 'textural'] }),
        createOption('heliotrope_soft', 'Heliotrope soft', { tags: ['powder', 'creamy', 'round'] }),
        createOption('violet_mist', 'Violet mist', { tags: ['powder', 'transparent', 'airy'] }),
        createOption('makeup_cloud', 'Makeup cloud', { tags: ['powder', 'soft', 'clean'] }),
      ],
      default: [
        createOption('balanced_theme', 'Balanced theme', { tags: ['balanced', 'heart'] }),
      ],
    }),
    createQuestion('body', 'Heart body', 'Tentukan volume dan kepadatan area middle.', {
      default: [
        createOption('airy', 'Airy', { tags: ['airy', 'sheer'], signal: { impact_band: 'low' } }),
        createOption('transparent', 'Transparent', { tags: ['transparent', 'clean'], signal: { impact_band: 'low' } }),
        createOption('balanced', 'Balanced', { tags: ['balanced', 'body'], signal: { impact_band: 'medium' } }),
        createOption('silky', 'Silky', { tags: ['silky', 'round'], signal: { impact_band: 'medium' } }),
        createOption('textural', 'Textured', { tags: ['textural', 'woody'], signal: { impact_band: 'medium' } }),
        createOption('lush', 'Lush', { tags: ['lush', 'full'], signal: { impact_band: 'high' } }),
      ],
    }),
  ],
  base: [
    createQuestion('objective', 'Base role', 'Tentukan fungsi utama drydown agar generate material lebih sesuai ekspektasi.', {
      default: [
        createOption('clean_trail', 'Clean and supportive trail', {
          tags: ['clean', 'skin', 'balanced'],
          hint: 'Base bekerja rapi untuk menopang keseluruhan formula.',
          signal: { preferred_functions: ['support', 'blender'], impact_band: 'low', life_range_hours: [36, 144] },
        }),
        createOption('comfort_body', 'Comfort and creamy body', {
          tags: ['creamy', 'warm', 'round'],
          hint: 'Drydown lebih hangat, lembut, dan nyaman.',
          signal: { preferred_functions: ['support', 'bridge'], impact_band: 'medium', life_range_hours: [48, 180] },
        }),
        createOption('structured_backbone', 'Structured woody backbone', {
          tags: ['woody', 'structured', 'textural'],
          hint: 'Memberi rangka drydown yang lebih tegas.',
          signal: { preferred_functions: ['support', 'fixative'], impact_band: 'medium', life_range_hours: [48, 220] },
        }),
        createOption('deep_signature', 'Deep signature and persistence', {
          tags: ['persistent', 'dark', 'tenacious'],
          hint: 'Untuk drydown yang lebih hadir dan lebih lama.',
          signal: { preferred_functions: ['hero', 'fixative'], impact_band: 'high', life_range_hours: [72, 240] },
        }),
      ],
    }),
    createQuestion('impact_preference', 'Drydown impact', 'Seberapa besar jejak base yang Anda ingin tinggalkan.', {
      default: [
        createOption('soft', 'Soft skin trail', {
          tags: ['soft', 'skin', 'intimate'],
          signal: { impact_band: 'low' },
        }),
        createOption('balanced', 'Balanced drydown', {
          tags: ['balanced', 'controlled'],
          signal: { impact_band: 'medium' },
        }),
        createOption('strong', 'Present and lasting', {
          tags: ['persistent', 'tenacious', 'projecting'],
          signal: { impact_band: 'high' },
        }),
      ],
    }),
    createQuestion('lifetime_preference', 'Drydown lifetime', 'Berapa lama Anda ingin base ini masih bertahan sebagai jejak utama.', {
      default: [
        createOption('moderate', 'Comfortable wear', {
          tags: ['balanced'],
          hint: 'Sekitar 36-96 jam.',
          signal: { life_range_hours: [36, 96] },
        }),
        createOption('long', 'Long and stable', {
          tags: ['persistent', 'balanced'],
          hint: 'Sekitar 72-180 jam.',
          signal: { life_range_hours: [72, 180] },
        }),
        createOption('very_long', 'Very tenacious', {
          tags: ['persistent', 'tenacious'],
          hint: 'Sekitar 120-240 jam.',
          signal: { life_range_hours: [120, 240] },
        }),
      ],
    }),
    createQuestion('family', 'Base backbone', 'Pilih keluarga material utama yang akan membangun fondasi drydown.', {
      default: [
        createOption('creamy_wood', 'Creamy wood', { tags: ['creamy', 'sandalwood', 'woody'], hint: 'Soft wood yang nyaman dan halus.' }),
        createOption('dry_wood', 'Dry wood', { tags: ['cedar', 'structured', 'woody'], hint: 'Lebih kering, linear, dan tegas.' }),
        createOption('amber_resin', 'Amber resin', { tags: ['amber', 'resin', 'warm'], hint: 'Warm base dengan glow dan density.' }),
        createOption('musk_skin', 'Musk skin', { tags: ['musk', 'skin', 'soft'], hint: 'Untuk skin scent atau clean drydown.' }),
        createOption('earth_patchouli', 'Earthy patchouli', { tags: ['patchouli', 'earthy', 'dark'], hint: 'Lebih grounded dan natural-dark.' }),
        createOption('smoky_oud', 'Smoky oud', { tags: ['oud', 'smoky', 'deep'], hint: 'Drydown lebih mewah dan assertive.' }),
        createOption('balsamic_vanilla', 'Balsamic vanilla', { tags: ['balsamic', 'vanilla', 'round'], hint: 'Comforting, sweet-warm, dan membungkus.' }),
        createOption('mineral_musk_wood', 'Mineral musk wood', { tags: ['mineral', 'musk', 'woody'], hint: 'Clean modern base yang tetap punya struktur.' }),
      ],
    }),
    createQuestion('nuance', 'Base texture', 'Tambahkan tekstur drydown supaya rekomendasi base lebih aktual dan tidak monoton.', {
      creamy_wood: [
        createOption('sandal_soft', 'Sandal soft', { tags: ['sandalwood', 'milky', 'soft'] }),
        createOption('cashmere_warm', 'Cashmere warm', { tags: ['woody', 'warm', 'smooth'] }),
        createOption('vanillic_wood', 'Vanillic wood', { tags: ['vanilla', 'wood', 'creamy'] }),
        createOption('coconut_sandal', 'Coconut sandal', { tags: ['creamy', 'milky', 'sandalwood'] }),
      ],
      dry_wood: [
        createOption('cedar_sharp', 'Cedar sharp', { tags: ['cedar', 'sharp', 'dry'] }),
        createOption('vetiver_dry', 'Vetiver dry', { tags: ['vetiver', 'dry', 'earthy'] }),
        createOption('mineral_wood', 'Mineral wood', { tags: ['mineral', 'woody', 'clean'] }),
        createOption('papyrus_frame', 'Papyrus frame', { tags: ['structured', 'dry', 'textural'] }),
      ],
      amber_resin: [
        createOption('balsamic_glow', 'Balsamic glow', { tags: ['balsamic', 'amber', 'warm'] }),
        createOption('golden_amber', 'Golden amber', { tags: ['amber', 'smooth', 'radiant'] }),
        createOption('incense_resin', 'Incense resin', { tags: ['resin', 'deep', 'smoky'] }),
        createOption('labdanum_veil', 'Labdanum veil', { tags: ['amber', 'resin', 'textural'] }),
      ],
      musk_skin: [
        createOption('clean_skin', 'Clean skin', { tags: ['clean', 'musk', 'skin'] }),
        createOption('cotton_soft', 'Cotton soft', { tags: ['soft', 'musk', 'clean'] }),
        createOption('powder_musk', 'Powder musk', { tags: ['powder', 'musk'] }),
        createOption('velvet_skin', 'Velvet skin', { tags: ['musk', 'silky', 'round'] }),
      ],
      earth_patchouli: [
        createOption('cocoa_patchouli', 'Cocoa patchouli', { tags: ['patchouli', 'dark', 'round'] }),
        createOption('dry_patchouli', 'Dry patchouli', { tags: ['patchouli', 'woody', 'dry'] }),
        createOption('mossy_patchouli', 'Mossy patchouli', { tags: ['patchouli', 'green', 'dark'] }),
        createOption('amber_patchouli', 'Amber patchouli', { tags: ['patchouli', 'amber', 'warm'] }),
      ],
      smoky_oud: [
        createOption('smoke_trace', 'Smoke trace', { tags: ['smoke', 'dry', 'textural'] }),
        createOption('oud_polish', 'Polished oud', { tags: ['oud', 'smooth', 'luxury'] }),
        createOption('resin_oud', 'Resin oud', { tags: ['oud', 'resin', 'dense'] }),
        createOption('suede_oud', 'Suede oud', { tags: ['oud', 'soft', 'textural'] }),
      ],
      balsamic_vanilla: [
        createOption('benzoin_vanilla', 'Benzoin vanilla', { tags: ['balsamic', 'vanilla', 'creamy'] }),
        createOption('tonka_resin', 'Tonka resin', { tags: ['balsamic', 'round', 'warm'] }),
        createOption('amber_balm', 'Amber balm', { tags: ['amber', 'balsamic', 'soft'] }),
        createOption('vanilla_suede', 'Vanilla suede', { tags: ['vanilla', 'silky', 'warm'] }),
      ],
      mineral_musk_wood: [
        createOption('musky_papyrus', 'Musky papyrus', { tags: ['musk', 'structured', 'mineral'] }),
        createOption('cashmere_stone', 'Cashmere stone', { tags: ['woody', 'silky', 'mineral'] }),
        createOption('clean_driftwood', 'Clean driftwood', { tags: ['woody', 'clean', 'transparent'] }),
        createOption('mineral_skin', 'Mineral skin', { tags: ['mineral', 'skin', 'soft'] }),
      ],
      default: [
        createOption('steady_base', 'Steady base', { tags: ['steady', 'base'] }),
      ],
    }),
    createQuestion('tenacity', 'Drydown persistence', 'Pilih karakter persistence akhir yang paling sesuai.', {
      default: [
        createOption('clean', 'Clean and easy', {
          tags: ['clean', 'easy drydown'],
          signal: { impact_band: 'low', life_range_hours: [36, 120] },
        }),
        createOption('balanced', 'Balanced longevity', {
          tags: ['balanced', 'controlled'],
          signal: { impact_band: 'medium', life_range_hours: [60, 180] },
        }),
        createOption('lasting', 'Lasting but smooth', {
          tags: ['persistent', 'balanced'],
          signal: { impact_band: 'medium', life_range_hours: [96, 220] },
        }),
        createOption('persistent', 'Persistent and present', {
          tags: ['persistent', 'tenacious'],
          signal: { impact_band: 'high', life_range_hours: [120, 240] },
        }),
      ],
    }),
  ],
};

const getOptionsForQuestion = (question, answers) => {
  const branchKey = answers?.family || answers?.nuance || question.defaultBranch;
  return question.optionsByBranch[branchKey] || question.optionsByBranch.default || [];
};

const getSelectedOption = (question, value, answers) => (
  getOptionsForQuestion(question, answers).find((option) => option.value === value) || null
);

const clampLifeRange = (stage, range) => {
  const [defaultMin, defaultMax] = DEFAULT_STAGE_TARGETS[stage]?.life_range_hours || [4, 120];
  const [inputMin, inputMax] = Array.isArray(range) ? range : [defaultMin, defaultMax];
  const min = Math.max(0, Number.isFinite(inputMin) ? inputMin : defaultMin);
  const max = Math.max(min, Number.isFinite(inputMax) ? inputMax : defaultMax);
  return [min, max];
};

const mergeImpactBand = (currentBand, nextBand) => {
  if (!nextBand) {
    return currentBand;
  }

  if (!currentBand) {
    return nextBand;
  }

  return IMPACT_BAND_RANK[nextBand] > IMPACT_BAND_RANK[currentBand] ? nextBand : currentBand;
};

const buildPreferenceSet = (values) => [...new Set(values.filter(Boolean))];

const buildStructuredStageIntent = (stage, tags = []) => {
  const defaults = DEFAULT_STAGE_TARGETS[stage] || DEFAULT_STAGE_TARGETS.middle;
  const letters = [...defaults.preferred_letters];
  const functions = [...defaults.preferred_functions];
  let impactBand = defaults.impact_band;
  let lifeRange = [...defaults.life_range_hours];

  tags.forEach((tag) => {
    const signal = TAG_SIGNAL_MAP[String(tag || '').trim().toLowerCase()];
    if (!signal) {
      return;
    }

    letters.push(...(signal.letters || []));
    functions.push(...(signal.functions || []));
    impactBand = mergeImpactBand(impactBand, signal.impact_band || null);

    if (signal.life_hint) {
      const [signalMin, signalMax] = signal.life_hint;
      const [currentMin, currentMax] = lifeRange;
      lifeRange = [
        Math.min(currentMin, signalMin),
        Math.max(currentMax, signalMax),
      ];
    }
  });

  return {
    preferred_letters: buildPreferenceSet(letters),
    preferred_functions: buildPreferenceSet(functions),
    impact_band: impactBand,
    life_range_hours: clampLifeRange(stage, lifeRange),
  };
};

const applySelectedOptionSignals = (stage, intent, options = []) => {
  const nextIntent = {
    preferred_letters: [...(intent.preferred_letters || [])],
    preferred_functions: [...(intent.preferred_functions || [])],
    impact_band: intent.impact_band,
    life_range_hours: [...(intent.life_range_hours || [])],
  };

  options.forEach((option) => {
    const signal = option?.signal || null;
    if (!signal) {
      return;
    }

    if (Array.isArray(signal.preferred_letters)) {
      nextIntent.preferred_letters.push(...signal.preferred_letters);
    }

    if (Array.isArray(signal.preferred_functions)) {
      nextIntent.preferred_functions.push(...signal.preferred_functions);
    }

    if (signal.impact_band) {
      nextIntent.impact_band = signal.impact_band;
    }

    if (signal.life_range_hours) {
      nextIntent.life_range_hours = clampLifeRange(stage, signal.life_range_hours);
    }
  });

  return {
    preferred_letters: buildPreferenceSet(nextIntent.preferred_letters),
    preferred_functions: buildPreferenceSet(nextIntent.preferred_functions),
    impact_band: nextIntent.impact_band,
    life_range_hours: clampLifeRange(stage, nextIntent.life_range_hours),
  };
};

export const getWizardQuestionsForStage = (stage, answers = {}) => {
  const normalizedStage = String(stage || '').trim().toLowerCase();
  return (questionBank[normalizedStage] || []).map((question) => ({
    ...question,
    options: getOptionsForQuestion(question, answers),
  }));
};

export const getStageLabel = (stage) => STAGE_LABELS[stage] || 'Stage';

export const formatImpactBandLabel = (band) => IMPACT_BAND_LABELS[String(band || '').trim().toLowerCase()] || 'Flexible impact';

export const formatLifeRangeLabel = (range) => {
  const [minLife, maxLife] = Array.isArray(range) ? range : [];
  if (!Number.isFinite(minLife) || !Number.isFinite(maxLife)) {
    return 'Flexible lifetime';
  }

  return `${Math.round(minLife)}-${Math.round(maxLife)}h target`;
};

export const buildStageTargetProfile = (stage, answers = {}, brief = null) => {
  const questions = getWizardQuestionsForStage(stage, answers);
  const selectedOptions = questions
    .map((question) => getSelectedOption(question, answers[question.id], answers))
    .filter(Boolean);
  const tags = [...new Set(selectedOptions.flatMap((option) => option.tags || []))];
  const tagIntent = buildStructuredStageIntent(stage, tags);
  const structuredIntent = applySelectedOptionSignals(stage, tagIntent, selectedOptions);
  const selectedLabels = selectedOptions.map((option) => option.label);
  const summaryLabels = selectedLabels.filter(Boolean).slice(-3);
  const summary = summaryLabels.join(' - ');
  const briefContext = [
    brief?.mood_story,
    brief?.audience_usage,
    brief?.performance_target,
  ].filter(Boolean).join(' ');

  const stageGoal = {
    top: 'Focus on first impression, lift, and believable transition into the heart.',
    middle: 'Focus on signature identity, body, and emotional presence in the core.',
    base: 'Focus on drydown support, persistence, and the final trail left on skin.',
  }[stage] || '';

  return {
    summary: summary || `${getStageLabel(stage)} direction`,
    tags,
    brief_context: briefContext,
    stage_goal: stageGoal,
    selected_labels: selectedLabels,
    preferred_letters: structuredIntent.preferred_letters,
    preferred_functions: structuredIntent.preferred_functions,
    impact_band: structuredIntent.impact_band,
    impact_summary: formatImpactBandLabel(structuredIntent.impact_band),
    life_range_hours: structuredIntent.life_range_hours,
    life_summary: formatLifeRangeLabel(structuredIntent.life_range_hours),
  };
};
