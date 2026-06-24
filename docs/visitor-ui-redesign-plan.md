# SOLIVAGANT Visitor UI Redesign Plan

**Reference:** [Object & Archive](https://objectandarchive.com)
**Scope:** Visitor-facing pages (desktop + mobile). Studio workspace logic tidak diubah, tapi ditambah fitur image management.
**Date:** 23 Juni 2026 (Updated)

---

## Ringkasan

Redesign ini mengubah tampilan storefront SOLIVAGANT dari "app-like editorial" menjadi "gallery-first editorial e-commerce" mengikuti arah desain Object & Archive. Mencakup **desktop dan mobile (Android)** visitor pages, plus fitur **Site Image Manager** di Studio agar gambar hero, banner, dan mood bisa diupload/diganti tanpa coding.

Perubahan dibagi 7 fase:
1. Design Foundation (tokens, typography)
2. Navigation & Page Architecture (desktop)
3. Homepage Redesign (desktop)
4. Collection & Product Detail (desktop)
5. **Mobile Visitor Redesign (Android)**
6. **Site Image Manager (Studio feature)**
7. Supporting Pages & Polish

**File yang akan diubah — DESKTOP visitor:**

| File | Perubahan |
|------|-----------|
| `src/styles/storefront.css` | Rewrite design tokens, typography, layout system |
| `src/components/storefront/PublicHeader.jsx` | Mega-menu navigation |
| `src/components/storefront/StorefrontHeader.jsx` | Update untuk konsistensi |
| `src/pages/HomePage.jsx` | Full redesign — gallery-first, hapus operational sections |
| `src/pages/CatalogPage.jsx` | Image-first grid, refined filters |
| `src/pages/PublicProductDetailPage.jsx` | Immersive product page |
| `src/pages/BespokePage.jsx` | Editorial bespoke experience |
| `src/pages/PublicJournalPage.jsx` | Magazine-style journal |
| `src/pages/PublicJournalArticlePage.jsx` | Long-form article layout |
| `src/pages/PublicMaterialsPage.jsx` | Curated material archive |
| `src/pages/PublicTrackingPage.jsx` | Minimal styling update |
| `src/pages/CartPage.jsx` | Minimal styling update |
| `src/pages/CheckoutPage.jsx` | Minimal styling update |
| `src/components/storefront/ProductVisual.jsx` | Image presentation upgrade |

**File yang akan diubah — MOBILE (Android) visitor:**

| File | Perubahan |
|------|-----------|
| `src/styles/mobile.css` | Mobile design tokens update, color/typography alignment |
| `src/pages/mobile/MobileStorefrontPage.jsx` | Gallery-first hero, hapus "app-like" strip |
| `src/pages/mobile/MobileCatalogPage.jsx` | Image-dominant grid, cleaner cards |
| `src/pages/mobile/MobileProductDetailPage.jsx` | Immersive product view |
| `src/pages/mobile/MobileBespokePage.jsx` | Editorial bespoke styling |
| `src/pages/mobile/MobileArticlesPage.jsx` | Magazine-style journal |
| `src/pages/mobile/MobileCartPage.jsx` | Styling polish |
| `src/pages/mobile/MobileCheckoutPage.jsx` | Styling polish |
| `src/layouts/MobileCommerceLayout.jsx` | Bottom nav styling update |

**File BARU — Studio Image Manager:**

| File | Fungsi |
|------|--------|
| `supabase/migrations/XXXXXX_site_images.sql` | Tabel `site_images` + storage bucket |
| `src/services/siteImageService.js` | CRUD service untuk site images |
| `src/pages/SiteImagesPage.jsx` (desktop) | Studio page: upload/manage site images |
| `src/pages/mobile/MobileSiteImagesPage.jsx` | Mobile studio version |
| `src/hooks/useSiteImages.js` | Hook untuk ambil images di visitor pages |
| `src/components/storefront/ProductGallery.jsx` | Gallery component enhancement |
| `apps/web/index.html` | Font loading (tambah font baru jika perlu) |

**File yang TIDAK diubah:**
- Semua file di `src/pages/mobile/` (mobile app tetap)
- Semua file studio/workspace (Dashboard, Formulas, RawMaterials, Batches, dll)
- `src/layouts/AuthenticatedLayout.jsx`
- `src/styles/studio.css`
- `src/styles/mobile.css`
- Backend / API / Supabase

---

## Fase 1: Design Foundation (Tokens, Typography, Color)

**Estimasi: 1-2 session**

### 1.1 Design Tokens Update (`storefront.css`)

Sekarang:
```css
--editorial-ivory: #f7f1e5;
--editorial-paper: #fffaf0;
--editorial-stone: #e5decf;
--editorial-charcoal: #1b1a16;
--editorial-muted: #6f695f;
--editorial-forest: #183522;
--editorial-sage: #9dad8d;
--editorial-brass: #b08b4f;
```

Perlu ditambah:
```css
/* Spacing system */
--space-section: clamp(80px, 10vw, 140px);
--space-block: clamp(40px, 5vw, 64px);
--content-max: 1320px;
--content-gutter: max(24px, calc((100vw - var(--content-max)) / 2));

/* Typography scale — lebih restrained dari sekarang */
--font-display: Georgia, "Times New Roman", serif;
--font-body: "DM Sans", system-ui, sans-serif;
--text-hero: clamp(2.8rem, 4.5vw, 5rem);       /* turun dari 4-7rem */
--text-section: clamp(2rem, 3vw, 3.2rem);        /* turun dari 2.45-4.9rem */
--text-card-title: clamp(1.1rem, 1.4vw, 1.35rem);
--text-body: 0.95rem;
--text-caption: 0.78rem;
--text-eyebrow: 0.72rem;

/* Animation tokens */
--ease-smooth: cubic-bezier(0.25, 0.1, 0.25, 1);
--duration-fast: 180ms;
--duration-normal: 320ms;
```

**Kenapa:** Typography sekarang terlalu dramatis (hero 4-7rem). O&A lebih restrained — besar tapi tidak overwhelming. Sizing yang lebih kecil juga memberi ruang lebih untuk gambar.

### 1.2 Font Loading

Pertimbangkan menambah satu display serif yang lebih refined dari Georgia. Opsi:
- **Cormorant Garamond** (Google Fonts, free) — closest match ke feel O&A
- **Playfair Display** — lebih bold, editorial feel
- Atau tetap Georgia — sudah oke, hanya perlu tuning weight/spacing

Aksi: Update `index.html` untuk preload font jika menambah font baru.

### 1.3 Global Reset untuk Storefront Pages

Tambah base styles:
- `scroll-behavior: smooth`
- Image default: `object-fit: cover`, lazy loading
- Link underline style: underline-offset, decoration-thickness
- Selection color matching brand

---

## Fase 2: Navigation & Page Architecture

**Estimasi: 2-3 session**

### 2.1 PublicHeader.jsx → Mega-Menu Navigation

**Sekarang:** Flat nav bar dengan 5 link setara (Collection, Bespoke ritual, Raw material archive, Journal, Track Order).

**Target:**

```
┌──────────────────────────────────────────────────────────┐
│ SOLIVAGANT              [Shop ▾] [Journal] [About]  🛒  │
├──────────────────────────────────────────────────────────┤
│ Shop dropdown:                                           │
│                                                          │
│ Collection        By Mood          By Family             │
│ ─────────         ─────────        ─────────             │
│ All Fragrances    Quiet & Minimal  Woody                 │
│ New Arrivals      Dark & Moody     Floral                │
│ Gift Sets         Warm & Nostalgic Fresh                  │
│ Bespoke           Dreamy           Gourmand               │
│                                                          │
│ By Occasion       Resources                              │
│ ─────────         ─────────                              │
│ Daily Wear        Raw Material Archive                   │
│ Evening           Perfumer's Notes                       │
│ Special Occasion  Scent Guide                            │
└──────────────────────────────────────────────────────────┘
```

Komponen baru yang dibutuhkan:
- `MegaMenuDropdown.jsx` — dropdown container dengan kolom
- `MegaMenuColumn.jsx` — individual column dalam dropdown
- Atau cukup state-based di `PublicHeader.jsx` (lebih simple)

**Penting:** Track Order dan Cart tetap ada, tapi Cart jadi icon only (🛒 + badge count), Track Order masuk ke footer atau sub-nav.

### 2.2 Page Architecture

Sekarang semua route sudah terpisah, tapi HomePage masih mega-scroll. Perlu:

**Homepage (`/home`):**
- Hero: fullscreen image/slideshow + minimal text overlay
- "Current Collection" — horizontal scroll atau grid 3-4 produk
- "Perfumer Story" — short editorial block
- "Explore by Mood/Occasion" — category cards visual
- Newsletter signup
- Rich footer

**Sections yang DIHAPUS dari homepage:**
- ❌ Cart preview section (operational, bukan editorial)
- ❌ Tracking timeline section (operational)
- ❌ Bespoke form preview (cukup link ke halaman bespoke)
- ❌ "Commerce" section bawah

**Pages baru yang mungkin perlu dibuat:**
- `/about` — Perfumer story (saat ini embedded di homepage, sebaiknya halaman sendiri)
- Homepage categories bisa link ke `/catalog?mood=quiet` atau `/catalog?family=woody`

### 2.3 Rich Footer Component

Buat `StorefrontFooter.jsx`:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  SOLIVAGANT                                         │
│  Artisan Perfumery Atelier by Dekito                │
│                                                     │
│  Shop          Info           Connect     Journal   │
│  ─────         ─────          ─────       ─────     │
│  All           About          Instagram   Latest    │
│  Fragrances    Bespoke Guide  Email       Archive   │
│  Bespoke       Shipping       WhatsApp              │
│  Gift Card     FAQ                                  │
│               Track Order                           │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ Newsletter: Stay with the atelier.          │    │
│  │ [email________________] [Subscribe]         │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  © 2026 SOLIVAGANT by Dekito                        │
└─────────────────────────────────────────────────────┘
```

---

## Fase 3: Homepage Redesign

**Estimasi: 2-3 session**

### 3.1 Hero Section

**Sekarang:** Split layout — copy kiri (h1 besar + paragraf + 2 button) + gambar kanan dalam panel.

**Target:** Fullscreen image hero, atau fullscreen image slider (carousel) seperti O&A.

Opsi A — **Fullscreen Single Image Hero:**
```
┌─────────────────────────────────────────────────┐
│                                                 │
│         [Full-bleed image background]           │
│                                                 │
│              SOLIVAGANT                          │
│    Fragrance as a memory object.                │
│                                                 │
│         [Explore Collection →]                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

Opsi B — **Image Slider** (lebih mirip O&A):
```
┌─────────────────────────────────────────────────┐
│                                                 │
│    [Slideshow: produk 1/4]     [1/4 Title →]   │
│    [Full-bleed product image]                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Rekomendasi:** Mulai dengan Opsi A (lebih simple, impact tinggi). Slider bisa ditambah nanti.

### 3.2 Collection Preview Section

**Sekarang:** 4-column product grid dengan card heavy (category, name, description, notes, size/price, 2 buttons).

**Target:** Image-first grid. Hanya tampilkan: gambar produk + nama + harga. Detail masuk di hover atau di product detail page.

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│          │ │          │ │          │ │          │
│  [img]   │ │  [img]   │ │  [img]   │ │  [img]   │
│          │ │          │ │          │ │          │
│ Hug      │ │ Nocturne │ │ Jaipong  │ │ Trace    │
│ Rp289.000│ │ Rp349.000│ │ Rp289.000│ │ Rp329.000│
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### 3.3 "Explore by Mood" Section

Mirip O&A "Explore by interior style" — horizontal scrollable cards:

```
┌─────────────────────────────────────────────────┐
│ EXPLORE BY MOOD                                 │
│                                                 │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐│
│ │ [img]   │ │ [img]   │ │ [img]   │ │ [img]  ││
│ │         │ │         │ │         │ │        ││
│ │ Quiet & │ │ Dark &  │ │ Warm &  │ │ Fresh  ││
│ │ Minimal │ │ Moody   │ │ Nostalgic│ │& Clean ││
│ │         │ │         │ │         │ │        ││
│ │ Deskripsi│ │Deskripsi│ │Deskripsi│ │Dskrips ││
│ └─────────┘ └─────────┘ └─────────┘ └────────┘│
└─────────────────────────────────────────────────┘
```

Data source: `storefrontCategories` di `storefront.js` sudah punya Fresh, Floral, Woody, Gourmand. Perlu diperkaya dengan mood categories dan image per category.

### 3.4 Editorial Statement Block

Mirip O&A "Mood > Movement":

```
┌─────────────────────────────────────────────────┐
│                                                 │
│ [Full-width atmospheric image]                  │
│                                                 │
│ Fragrance as personal atmosphere.               │
│                                                 │
│ We compose scent as memory objects — not just    │
│ perfume, but the feeling it leaves on skin and   │
│ in a room.                                      │
│                                                 │
│ [Our Story →]                                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 3.5 Newsletter + Footer

Tambahkan newsletter signup section sebelum footer. Data bisa disimpan ke Supabase (tabel baru `newsletter_subscribers`) atau cukup mailto/external service dulu.

---

## Fase 4: Collection & Product Detail Pages

**Estimasi: 2-3 session**

### 4.1 CatalogPage.jsx — Image-First Grid

**Sekarang:** Toolbar (category pills + search + filter button + cart status) → 4-column card grid dengan banyak info.

**Target:**
- Toolbar: simplified — pills filter + search saja
- Grid: image-dominant, 3 atau 4 kolom
- Card: gambar besar + nama + harga. Tidak perlu notes/size di grid level
- Hover: subtle zoom atau overlay dengan "View" button
- Hapus cart status dari toolbar (sudah ada di header)

### 4.2 PublicProductDetailPage.jsx — Immersive Detail

**Sekarang:** Editorial layout, sudah lumayan baik.

**Target enhancement:**
- Image gallery lebih besar (60-70% width)
- Notes pyramid lebih visual (bukan teks biasa)
- "You may also like" section di bawah
- Breadcrumb navigation
- Sticky add-to-cart on scroll

### 4.3 ProductVisual.jsx — Image Presentation

- Tambah hover zoom effect
- Loading skeleton/placeholder
- Support multiple images (gallery)
- Lazy loading dengan blur-up placeholder

---

## Fase 5: Mobile (Android) Visitor Redesign

**Estimasi: 3-4 session**

### Situasi Sekarang

Mobile visitor pages sudah lumayan lengkap (`MobileStorefrontPage`, `MobileCatalogPage`, `MobileProductDetailPage`, `MobileBespokePage`, `MobileArticlesPage`, `MobileCartPage`, `MobileCheckoutPage`). Tapi style-nya masih "app-like" — banyak shadow, rounded cards, quick-action rail, "strip" info badges, dan UI patterns yang lebih mirip native app daripada editorial e-commerce.

### 5.1 MobileStorefrontPage.jsx — Gallery-First Mobile Home

**Sekarang:**
- Hero: copy kiri + product thumbnail kanan + action buttons
- Quick action rail (Cari parfum, Drop terbatas, Custom aroma, Cek order)
- Mood row (category pills)
- Product rail horizontal scroll
- Perfumer story card
- Category cards

**Target (O&A mobile feel):**
- Hero: fullscreen product image + minimal text overlay (nama + tagline)
- Swipeable product carousel (bukan horizontal rail cards)
- "Explore by mood" — vertical cards with image + label
- Hapus quick-action rail (terlalu app-like, sudah ada di bottom nav)
- Hapus info strip (Ready/Custom/Order badges)
- Perfumer story tetap tapi lebih editorial (less card-like)

### 5.2 MobileCatalogPage.jsx — Clean Image Grid

**Sekarang:** 2-column grid, card heavy (category chip, name, description, pills, notes, size, price, stock badge, add-to-cart button, semua di satu card).

**Target:**
- 2-column grid tetap, tapi image-dominant
- Card: gambar besar (aspect 3:4 atau 4:5) + nama + harga. Itu saja.
- Detail masuk di product detail page
- Filter: simplified — category tabs + search
- Hapus stock badge dan cart status dari card level

### 5.3 MobileProductDetailPage.jsx — Immersive Detail

- Image gallery fullscreen swipeable (bukan small thumbnail)
- Sticky bottom bar: price + Add to Cart button
- Notes pyramid visual
- Related products di bawah
- Cleaner typography

### 5.4 Mobile CSS Alignment (`mobile.css`)

- Update color tokens agar match desktop storefront tokens
- Typography: serif headings alignment
- Remove excessive shadows, rounded-2xl card patterns
- More white space, cleaner separation
- Transitions: subtle fade/slide instead of heavy shadows

### 5.5 MobileCommerceLayout.jsx — Bottom Nav

- Styling update: cleaner icons, less heavy
- Active state: underline atau dot indicator, bukan filled background
- Tetap functional — hanya visual polish

---

## Fase 6: Site Image Manager (Studio Feature)

**Estimasi: 2-3 session**

### Konsep

Saat ini gambar-gambar storefront (hero, perfumer story, dll) di-hardcode di `HomePage.jsx`:

```javascript
const homeAssets = {
  rawMaterialLibrary: '/brand/home/raw-material-library.jpg',
  rawMaterialShelf: '/brand/home/raw-material-shelf.jpg',
  perfumerPipettes: '/brand/home/perfumer-pipettes.jpg',
  perfumerCylinder: '/brand/home/perfumer-cylinder.jpg',
};
```

Dan disimpan sebagai static files di `/public/brand/home/`. Ini berarti setiap kali mau ganti gambar hero atau banner, harus edit code dan redeploy.

**Solusi:** Buat sistem **Site Images** yang mirip product images — upload ke Supabase Storage, simpan metadata di database, ambil via hook di visitor pages.

### 6.1 Database Schema

```sql
-- Migration: site_images table
create table public.site_images (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  slot text not null,                    -- e.g., 'hero_main', 'hero_slide_2', 'mood_woody', 'about_perfumer'
  label text,                            -- human-readable name: "Hero utama", "Mood: Woody"
  image_url text not null,               -- Supabase storage public URL
  alt_text text default '',
  sort_order integer default 0,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Unique constraint: satu slot per user
alter table public.site_images
  add constraint site_images_user_slot_unique unique (user_id, slot);

-- RLS: user hanya bisa akses images sendiri
alter table public.site_images enable row level security;

create policy "Users can manage own site images"
  on public.site_images for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public read for visitor pages (active images only)
create policy "Public can read active site images"
  on public.site_images for select
  using (active = true);
```

Storage bucket baru:
```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-images',
  'site-images',
  true,
  10485760,  -- 10MB (hero images perlu resolusi tinggi)
  array['image/jpeg', 'image/png', 'image/webp']
);
```

### 6.2 Predefined Image Slots

```javascript
export const SITE_IMAGE_SLOTS = {
  // Homepage
  hero_main: { label: 'Hero Utama', description: 'Gambar fullscreen di hero homepage', recommended: '1920×1080px min' },
  hero_slide_2: { label: 'Hero Slide 2', description: 'Slide kedua carousel (optional)', recommended: '1920×1080px' },
  hero_slide_3: { label: 'Hero Slide 3', description: 'Slide ketiga carousel (optional)', recommended: '1920×1080px' },
  story_perfumer: { label: 'Perfumer Story', description: 'Foto perfumer di section story', recommended: '800×1000px' },
  story_atelier: { label: 'Atelier Scene', description: 'Suasana atelier/workshop', recommended: '1200×800px' },
  statement_banner: { label: 'Statement Banner', description: 'Full-width editorial statement', recommended: '1920×600px' },

  // Mood/Category images
  mood_quiet: { label: 'Mood: Quiet & Minimal', description: 'Background card mood quiet', recommended: '800×600px' },
  mood_dark: { label: 'Mood: Dark & Moody', description: 'Background card mood dark', recommended: '800×600px' },
  mood_warm: { label: 'Mood: Warm & Nostalgic', description: 'Background card mood warm', recommended: '800×600px' },
  mood_fresh: { label: 'Mood: Fresh & Clean', description: 'Background card mood fresh', recommended: '800×600px' },
  mood_floral: { label: 'Mood: Floral', description: 'Background card mood floral', recommended: '800×600px' },
  mood_woody: { label: 'Mood: Woody', description: 'Background card mood woody', recommended: '800×600px' },
  mood_gourmand: { label: 'Mood: Gourmand', description: 'Background card mood gourmand', recommended: '800×600px' },

  // Newsletter & Footer
  newsletter_bg: { label: 'Newsletter Background', description: 'Background section newsletter signup', recommended: '1200×400px' },

  // About page
  about_hero: { label: 'About Hero', description: 'Gambar utama halaman About', recommended: '1200×800px' },
  about_process: { label: 'About Process', description: 'Foto proses pembuatan parfum', recommended: '800×600px' },
};
```

### 6.3 Studio UI — SiteImagesPage.jsx

Halaman baru di Studio (desktop + mobile) untuk manage site images:

```
┌─────────────────────────────────────────────────┐
│ Site Images                           [Save All]│
├─────────────────────────────────────────────────┤
│                                                 │
│ HOMEPAGE                                        │
│ ┌───────────────────┐ ┌───────────────────┐     │
│ │ Hero Utama        │ │ Hero Slide 2      │     │
│ │ ┌───────────────┐ │ │ ┌───────────────┐ │     │
│ │ │ [current img] │ │ │ │  [empty slot] │ │     │
│ │ │               │ │ │ │  + Upload     │ │     │
│ │ └───────────────┘ │ │ └───────────────┘ │     │
│ │ 1920×1080px min   │ │ 1920×1080px       │     │
│ │ [Change] [Remove] │ │ [Upload]          │     │
│ └───────────────────┘ └───────────────────┘     │
│                                                 │
│ MOOD / KATEGORI                                 │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ Quiet    │ │ Dark     │ │ Warm     │         │
│ │ [img]    │ │ [img]    │ │ [empty]  │         │
│ │ [Change] │ │ [Change] │ │ [Upload] │         │
│ └──────────┘ └──────────┘ └──────────┘         │
│                                                 │
│ ABOUT & STORY                                   │
│ ┌──────────┐ ┌──────────┐                       │
│ │ Perfumer │ │ Atelier  │                       │
│ │ [img]    │ │ [img]    │                       │
│ └──────────┘ └──────────┘                       │
└─────────────────────────────────────────────────┘
```

Fitur:
- Upload gambar ke Supabase Storage (reuse `compressProductImage` logic dari `productImageStorageService.js`)
- Preview sebelum save
- Crop/resize recommendation (dimensi ideal per slot)
- Fallback ke static images di `/public/brand/` jika belum ada upload

### 6.4 useSiteImages Hook

```javascript
// Hook yang dipakai di visitor pages
export const useSiteImages = () => {
  const [images, setImages] = useState({});
  // ... fetch dari site_images table, fallback ke static defaults
  return {
    getImage: (slot, fallback) => images[slot]?.image_url || fallback,
    getAlt: (slot, fallback) => images[slot]?.alt_text || fallback,
    heroSlides: // filter hero_slide_* slots
    moodImages: // filter mood_* slots
  };
};
```

### 6.5 Update Visitor Pages

Semua hardcoded image references di visitor pages (desktop + mobile) diubah ke `useSiteImages()`:

```javascript
// Sebelum:
<img src="/brand/home/perfumer-cylinder.jpg" alt="..." />

// Sesudah:
const { getImage } = useSiteImages();
<img src={getImage('hero_main', '/brand/home/perfumer-cylinder.jpg')} alt="..." />
```

Dengan fallback, gambar lama tetap jalan sampai admin upload gambar baru.

### 6.6 Route Registration

Desktop:
```javascript
// App.jsx — tambah route di authenticated section
<Route path="/site-images" element={<SiteImagesPage />} />
```

Mobile:
```javascript
<Route path="/mobile/site-images" element={<MobileSiteImagesPage />} />
```

Sidebar/nav link di Studio navigation.

---

## Fase 7: Supporting Pages & Polish

**Estimasi: 2-3 session**

### 5.1 PublicJournalPage.jsx — Magazine Layout

**Sekarang:** List-based article grid.

**Target:** Magazine-style layout:
- Featured article besar di atas
- Grid 2-3 kolom untuk sisa artikel
- Category filter tabs
- Cover image per artikel (sudah ada `JournalCoverFrame.jsx`)

### 5.2 PublicMaterialsPage.jsx — Curated Archive

**Sekarang:** Simple card grid.

**Target:**
- Visual grid dengan scent family color coding
- Filter by family/note type
- Each card: nama + family + short description
- Link ke detail page (optional future)

### 5.3 BespokePage.jsx — Editorial Experience

**Sekarang:** Multi-step form yang sangat functional.

**Target:** Form tetap sama functionally, tapi wrapped dalam editorial layout:
- Hero section dengan bespoke philosophy
- Form steps lebih visual (progress bar, image per step)
- Hasil tetap sama — ini lebih ke CSS polish, bukan logic change

### 5.4 Animation & Microinteraction

- Scroll-reveal animations (sudah ada `ScrollRevealEffects.jsx` — perlu di-tune)
- Image hover zoom
- Page transition fade
- Cart add animation
- Header scroll behavior (transparent → solid on scroll)

### 5.5 Responsive Breakpoints

Pastikan semua perubahan responsive:
- Desktop: full layout
- Tablet (768-1024px): 2-column grids, stacked hero
- Note: Mobile sudah punya halaman sendiri (`/mobile/*`), jadi fokus desktop + tablet saja

---

## Urutan Prioritas Eksekusi

| # | Fase | Impact | Effort | Priority |
|---|------|--------|--------|----------|
| 1 | Design Foundation (tokens, typography) | Medium | Low | **Start here** |
| 2 | Navigation (mega-menu + footer) | High | Medium | **2nd** |
| 3 | Homepage Redesign (desktop) | Highest | High | **3rd** |
| 4 | Collection + Product Detail (desktop) | High | Medium | **4th** |
| 5 | Mobile Visitor Redesign | Highest | High | **5th** |
| 6 | Site Image Manager (Studio) | High | Medium | **6th** |
| 7 | Journal, Materials, Bespoke, Polish | Medium | Medium | **7th** |

**Catatan urutan:** Fase 6 (Image Manager) bisa dimulai parallel dengan fase 3-5 karena independent. Fase 1-2 harus selesai dulu karena tokens dan navigation dipakai di mana-mana.

---

## Persiapan Sebelum Mulai

### Asset yang dibutuhkan

1. **Hero image(s)** berkualitas tinggi — saat ini ada 4 gambar di `/public/brand/home/`. Cek apakah resolusi cukup untuk fullscreen hero (minimal 1920px wide). Jika tidak, perlu foto baru atau upscale.

2. **Category/mood images** — untuk section "Explore by Mood". Perlu 4-6 gambar atmospheric yang merepresentasikan setiap mood/family.

3. **Logo SVG** — saat ini ada `solivagant-logo.png`. Idealnya punya SVG version untuk header (bisa putih di atas hero, hitam di scroll state).

4. **Social media links** — untuk footer (Instagram, WhatsApp, email).

### Data yang perlu disiapkan

1. **Mood/occasion categories** dengan deskripsi editorial (expand `storefrontCategories` di `storefront.js`)
2. **Newsletter system** — minimal tabel Supabase atau external service
3. **About/perfumer story** — copy editorial yang lebih panjang untuk halaman About terpisah

### Technical checklist

- [ ] Backup current `storefront.css` sebelum rewrite
- [ ] Test font loading performance setelah menambah font baru
- [ ] Pastikan semua perubahan CSS di-scope ke `.solivagant-editorial-home` agar tidak bocor ke studio
- [ ] Lighthouse audit sebelum dan sesudah (terutama LCP karena hero image besar)

---

## Catatan Penting

- **Mobile visitor pages (`/mobile/*`) IKUT diubah** visual-nya agar selaras dengan desktop (Fase 5)
- **Mobile studio pages (dashboard, formulas, raw materials, batches, dll) TIDAK diubah**
- **Cart/Checkout flow tetap functional** — hanya visual polish, logic tidak berubah
- **Bespoke form logic tetap sama** — hanya wrapping editorial
- **Studio workspace logic tidak disentuh**, kecuali penambahan fitur Site Image Manager (Fase 6)
- **Image Manager menggunakan pattern yang sudah ada** — Supabase Storage + `compressProductImage` logic dari `productImageStorageService.js`
- Semua perubahan bisa dilakukan incremental per fase — tidak perlu big bang release
- Fallback ke static images tetap ada, jadi tidak ada breaking change sebelum admin upload gambar baru
