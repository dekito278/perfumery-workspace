import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  PackagePlus,
  ShoppingBag,
  UserRound,
  WandSparkles,
} from 'lucide-react';
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

        <section className="mobile-soft-card overflow-hidden">
          <div className="p-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase text-[#263d27]">
              <UserRound className="h-3.5 w-3.5" />
              Solivagant
            </div>
            <h2 className="mt-3 text-[28px] font-bold leading-none text-[#0b130c]">
              Signature perfume, made personal.
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
          <div className="grid grid-cols-3 border-t border-[#263d27]/12 bg-white/70">
            {storefrontStats.map((stat) => (
              <div key={stat.label} className="px-3 py-3 text-center">
                <div className="text-base font-bold text-[#0b130c]">{stat.value}</div>
                <div className="text-[10px] font-bold uppercase leading-tight text-[#8b949e]">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {!hasProducts ? (
          <section className="mobile-card overflow-hidden">
            <div className="bg-[#050705] p-4 text-[#eef2e8]">
              <img src="/brand/solivagant-logo.png" alt="Solivagant" className="h-14 w-40 rounded-2xl object-contain" />
              <h2 className="mt-5 text-xl font-bold leading-tight">{productsLoading ? 'Memuat koleksi parfum.' : 'Koleksi parfum sedang disiapkan.'}</h2>
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
          </section>
        ) : null}

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
              <span className="block text-[11px] font-bold leading-tight text-[#0b130c]">{segment.name}</span>
            </button>
          ))}
        </section>

        {categories.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Categories</h2>
            <span className="text-xs font-bold text-[#263d27]">Shop families</span>
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
        ) : null}

        {homeProducts.length ? (
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
                    <h3 className="truncate text-sm font-bold text-[#0b130c]">{product.name}</h3>
                    <p className="mt-1 text-xs font-semibold text-[#6b7280]">{product.notes}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-[#0b130c]">{product.price}</div>
                    <div className="text-[10px] font-bold text-[#8b949e]">{product.size}</div>
                  </div>
                </div>
              </button>
            </article>
          ))}
          </div>
        </section>
        ) : null}

        <section id="mobile-custom" className="mobile-card scroll-mt-4 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
              <WandSparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-[#0b130c]">Bespoke perfume</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                Request a scent by mood, notes, budget, and occasion.
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
