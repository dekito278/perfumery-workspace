import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Beaker,
  CheckCircle2,
  MessageCircle,
  Search,
  ShoppingBag,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { storefrontCategories } from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';

const ProductVisual = ({ product, className = '' }) => (
  <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${product.visual} ${className}`}>
    <div className="absolute left-8 top-8 h-40 w-20 rounded-[1.8rem] border border-white/70 bg-white/45 shadow-2xl backdrop-blur-sm">
      <div className="mx-auto mt-4 h-5 w-9 rounded-full bg-white/70" />
      <div className="mx-auto mt-8 h-16 w-12 rounded-2xl border border-white/60 bg-white/30" />
    </div>
    <div className="absolute bottom-6 right-6 rounded-2xl bg-white/82 px-4 py-3 text-right shadow-sm backdrop-blur">
      <div className="text-xs font-bold uppercase text-muted-foreground">{product.category}</div>
      <div className="text-sm font-bold text-foreground">{product.size}</div>
    </div>
  </div>
);

const HomePage = () => {
  const products = useCatalogProducts();
  const homeProducts = products.filter((product) => product.featured).slice(0, 3);
  const storefrontStats = [
    { value: String(products.length), label: 'Scents' },
    { value: String(storefrontCategories.length), label: 'Core families' },
    { value: '1:1', label: 'Bespoke consult' },
  ];

  return (
    <>
      <Helmet>
        <title>Dekito Perfumery - Signature and Bespoke Perfume</title>
        <meta name="description" content="Dekito Perfumery storefront for signature perfume, limited categories, and bespoke perfume requests." />
      </Helmet>

      <main className="min-h-screen bg-[#fbfaf7] text-[#1f2937]">
        <section className="border-b border-stone-200 bg-white/80">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/home" className="flex items-center gap-3">
              <img src="/icons/icon-192.png" alt="Dekito" className="h-10 w-10 rounded-2xl" />
              <span className="min-w-0">
                <span className="block text-sm font-bold uppercase text-amber-700">Dekito</span>
                <span className="block text-xs font-semibold text-muted-foreground">Perfumery</span>
              </span>
            </Link>
            <div className="hidden items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm font-semibold text-muted-foreground sm:flex">
              <Search className="h-4 w-4" />
              Search catalog
            </div>
            <div className="flex items-center gap-2">
              <Link to="/cart" className="grid h-10 w-10 place-items-center rounded-2xl border bg-white" aria-label="Open cart"><ShoppingBag className="h-4 w-4" /></Link>
              <Link to="/studio" className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#1f2937] px-4 text-sm font-bold text-white">
                Studio
                <Beaker className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center lg:px-8">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-100 bg-white px-3 py-1 text-xs font-bold uppercase text-amber-700">
              <Sparkles className="h-4 w-4" />
              Small-batch perfume
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-none sm:text-5xl lg:text-6xl">
              Dekito Perfumery
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-[#667085] sm:text-lg">
              Signature scents, limited aroma families, and bespoke perfume requests in one storefront. Built to become a mini e-commerce catalog with product and category management next.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/catalog" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-amber-500 px-5 text-sm font-bold text-[#1f2937] shadow-lg shadow-amber-200/70">
                Shop products
                <ShoppingBag className="h-4 w-4" />
              </Link>
              <Link to="/bespoke" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 text-sm font-bold text-[#1f2937]">
                Bespoke perfume
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {storefrontStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="mt-1 text-xs font-bold uppercase leading-tight text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }} className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
            <ProductVisual product={homeProducts[0]} className="min-h-[360px]" />
            <div className="grid gap-4">
              <ProductVisual product={homeProducts[1]} className="min-h-[172px]" />
              <ProductVisual product={homeProducts[2]} className="min-h-[172px]" />
            </div>
          </motion.div>
        </section>

        <section className="border-y border-stone-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:grid-cols-3 sm:px-6 lg:px-8">
            {['Ready product catalog', 'Limited scent families', 'Custom perfume intake'].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm font-bold text-[#344054]">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-amber-700">Categories</div>
              <h2 className="mt-1 text-3xl font-bold">Browse by scent family</h2>
            </div>
            <p className="max-w-xl text-sm font-medium text-muted-foreground">
              Kategori masih terbatas untuk menjaga katalog tetap mudah dipilih. Nanti bagian ini bisa disambungkan ke admin category management.
            </p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {storefrontCategories.map((category) => (
              <button key={category.name} type="button" className={`min-h-[150px] rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 ${category.accent}`}>
                <span className="block text-lg font-bold">{category.name}</span>
                <span className="mt-3 block text-sm font-semibold leading-relaxed opacity-80">{category.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section id="products" className="mx-auto max-w-7xl scroll-mt-6 px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase text-amber-700">Featured</div>
              <h2 className="mt-1 text-3xl font-bold">Products to sell</h2>
            </div>
            <Link to="/studio" className="hidden h-10 items-center gap-2 rounded-2xl border bg-white px-4 text-sm font-bold sm:inline-flex">
              Manage products later
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {homeProducts.map((product) => (
              <article key={product.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
                <ProductVisual product={product} className="min-h-[240px]" />
                <div className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold">{product.name}</h3>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">{product.notes}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold">{product.price}</div>
                      <div className="text-xs font-bold text-muted-foreground">{product.size}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase text-amber-800">{product.mood}</span>
                    <Link to={`/products/${product.slug}`} className="grid h-10 w-10 place-items-center rounded-2xl bg-[#1f2937] text-white" aria-label={`View ${product.name}`}>
                      <ShoppingBag className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="bespoke" className="bg-[#1f2937] text-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase text-amber-200">
                <WandSparkles className="h-4 w-4" />
                Bespoke service
              </div>
              <h2 className="mt-4 text-3xl font-bold">Custom perfume requests</h2>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
              <p className="text-sm font-medium leading-relaxed text-white/78">
                Tahap berikutnya bisa menambahkan form untuk notes favorit, karakter aroma, budget, ukuran botol, dan kontak customer. Untuk sekarang, section ini sudah menyiapkan posisi fitur bespoke di halaman depan.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to="/bespoke" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-amber-400 px-5 text-sm font-bold text-[#1f2937]">
                  Create custom brief
                  <MessageCircle className="h-4 w-4" />
                </Link>
                <Link to="/studio" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/15 px-5 text-sm font-bold text-white">
                  Open Perfumer Studio
                  <Beaker className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default HomePage;
