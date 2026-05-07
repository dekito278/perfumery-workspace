import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Filter,
  MessageSquareHeart,
  Search,
  ShoppingBag,
  Star,
  UserRound,
  WandSparkles,
} from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import {
  feedbackFlowSteps,
  perfumerProfile,
  storefrontSegments,
} from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';

const MobileStorefrontPage = () => {
  const navigate = useNavigate();
  const products = useCatalogProducts();
  const categories = useStorefrontCategories(products);
  const homeProducts = products.filter((product) => product.featured).slice(0, 3);
  const limitedProducts = products.filter((product) => product.featured || product.stock <= 8).slice(0, 2);
  const storefrontStats = [
    { value: String(products.length), label: 'Scents' },
    { value: String(limitedProducts.length), label: 'Limited picks' },
    { value: '1:1', label: 'Bespoke' },
  ];

  return (
    <MobileCommerceLayout>
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
              <UserRound className="h-3.5 w-3.5" />
              Perfumer profile
            </div>
            <h2 className="mt-3 text-[28px] font-bold leading-none text-[#1f2937]">
              Hello, I am the perfumer.
            </h2>
            <p className="mt-3 text-sm font-medium leading-relaxed text-[#6b7280]">
              {perfumerProfile.intro}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {perfumerProfile.specialties.map((specialty) => (
                <span key={specialty} className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase text-[#6b7280]">
                  {specialty}
                </span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button className="rounded-2xl" onClick={() => navigate('/mobile/catalog')}>
                Shop
              </Button>
              <Button variant="outline" className="rounded-2xl bg-white" onClick={() => navigate('/mobile/bespoke')}>
                Bespoke
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

        <section className="grid grid-cols-3 gap-2">
          {storefrontSegments.map((segment) => (
            <button
              key={segment.name}
              type="button"
              onClick={() => {
                if (segment.filter === 'bespoke') navigate('/mobile/bespoke');
                else navigate(`/mobile/catalog?segment=${segment.filter}`);
              }}
              className="mobile-card min-h-[104px] p-3 text-left"
            >
              <span className="block text-[11px] font-bold leading-tight text-[#1f2937]">{segment.name}</span>
              <span className="mt-2 block text-[10px] font-semibold leading-snug text-[#8b949e]">{segment.description}</span>
            </button>
          ))}
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

        <section className="mobile-card p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-700">
              <MessageSquareHeart className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-[#1f2937]">Feedback flow</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                Review aroma, ketahanan, dan masukan untuk batch atau bespoke berikutnya.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {feedbackFlowSteps.map((step, index) => (
              <div key={step.title} className="flex gap-2 rounded-2xl bg-[#fbfaf7] p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-amber-700">{index + 1}</span>
                <span>
                  <span className="block text-xs font-bold text-[#1f2937]">{step.title}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-[#6b7280]">{step.description}</span>
                </span>
              </div>
            ))}
          </div>
          <Button variant="outline" className="mt-3 h-10 w-full rounded-2xl bg-white gap-2">
            <Star className="h-4 w-4" />
            Give feedback
          </Button>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Categories</h2>
            <span className="text-xs font-bold text-amber-700">Shop families</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {categories.slice(0, 6).map((category) => (
              <button key={category.name} type="button" onClick={() => navigate(`/mobile/catalog?category=${encodeURIComponent(category.name)}`)} className={`min-h-[112px] rounded-2xl border p-3 text-left ${category.accent}`}>
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
          <div className="grid grid-cols-2 gap-3">
          {homeProducts.map((product) => (
            <article key={product.id} className="mobile-card min-w-0 overflow-hidden p-2">
              <button type="button" onClick={() => navigate(`/mobile/products/${product.slug}`)} className="block w-full text-left">
                <ProductVisual product={product} className="aspect-square rounded-2xl" bottleClassName="left-4 top-4 h-16 w-8 rounded-[1rem]" label={false} />
                <div className="mt-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-[#1f2937]">{product.name}</h3>
                    <p className="mt-1 text-xs font-semibold text-[#6b7280]">{product.notes}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-[#1f2937]">{product.price}</div>
                    <div className="text-[10px] font-bold text-[#8b949e]">{product.size}</div>
                  </div>
                </div>
              </button>
            </article>
          ))}
          </div>
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
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileStorefrontPage;
