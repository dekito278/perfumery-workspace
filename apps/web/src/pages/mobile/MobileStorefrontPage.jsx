import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Beaker,
  Filter,
  MessageCircle,
  Search,
  ShoppingBag,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { storefrontCategories } from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';

const ProductVisual = ({ product }) => (
  <div className={`relative h-36 overflow-hidden rounded-2xl bg-gradient-to-br ${product.visual}`}>
    <div className="absolute left-5 top-5 h-24 w-12 rounded-[1.2rem] border border-white/70 bg-white/45 shadow-xl backdrop-blur-sm">
      <div className="mx-auto mt-2 h-3 w-5 rounded-full bg-white/70" />
      <div className="mx-auto mt-4 h-10 w-7 rounded-xl border border-white/60 bg-white/30" />
    </div>
    <div className="absolute bottom-4 right-4 rounded-2xl bg-white/80 px-3 py-2 text-right shadow-sm backdrop-blur">
      <div className="text-[10px] font-bold uppercase text-[#6b7280]">{product.category}</div>
      <div className="text-xs font-bold text-[#1f2937]">{product.size}</div>
    </div>
  </div>
);

const MobileStorefrontPage = () => {
  const navigate = useNavigate();
  const products = useCatalogProducts();
  const homeProducts = products.filter((product) => product.featured).slice(0, 3);
  const storefrontStats = [
    { value: String(products.length), label: 'Scents' },
    { value: String(storefrontCategories.length), label: 'Core families' },
    { value: '1:1', label: 'Bespoke consult' },
  ];

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet>
        <title>Dekito Perfumery - Home</title>
        <meta name="description" content="Dekito Perfumery storefront with featured perfumes, scent categories, and bespoke perfume consultation." />
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Dekito"
          subtitle="Perfumery shop"
          eyebrow="Home"
          action={<button type="button" onClick={() => navigate('/mobile/cart')} aria-label="Open cart"><ShoppingBag className="h-5 w-5 text-amber-700" /></button>}
        />

        <section className="mobile-soft-card overflow-hidden">
          <div className="p-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase text-amber-700">
              <Sparkles className="h-3.5 w-3.5" />
              Small-batch perfume
            </div>
            <h2 className="mt-3 text-[28px] font-bold leading-none text-[#1f2937]">
              Signature scents and custom perfume.
            </h2>
            <p className="mt-3 text-sm font-medium leading-relaxed text-[#6b7280]">
              Jelajahi parfum siap pakai, pilih keluarga aroma, atau mulai bespoke scent yang dibuat sesuai preferensi.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button className="rounded-2xl" onClick={() => navigate('/mobile/catalog')}>
                Shop
              </Button>
              <Button variant="outline" className="rounded-2xl bg-white" onClick={() => navigate('/mobile/bespoke')}>
                Custom
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-amber-100 bg-white/70">
            {storefrontStats.map((stat) => (
              <div key={stat.label} className="px-3 py-3 text-center">
                <div className="text-base font-bold text-[#1f2937]">{stat.value}</div>
                <div className="text-[10px] font-bold uppercase leading-tight text-[#8b949e]">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mobile-card flex items-center gap-2 p-2">
          <div className="flex h-11 flex-1 items-center gap-2 rounded-2xl bg-[#f8f7f4] px-3 text-sm font-semibold text-[#8b949e]">
            <Search className="h-4 w-4" />
            Search perfume
          </div>
          <Button type="button" size="icon" variant="outline" className="h-11 w-11 rounded-2xl bg-white" aria-label="Filter catalog">
            <Filter className="h-4 w-4" />
          </Button>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Categories</h2>
            <span className="text-xs font-bold text-amber-700">Limited drops</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {storefrontCategories.map((category) => (
              <button key={category.name} type="button" className={`min-h-[112px] rounded-2xl border p-3 text-left ${category.accent}`}>
                <span className="block text-sm font-bold">{category.name}</span>
                <span className="mt-2 block text-[11px] font-semibold leading-snug opacity-80">{category.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section id="mobile-products" className="space-y-3 scroll-mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Featured products</h2>
            <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => navigate('/mobile/catalog')}>View all</Button>
          </div>
          {homeProducts.map((product) => (
            <article key={product.id} className="mobile-card overflow-hidden p-3">
              <button type="button" onClick={() => navigate(`/mobile/products/${product.slug}`)} className="block w-full text-left">
                <ProductVisual product={product} />
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-[#1f2937]">{product.name}</h3>
                    <p className="mt-1 text-xs font-semibold text-[#6b7280]">{product.notes}</p>
                    <p className="mt-1 text-[11px] font-bold uppercase text-amber-700">{product.mood}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold text-[#1f2937]">{product.price}</div>
                    <div className="text-[10px] font-bold text-[#8b949e]">{product.size}</div>
                  </div>
                </div>
              </button>
            </article>
          ))}
        </section>

        <section id="mobile-custom" className="mobile-card scroll-mt-4 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <WandSparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-[#1f2937]">Bespoke perfume</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                Customer bisa request mood, notes, budget, dan occasion. Di tahap berikutnya ini bisa jadi form order custom.
              </p>
              <Button className="mt-3 h-10 rounded-2xl gap-2" onClick={() => navigate('/mobile/bespoke')}>
                Start custom request
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        <Link to="/mobile/studio" className="mobile-card flex items-center gap-3 p-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            <Beaker className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-[#1f2937]">Perfumer Studio</span>
            <span className="block text-xs font-semibold text-[#6b7280]">Briefs, formulas, materials, validation</span>
          </span>
          <MessageCircle className="h-4 w-4 text-[#9ca3af]" />
        </Link>
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileStorefrontPage;
