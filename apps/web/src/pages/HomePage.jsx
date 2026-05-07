import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  MessageSquareHeart,
  Search,
  ShoppingBag,
  Star,
  UserRound,
  WandSparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import {
  feedbackFlowSteps,
  perfumerProfile,
  storefrontSegments,
} from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';

const HomePage = () => {
  const products = useCatalogProducts();
  const categories = useStorefrontCategories(products);
  const homeProducts = products.filter((product) => product.featured).slice(0, 3);
  const limitedProducts = products.filter((product) => product.featured || product.stock <= 8).slice(0, 3);
  const storefrontStats = [
    { value: String(products.length), label: 'Scents' },
    { value: String(limitedProducts.length), label: 'Limited picks' },
    { value: '1:1', label: 'Bespoke' },
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
              <Link to="/login" className="inline-flex h-10 items-center rounded-2xl border bg-white px-4 text-sm font-bold text-[#1f2937]">
                Admin login
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center lg:px-8">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-100 bg-white px-3 py-1 text-xs font-bold uppercase text-amber-700">
              <UserRound className="h-4 w-4" />
              Perfumer profile
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-none sm:text-5xl lg:text-6xl">
              Hello, I am the perfumer.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-[#667085] sm:text-lg">
              {perfumerProfile.intro}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {perfumerProfile.specialties.map((specialty) => (
                <span key={specialty} className="rounded-full border bg-white px-3 py-1 text-xs font-bold uppercase text-muted-foreground">
                  {specialty}
                </span>
              ))}
            </div>
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
            {['Perfumer introduction', 'Regular and limited shop', 'Bespoke and feedback flow'].map((item) => (
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
              <div className="text-xs font-bold uppercase text-amber-700">Shop structure</div>
              <h2 className="mt-1 text-3xl font-bold">Choose a path</h2>
            </div>
            <p className="max-w-xl text-sm font-medium text-muted-foreground">
              Produk regular, produk limited, dan layanan bespoke dipisahkan supaya customer bisa memilih jalur yang paling sesuai.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {storefrontSegments.map((segment) => (
              <Link
                key={segment.name}
                to={segment.filter === 'bespoke' ? '/bespoke' : `/catalog?segment=${segment.filter}`}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5"
              >
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                  {segment.filter === 'bespoke' ? <WandSparkles className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
                </div>
                <h3 className="mt-4 text-lg font-bold">{segment.name}</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">{segment.description}</p>
              </Link>
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
              Kategori dibaca dari daftar yang dibuat di Studio, lalu terhubung ke produk yang memakai kategori tersebut.
            </p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.slice(0, 8).map((category) => (
              <Link key={category.name} to={`/catalog?category=${encodeURIComponent(category.name)}`} className={`min-h-[150px] rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 ${category.accent}`}>
                <span className="block text-lg font-bold">{category.name}</span>
                <span className="mt-3 block text-sm font-semibold leading-relaxed opacity-80">{category.description}</span>
              </Link>
            ))}
          </div>
        </section>

        <section id="products" className="mx-auto max-w-7xl scroll-mt-6 px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase text-amber-700">Featured</div>
              <h2 className="mt-1 text-3xl font-bold">Products to sell</h2>
            </div>
            <Link to="/login" className="hidden h-10 items-center gap-2 rounded-2xl border bg-white px-4 text-sm font-bold sm:inline-flex">
              Admin area
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

        <section id="feedback" className="mx-auto max-w-7xl scroll-mt-6 px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-white px-3 py-1 text-xs font-bold uppercase text-rose-700">
                <MessageSquareHeart className="h-4 w-4" />
                Feedback
              </div>
              <h2 className="mt-4 text-3xl font-bold">Customer feedback flow</h2>
              <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">
                Review produk, bespoke revision, dan repeat order dikumpulkan dalam alur yang jelas setelah customer mencoba scent.
              </p>
              <button type="button" className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl border bg-white px-5 text-sm font-bold text-[#1f2937]">
                Give feedback
                <Star className="h-4 w-4 text-amber-600" />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {feedbackFlowSteps.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-amber-50 text-sm font-bold text-amber-700">{index + 1}</div>
                  <h3 className="mt-4 text-base font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
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
                <Link to="/catalog" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/15 px-5 text-sm font-bold text-white">
                  Explore catalog
                  <ShoppingBag className="h-4 w-4" />
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
