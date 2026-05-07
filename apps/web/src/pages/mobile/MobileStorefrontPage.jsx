import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Gem,
  Leaf,
  PackagePlus,
  ShoppingBag,
  Sparkles,
  UserRound,
  WandSparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import {
  perfumerProfile,
  storefrontSegments,
} from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const mobileNotes = [
  { icon: Sparkles, label: 'Luxury' },
  { icon: Leaf, label: 'Fine notes' },
  { icon: Gem, label: 'Personal' },
];

const mobileHomeAssets = {
  rawMaterialLibrary: '/brand/home/raw-material-library.jpg',
  perfumerPipettes: '/brand/home/perfumer-pipettes.jpg',
};

const MobileStorefrontPage = () => {
  const navigate = useNavigate();
  const products = useCatalogProducts();
  const categories = useStorefrontCategories(products);
  const homeProducts = products.filter((product) => product.featured).slice(0, 3);
  const limitedProducts = products.filter((product) => product.featured || product.stock <= 8).slice(0, 2);
  const productsLoading = Boolean(products.loading);
  const hasProducts = products.length > 0;
  const storefrontStats = [
    { value: String(products.length), label: 'Scents' },
    { value: String(limitedProducts.length), label: 'Limited picks' },
    { value: '1:1', label: 'Bespoke' },
  ];

  return (
    <MobileCommerceLayout>
      <Helmet>
        <title>Solivagant - Home</title>
        <meta name="description" content="Solivagant storefront with featured perfumes, scent categories, and bespoke perfume consultation." />
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Solivagant"
          subtitle="Perfumery shop"
          eyebrow="Home"
          action={<button type="button" onClick={() => navigate('/mobile/cart')} aria-label="Open cart"><ShoppingBag className="h-5 w-5 text-[#263d27]" /></button>}
        />

        <motion.section
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="mobile-soft-card overflow-hidden border-[#263d27]/14 bg-[linear-gradient(145deg,#fbfaf4,#eef4eb_58%,#f7efe3)] shadow-xl shadow-[#263d27]/8"
        >
          <div className="p-4">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-[#263d27]/12 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase text-[#263d27] shadow-sm">
              <UserRound className="h-3.5 w-3.5" />
              Solivagant Studio
            </motion.div>
            <motion.h2 variants={fadeUp} className="mt-3 text-[28px] font-bold leading-none text-[#0b130c]">
              Signature perfume, made personal.
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-3 text-sm font-medium leading-relaxed text-[#526351]">
              {perfumerProfile.intro}
            </motion.p>
            <motion.div variants={fadeUp} className="mt-3 grid grid-cols-3 gap-2">
              {mobileNotes.map((note) => {
                const Icon = note.icon;

                return (
                  <div key={note.label} className="rounded-2xl border border-[#263d27]/10 bg-white/64 px-2 py-2 text-center">
                    <Icon className="mx-auto h-3.5 w-3.5 text-[#263d27]" />
                    <span className="mt-1 block text-[10px] font-bold uppercase leading-tight text-[#526351]">{note.label}</span>
                  </div>
                );
              })}
            </motion.div>
            <motion.div variants={fadeUp} className="mt-3 flex flex-wrap gap-2">
              {perfumerProfile.specialties.map((specialty) => (
                <span key={specialty} className="rounded-full border border-[#263d27]/10 bg-white/78 px-3 py-1 text-[10px] font-bold uppercase text-[#667264]">
                  {specialty}
                </span>
              ))}
            </motion.div>
            <motion.div variants={fadeUp} className="mt-4 grid grid-cols-2 gap-2">
              <Button className="rounded-2xl shadow-lg shadow-[#263d27]/18" onClick={() => navigate('/mobile/catalog')}>
                Shop
              </Button>
              <Button variant="outline" className="rounded-2xl bg-white" onClick={() => navigate('/mobile/bespoke')}>
                Bespoke
              </Button>
            </motion.div>
          </div>
          <div className="grid grid-cols-3 border-t border-[#263d27]/12 bg-white/70">
            {storefrontStats.map((stat) => (
              <div key={stat.label} className="px-3 py-3 text-center">
                <div className="text-base font-bold text-[#0b130c]">{stat.value}</div>
                <div className="text-[10px] font-bold uppercase leading-tight text-[#8b949e]">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mobile-card overflow-hidden bg-[#050705] text-[#eef2e8] shadow-xl shadow-[#263d27]/14"
        >
          <div className="relative min-h-[220px]">
            <img src={mobileHomeAssets.rawMaterialLibrary} alt="Solivagant raw material library" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,5,0.08),rgba(5,7,5,0.82))]" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#c6d5bf]">Inside the atelier</p>
              <h2 className="mt-2 text-xl font-bold leading-tight">Real raw materials, real studio work.</h2>
            </div>
          </div>
          <div className="grid grid-cols-[0.86fr_1.14fr] gap-3 p-3">
            <img src={mobileHomeAssets.perfumerPipettes} alt="Solivagant perfumer holding pipettes" className="h-32 w-full rounded-2xl object-cover object-[58%_42%]" />
            <div className="grid content-center rounded-2xl border border-white/10 bg-white/8 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c6d5bf]">Perfumer led</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-white/80">A personal scent process shaped by hand, notes, and memory.</p>
            </div>
          </div>
        </motion.section>

        {!hasProducts ? (
          <motion.section variants={fadeUp} initial="hidden" animate="visible" className="mobile-card overflow-hidden">
            <div className="bg-[linear-gradient(145deg,#050705,#111a11)] p-4 text-[#eef2e8]">
              <img src="/brand/solivagant-logo.png" alt="Solivagant" className="h-14 w-40 rounded-2xl object-contain" />
              <div className="mt-5 h-px w-20 bg-[#8d7a4f]" />
              <h2 className="mt-4 text-xl font-bold leading-tight">{productsLoading ? 'Memuat koleksi parfum.' : 'Private scent atelier is being prepared.'}</h2>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#cbd6c5]">
                {productsLoading
                  ? 'Sebentar, kami sedang mengambil daftar parfum terbaru.'
                  : 'Produk akan tampil setelah ditambahkan dari Studio. Untuk sekarang, customer bisa mulai dari request bespoke.'}
              </p>
            </div>
            {!productsLoading ? (
            <div className="grid grid-cols-2 gap-2 p-3">
              <Button className="rounded-2xl gap-2" onClick={() => navigate('/mobile/bespoke')}>
                Bespoke
                <WandSparkles className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => navigate('/mobile/login')}>
                Add product
                <PackagePlus className="h-4 w-4" />
              </Button>
            </div>
            ) : null}
          </motion.section>
        ) : null}

        <motion.section variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} className="grid grid-cols-3 gap-2">
          {storefrontSegments.map((segment, index) => (
            <motion.div key={segment.name} variants={fadeUp}>
              <button
                type="button"
                onClick={() => {
                  if (segment.filter === 'bespoke') navigate('/mobile/bespoke');
                  else navigate(`/mobile/catalog?segment=${segment.filter}`);
                }}
                className="mobile-card min-h-[116px] w-full overflow-hidden p-3 text-left shadow-sm shadow-[#263d27]/6"
              >
                <span className="mb-7 block text-[10px] font-bold uppercase text-[#8d7a4f]">0{index + 1}</span>
                <span className="block text-[11px] font-bold leading-tight text-[#0b130c]">{segment.name}</span>
              </button>
            </motion.div>
          ))}
        </motion.section>

        {categories.length ? (
        <motion.section variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Categories</h2>
            <span className="text-xs font-bold text-[#263d27]">Shop families</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {categories.slice(0, 6).map((category) => (
              <motion.div key={category.name} variants={fadeUp}>
                <button type="button" onClick={() => navigate(`/mobile/catalog?category=${encodeURIComponent(category.name)}`)} className={`min-h-[112px] rounded-2xl border p-3 text-left ${category.accent}`}>
                  <span className="block text-sm font-bold">{category.name}</span>
                  <span className="mt-2 block text-[11px] font-semibold leading-snug opacity-80">{category.description}</span>
                </button>
              </motion.div>
            ))}
          </div>
        </motion.section>
        ) : null}

        {homeProducts.length ? (
        <motion.section variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} id="mobile-products" className="space-y-3 scroll-mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Featured products</h2>
            <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => navigate('/mobile/catalog')}>View all</Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
          {homeProducts.map((product) => (
            <motion.article key={product.id} variants={fadeUp} className="mobile-card min-w-0 overflow-hidden p-2 shadow-sm shadow-[#263d27]/6">
              <button type="button" onClick={() => navigate(`/mobile/products/${product.slug}`)} className="block w-full text-left">
                <ProductVisual product={product} className="aspect-square rounded-2xl" bottleClassName="left-4 top-4 h-16 w-8 rounded-[1rem]" label={false} />
                <div className="mt-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-[#0b130c]">{product.name}</h3>
                    <p className="mt-1 text-xs font-semibold text-[#6b7280]">{product.notes}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-[#0b130c]">{product.price}</div>
                    <div className="text-[10px] font-bold text-[#8b949e]">{product.size}</div>
                  </div>
                </div>
              </button>
            </motion.article>
          ))}
          </div>
        </motion.section>
        ) : null}

        <motion.section initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} id="mobile-custom" className="mobile-card scroll-mt-4 border-[#263d27]/12 bg-[#050705] p-4 text-white shadow-xl shadow-[#263d27]/14">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
              <WandSparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-white">Bespoke perfume</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-white/70">
                Request a scent by mood, notes, budget, and occasion.
              </p>
              <Button className="mt-3 h-10 rounded-2xl gap-2 bg-[#eef2e8] text-[#0b130c] hover:bg-white" onClick={() => navigate('/mobile/bespoke')}>
                Start custom request
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.section>
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileStorefrontPage;
