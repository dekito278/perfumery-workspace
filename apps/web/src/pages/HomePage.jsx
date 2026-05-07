import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  MessageCircle,
  ShoppingBag,
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
        <title>Solivagant - Signature and Bespoke Perfume</title>
        <meta name="description" content="Solivagant storefront for signature perfume, limited categories, and bespoke perfume requests." />
      </Helmet>

      <main className="min-h-screen bg-[#f7f8f2] text-[#0b130c]">
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

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center lg:px-8">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#263d27]/15 bg-white px-3 py-1 text-xs font-bold uppercase text-[#263d27]">
              <UserRound className="h-4 w-4" />
              Solivagant
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-none sm:text-5xl lg:text-6xl">
              Signature perfume, made personal.
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
              <Link to="/catalog" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#263d27] px-5 text-sm font-bold text-[#eef2e8] shadow-lg shadow-[#263d27]/20">
                Shop products
                <ShoppingBag className="h-4 w-4" />
              </Link>
              <Link to="/bespoke" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[#263d27]/15 bg-white px-5 text-sm font-bold text-[#0b130c]">
                Bespoke perfume
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {storefrontStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-[#263d27]/12 bg-white p-4">
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

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-[#263d27]">Shop</div>
              <h2 className="mt-1 text-3xl font-bold">Choose your scent path</h2>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {storefrontSegments.map((segment) => (
              <Link
                key={segment.name}
                to={segment.filter === 'bespoke' ? '/bespoke' : `/catalog?segment=${segment.filter}`}
                className="rounded-2xl border border-[#263d27]/12 bg-white p-5 shadow-sm transition hover:-translate-y-0.5"
              >
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
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
              <div className="text-xs font-bold uppercase text-[#263d27]">Categories</div>
              <h2 className="mt-1 text-3xl font-bold">Browse by scent family</h2>
            </div>
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

        {homeProducts.length ? (
        <section id="products" className="mx-auto max-w-7xl scroll-mt-6 px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase text-[#263d27]">Featured</div>
              <h2 className="mt-1 text-3xl font-bold">Featured perfumes</h2>
            </div>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {homeProducts.map((product) => (
              <article key={product.id} className="overflow-hidden rounded-2xl border border-[#263d27]/12 bg-white p-3 shadow-sm">
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
                    <span className="rounded-full bg-[#eef2e8] px-3 py-1 text-xs font-bold uppercase text-[#263d27]">{product.mood}</span>
                    <Link to={`/products/${product.slug}`} className="grid h-10 w-10 place-items-center rounded-2xl bg-[#263d27] text-white" aria-label={`View ${product.name}`}>
                      <ShoppingBag className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        ) : null}

        <section id="bespoke" className="bg-[#050705] text-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase text-[#b7c6b1]">
                <WandSparkles className="h-4 w-4" />
                Bespoke service
              </div>
              <h2 className="mt-4 text-3xl font-bold">Custom perfume requests</h2>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
              <p className="text-sm font-medium leading-relaxed text-white/78">
                Share your favorite notes, mood, budget, and occasion. We will shape them into a personal scent brief.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to="/bespoke" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#eef2e8] px-5 text-sm font-bold text-[#0b130c]">
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
