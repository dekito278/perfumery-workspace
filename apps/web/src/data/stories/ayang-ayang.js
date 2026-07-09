const story = {
  slug: 'ayang-ayang',

  // Color world
  colors: {
    bg: '#1a0f14',
    text: '#f5ede4',
    accent: '#c4917b',
    muted: 'rgba(245, 237, 228, 0.45)',
    border: 'rgba(245, 237, 228, 0.12)',
  },

  // Hero
  hero: {
    eyebrow: 'Sebuah surat yang tak pernah terkirim',
    headline: 'Ayang-ayang',
    headlineScript: 'ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀',
    subtitle: 'Sakit gak, jatuh cinta sama orang yang kita gak bisa gapai?',
  },

  // Background music
  music: {
    src: null,
    label: 'Ambient — Gamelan Sunyi',
  },

  // Floating video
  video: {
    src: null,
    poster: null,
  },

  // Editorial story sections (scroll-driven narrative)
  sections: [
    {
      type: 'quote',
      text: 'Ada rindu yang tidak bisa diucapkan,\nhanya bisa dipakai di kulit.',
    },
    {
      type: 'text-image',
      layout: 'image-left',
      eyebrow: 'Tentang Aroma',
      heading: 'Jasmine yang berbicara di malam hari',
      body: 'Top notes Jasmine dan Tuberose membuka percakapan yang lembut — seperti bisikan yang hanya bisa didengar saat dunia sudah tidur. Heart Amberwood membawa kehangatan yang familiar, seperti pelukan yang kita ingat tapi tidak bisa kita ulang.',
      image: null,
    },
    {
      type: 'full-bleed',
      image: null,
      caption: 'Di antara kelopak dan kenangan',
    },
    {
      type: 'text-image',
      layout: 'image-right',
      eyebrow: 'Base & Karakter',
      heading: 'Musk yang tersisa di bantal',
      body: 'Base Radiant Musk dan Amber meninggalkan jejak yang tenang — aroma yang bertahan lama setelah orangnya pergi. Seperti parfum yang tertinggal di baju seseorang yang pernah memeluk kita.',
      image: null,
    },
    {
      type: 'quote',
      text: 'Ayang-ayang bukan parfum untuk memikat.\nIni parfum untuk mengingat.',
    },
  ],
};

export default story;
