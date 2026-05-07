import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BriefcaseBusiness,
  Gem,
  Leaf,
  MessageCircle,
  PackagePlus,
  ShoppingBag,
  Sparkles,
  UserRound,
  WandSparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import {
  perfumerProfile,
  storefrontSegments,
} from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

const featureNotes = [
  { icon: Sparkles, label: 'Quiet Luxury', value: 'Polished signature scents' },
  { icon: Leaf, label: 'Fine Notes', value: 'Woody, green, citrus, musk' },
  { icon: Gem, label: 'Personal Fit', value: 'Daily wear to bespoke brief' },
];

const homeAssets = {
  rawMaterialLibrary: '/brand/home/raw-material-library.jpg',
  rawMaterialShelf: '/brand/home/raw-material-shelf.jpg',
  perfumerPipettes: '/brand/home/perfumer-pipettes.jpg',
  perfumerCylinder: '/brand/home/perfumer-cylinder.jpg',
  perfumerAtWork: '/brand/home/perfumer-at-work.jpg',
};

const atelierFrames = [
  {
    image: homeAssets.rawMaterialShelf,
    label: 'Material library',
    title: 'A palette of fine raw materials',
  },
  {
    image: homeAssets.perfumerPipettes,
    label: 'Precision',
    title: 'Measured by hand, built by memory',
  },
  {
    image: homeAssets.perfumerCylinder,
    label: 'Studio',
    title: 'Personal scent work from the source',
  },
];

const HomePage = () => {
  const products = useCatalogProducts();
  const categories = useStorefrontCategories(products);
  const homeProducts = products.filter((product) => product.featured).slice(0, 3);
  const limitedProducts = products.filter((product) => product.featured || product.stock <= 8).slice(0, 3);
  const productsLoading = Boolean(products.loading);
  const hasProducts = products.length > 0;
  const heroProducts = [homeProducts[0] || products[0], homeProducts[1] || products[1], homeProducts[2] || products[2]].filter(Boolean);
  const storefrontStats = [
    { value: String(products.length), label: 'Scents' },
    { value: String(limitedProducts.length), label: 'Limited picks' },
    { value: '1:1', label: 'Bespoke' },
  ];

  return (
    <>
      <Helmet>
        <title>Solivagant - Signature and Bespoke Perfume</title>
        <meta name="description" content="Solivagant storefront for signature perfume, limited categories, and bespoke perfume requests." />
      </Helmet>

      <main className="min-h-screen overflow-hidden bg-[#f7f8f2] text-[#0b130c]">
        <section className="border-b border-[#263d27]/15 bg-[#050705] text-[#eef2e8]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/home" className="flex items-center gap-3">
              <img src="/brand/solivagant-logo.png" alt="Solivagant" className="h-11 w-32 rounded-xl object-contain" />
              <span className="min-w-0">
                <span className="sr-only">Solivagant Perfumery</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Link to="/cart" className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/8" aria-label="Open cart"><ShoppingBag className="h-4 w-4" /></Link>
              <Link to="/catalog" className="inline-flex h-10 items-center rounded-2xl border border-white/15 bg-white/8 px-4 text-sm font-bold text-[#eef2e8]">
                Catalog
              </Link>
            </div>
          </div>
        </section>

        <section className="relative border-b border-[#263d27]/10">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#f8f7ef_0%,#edf2e8_48%,#f6efe3_100%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#8d7a4f]/50 to-transparent" />
          <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(38,61,39,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(38,61,39,0.14)_1px,transparent_1px)] [background-size:52px_52px]" />

          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,0.88fr)_minmax(440px,1.12fr)] lg:items-center lg:px-8 lg:py-16">
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="max-w-3xl"
            >
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-[#263d27]/18 bg-white/70 px-3 py-1 text-xs font-bold uppercase text-[#263d27] shadow-sm shadow-[#263d27]/5 backdrop-blur">
                <UserRound className="h-4 w-4" />
                {perfumerProfile.name} / Perfumer
              </motion.div>
              <motion.h1 variants={fadeUp} className="mt-6 max-w-3xl text-4xl font-bold leading-none text-[#081009] sm:text-5xl lg:text-6xl">
                Signature perfume, made personal.
              </motion.h1>
              <motion.p variants={fadeUp} className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-[#4f5f50] sm:text-lg">
                {perfumerProfile.intro}
              </motion.p>

              <motion.div variants={fadeUp} className="mt-6 grid gap-3 sm:grid-cols-3">
                {featureNotes.map((note) => {
                  const Icon = note.icon;

                  return (
                    <div key={note.label} className="border-l border-[#263d27]/20 pl-4">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#263d27]">
                        <Icon className="h-4 w-4" />
                        {note.label}
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-snug text-[#627061]">{note.value}</p>
                    </div>
                  );
                })}
              </motion.div>

              <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
                <Link to="/catalog" className="group inline-flex h-12 items-center gap-2 rounded-2xl bg-[#263d27] px-5 text-sm font-bold text-[#eef2e8] shadow-lg shadow-[#263d27]/20 transition hover:-translate-y-0.5 hover:bg-[#1c301d]">
                  Shop products
                  <ShoppingBag className="h-4 w-4 transition group-hover:rotate-6" />
                </Link>
                <Link to="/bespoke" className="group inline-flex h-12 items-center gap-2 rounded-2xl border border-[#263d27]/15 bg-white/80 px-5 text-sm font-bold text-[#0b130c] shadow-sm shadow-[#263d27]/5 transition hover:-translate-y-0.5 hover:bg-white">
                  Bespoke perfume
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
              </motion.div>

              <motion.div variants={fadeUp} className="mt-9 grid max-w-xl grid-cols-3 gap-3">
                {storefrontStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-[#263d27]/12 bg-white/72 p-4 shadow-sm shadow-[#263d27]/5 backdrop-blur">
                    <div className="text-2xl font-bold text-[#172417]">{stat.value}</div>
                    <div className="mt-1 text-xs font-bold uppercase leading-tight text-[#667264]">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="absolute -left-4 top-10 hidden h-[78%] w-px bg-gradient-to-b from-transparent via-[#263d27]/35 to-transparent lg:block" />
              <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-[#263d27]/12 bg-[#050705] px-4 py-3 text-[#eef2e8] shadow-2xl shadow-[#263d27]/15">
                <span className="text-xs font-bold uppercase tracking-[0.28em]">Inside the atelier</span>
                <span className="h-px flex-1 bg-white/14" />
                <span className="text-xs font-bold uppercase text-[#b7c6b1]">Solivagant</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1.05fr_0.95fr]">
                <motion.figure whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} className="relative min-h-[430px] overflow-hidden rounded-[28px] border border-[#263d27]/12 bg-[#050705] shadow-2xl shadow-[#263d27]/16">
                  <img src={homeAssets.rawMaterialLibrary} alt="Solivagant raw material library" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,5,0.08),rgba(5,7,5,0.78))]" />
                  <figcaption className="absolute inset-x-0 bottom-0 p-5 text-[#eef2e8]">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c6d5bf]">Raw material archive</p>
                    <h2 className="mt-2 max-w-sm text-2xl font-bold leading-tight">Built from real materials, not generic moodboards.</h2>
                  </figcaption>
                </motion.figure>

                <div className="grid gap-4">
                  <motion.figure whileHover={{ y: -5 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} className="relative min-h-[236px] overflow-hidden rounded-[28px] border border-[#263d27]/12 bg-[#050705] shadow-xl shadow-[#263d27]/10">
                    <img src={homeAssets.perfumerPipettes} alt="Solivagant perfumer holding pipettes" className="absolute inset-0 h-full w-full object-cover object-[58%_42%]" />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,5,0.72),rgba(5,7,5,0.08))]" />
                    <figcaption className="absolute bottom-0 left-0 max-w-[72%] p-5 text-[#eef2e8]">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c6d5bf]">Perfumer led</p>
                      <h3 className="mt-2 text-xl font-bold leading-tight">Measured by hand.</h3>
                    </figcaption>
                  </motion.figure>

                  {hasProducts && heroProducts[0] ? (
                    <motion.div whileHover={{ y: -5 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
                      <ProductVisual product={heroProducts[0]} className="min-h-[178px] shadow-xl shadow-[#263d27]/10" />
                    </motion.div>
                  ) : (
                    <div className="grid min-h-[178px] content-between rounded-[28px] border border-[#263d27]/12 bg-white/78 p-5 shadow-sm shadow-[#263d27]/5">
                      <WandSparkles className="h-6 w-6 text-[#263d27]" />
                      <div>
                        <h3 className="text-lg font-bold text-[#0b130c]">
                          {productsLoading ? 'Memuat koleksi parfum.' : 'Bespoke atelier is open'}
                        </h3>
                        <p className="mt-2 text-sm font-semibold leading-relaxed text-[#667264]">
                          {productsLoading ? 'Sebentar, koleksi sedang dimuat.' : 'Mulai dari brief personal sambil katalog produk disiapkan.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
        >
          <motion.div variants={fadeUp} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#263d27]">Atelier</div>
              <h2 className="mt-2 text-3xl font-bold text-[#0b130c]">A studio you can see and feel</h2>
            </div>
          </motion.div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {atelierFrames.map((frame) => (
              <motion.figure key={frame.title} variants={fadeUp} className="group relative min-h-[320px] overflow-hidden rounded-[28px] border border-[#263d27]/12 bg-[#050705] shadow-sm shadow-[#263d27]/5">
                <img src={frame.image} alt={frame.title} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,5,0.02),rgba(5,7,5,0.72))]" />
                <figcaption className="absolute inset-x-0 bottom-0 p-5 text-[#eef2e8]">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#c6d5bf]">{frame.label}</p>
                  <h3 className="mt-2 text-xl font-bold leading-tight">{frame.title}</h3>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </motion.section>

        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
        >
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-stretch">
            <motion.figure variants={fadeUp} className="relative min-h-[420px] overflow-hidden rounded-[28px] border border-[#263d27]/12 bg-[#050705] shadow-sm shadow-[#263d27]/8">
              <img src={homeAssets.perfumerAtWork} alt="Dekito developing a perfume formula" className="absolute inset-0 h-full w-full object-cover object-[58%_50%]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,5,0.02),rgba(5,7,5,0.72))]" />
              <figcaption className="absolute inset-x-0 bottom-0 p-5 text-[#eef2e8]">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#c6d5bf]">Meet the perfumer</p>
                <h2 className="mt-2 text-3xl font-bold leading-tight">{perfumerProfile.name}</h2>
                <p className="mt-2 text-sm font-semibold text-white/78">{perfumerProfile.title}</p>
              </figcaption>
            </motion.figure>

            <motion.div variants={fadeUp} className="rounded-[28px] border border-[#263d27]/12 bg-white/86 p-5 shadow-sm shadow-[#263d27]/5 sm:p-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#eef2e8] px-3 py-1 text-xs font-bold uppercase text-[#263d27]">
                <BriefcaseBusiness className="h-4 w-4" />
                Professional background
              </div>
              <h2 className="mt-5 max-w-2xl text-3xl font-bold leading-tight text-[#0b130c]">
                More than four years in fine fragrance and aroma chemical development.
              </h2>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-relaxed text-[#667264] sm:text-base">
                {perfumerProfile.experienceSummary}
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {perfumerProfile.experience.map((item) => (
                  <article key={item.company} className="rounded-2xl border border-[#263d27]/12 bg-[#fbfaf7] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8d7a4f]">{item.company}</p>
                    <h3 className="mt-2 text-lg font-bold text-[#0b130c]">{item.role}</h3>
                    <ul className="mt-4 space-y-2">
                      {item.highlights.slice(0, 3).map((highlight) => (
                        <li key={highlight} className="flex gap-2 text-sm font-semibold leading-relaxed text-[#667264]">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#263d27]" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.section>

        {categories.length ? (
          <motion.section
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
          >
            <motion.div variants={fadeUp} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#263d27]">Shop</div>
                <h2 className="mt-2 text-3xl font-bold text-[#0b130c]">Choose your scent path</h2>
              </div>
              <Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-bold text-[#263d27]">
                View full catalog
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {storefrontSegments.map((segment, index) => (
                <motion.div key={segment.name} variants={fadeUp}>
                  <Link
                    to={segment.filter === 'bespoke' ? '/bespoke' : `/catalog?segment=${segment.filter}`}
                    className="group block min-h-[220px] rounded-2xl border border-[#263d27]/12 bg-white/82 p-5 shadow-sm shadow-[#263d27]/5 transition hover:-translate-y-1 hover:bg-white hover:shadow-xl hover:shadow-[#263d27]/10"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27] transition group-hover:bg-[#263d27] group-hover:text-[#eef2e8]">
                        {segment.filter === 'bespoke' ? <WandSparkles className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
                      </div>
                      <span className="text-xs font-bold uppercase text-[#8d7a4f]">0{index + 1}</span>
                    </div>
                    <h3 className="mt-8 text-xl font-bold text-[#101b10]">{segment.name}</h3>
                    <p className="mt-3 text-sm font-semibold leading-relaxed text-[#667264]">{segment.description}</p>
                    <div className="mt-6 h-px w-full bg-gradient-to-r from-[#263d27]/35 via-[#8d7a4f]/45 to-transparent" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : null}

        {categories.length ? (
          <motion.section
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
          >
            <motion.div variants={fadeUp} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#263d27]">Categories</div>
                <h2 className="mt-2 text-3xl font-bold">Browse by scent family</h2>
              </div>
            </motion.div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categories.slice(0, 8).map((category) => (
                <motion.div key={category.name} variants={fadeUp}>
                  <Link to={`/catalog?category=${encodeURIComponent(category.name)}`} className={`group flex min-h-[160px] flex-col justify-between rounded-2xl border border-[#263d27]/12 p-5 text-left shadow-sm shadow-[#263d27]/5 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#263d27]/10 ${category.accent}`}>
                    <span className="block text-lg font-bold text-[#101b10]">{category.name}</span>
                    <span className="mt-4 block text-sm font-semibold leading-relaxed text-[#2f3d30]/80">{category.description}</span>
                    <span className="mt-5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-[#263d27] transition group-hover:bg-[#263d27] group-hover:text-white">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : null}

        {homeProducts.length ? (
          <motion.section
            id="products"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="mx-auto max-w-7xl scroll-mt-6 px-4 py-12 sm:px-6 lg:px-8"
          >
            <motion.div variants={fadeUp} className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#263d27]">Featured</div>
                <h2 className="mt-2 text-3xl font-bold">Featured perfumes</h2>
              </div>
            </motion.div>
            <div className="mt-7 grid gap-5 md:grid-cols-3">
              {homeProducts.map((product) => (
                <motion.article
                  key={product.id}
                  variants={fadeUp}
                  whileHover={{ y: -6 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                  className="overflow-hidden rounded-2xl border border-[#263d27]/12 bg-white/88 p-3 shadow-sm shadow-[#263d27]/5"
                >
                  <ProductVisual product={product} className="min-h-[245px]" />
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-bold">{product.name}</h3>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#667264]">{product.notes}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold">{product.price}</div>
                        <div className="text-xs font-bold text-[#667264]">{product.size}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-[#eef2e8] px-3 py-1 text-xs font-bold uppercase text-[#263d27]">{product.mood}</span>
                      <Link to={`/products/${product.slug}`} className="grid h-10 w-10 place-items-center rounded-2xl bg-[#263d27] text-white transition hover:bg-[#1c301d]" aria-label={`View ${product.name}`}>
                        <ShoppingBag className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.section>
        ) : null}

        <section id="bespoke" className="bg-[#050705] text-white">
          <div className="mx-auto grid max-w-7xl gap-7 px-4 py-12 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55 }}>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase text-[#b7c6b1]">
                <WandSparkles className="h-4 w-4" />
                Bespoke service
              </div>
              <h2 className="mt-5 max-w-md text-3xl font-bold sm:text-4xl">Custom perfume requests</h2>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/20"
            >
              <p className="text-sm font-medium leading-relaxed text-white/78">
                Share your favorite notes, mood, budget, and occasion. We will shape them into a personal scent brief.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to="/bespoke" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#eef2e8] px-5 text-sm font-bold text-[#0b130c] transition hover:-translate-y-0.5">
                  Create custom brief
                  <MessageCircle className="h-4 w-4" />
                </Link>
                <Link to="/catalog" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/15 px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10">
                  Explore catalog
                  <ShoppingBag className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </>
  );
};

export default HomePage;
