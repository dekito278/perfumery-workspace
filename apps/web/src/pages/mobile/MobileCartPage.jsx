import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Minus, PackageCheck, Plus, ShoppingBag, Sparkles, Trash2 } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { Button } from '@/components/ui/button.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import { useCart } from '@/hooks/useCart.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;

const MobileCartPage = () => {
  const navigate = useNavigate();
  const { items, summary, updateQuantity, removeItem } = useCart();
  const products = useCatalogProducts();
  const decreaseQuantity = (item) => item.quantity <= 1 ? removeItem(item.slug) : updateQuantity(item.slug, item.quantity - 1);
  const getCartItemProduct = (item) => {
    const product = products.find((entry) => entry.slug === item.productSlug || entry.slug === item.slug || entry.id === item.productId);
    return {
      ...(product || {}),
      ...item,
      id: product?.id || item.productId,
      slug: product?.slug || item.productSlug || item.slug,
      category: product?.category || item.category,
      images: product?.images,
      imageUrl: product?.imageUrl,
    };
  };
  const featuredCartItems = items.slice(0, 3).map((item) => ({ item, product: getCartItemProduct(item) }));

  return (
    <MobileCommerceLayout>
      <Helmet><title>Keranjang - Solivagant</title></Helmet>
      <main className="mobile-page">
        <section className="mobile-soft-card p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_86px] gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase text-amber-700">{items.length ? 'Subtotal' : 'Keranjang'}</div>
              <div className="mt-1 text-3xl font-bold leading-tight text-[#1f2937]">{items.length ? formatTotal(summary.subtotal) : 'Mulai belanja'}</div>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">
                {items.length ? 'Cek item di sini, lalu lanjutkan untuk isi pengiriman dan pembayaran.' : 'Pilih parfum ready stock atau mulai request aroma custom.'}
              </p>
            </div>
            {featuredCartItems[0] ? (
              <ProductVisual
                product={featuredCartItems[0].product}
                className="h-[86px] rounded-[16px]"
                label={false}
                priority
                sizes="86px"
              />
            ) : (
              <div className="grid h-[86px] place-items-center rounded-[16px] border border-[#263d27]/10 bg-white/78 text-[#263d27]">
                <ShoppingBag className="h-6 w-6" />
              </div>
            )}
          </div>
          {items.length ? (
            <div className="mt-3 grid gap-2">
              {featuredCartItems.map(({ item, product }) => (
                <div key={item.slug} className="mobile-commerce-panel flex items-center justify-between gap-3 bg-white/70 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <ProductVisual product={product} className="h-10 w-10 shrink-0 rounded-[12px]" label={false} sizes="40px" />
                    <div className="min-w-0"><p className="truncate text-xs font-bold">{item.name}</p><p className="mt-0.5 text-[10px] font-bold uppercase text-[#8b949e]">{item.size} / x{item.quantity}</p></div>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-[#263d27]">{formatTotal(Number(item.priceNumber || 0) * Number(item.quantity || 0))}</span>
                </div>
              ))}
            </div>
          ) : null}
          {items.length ? (
            <Button type="button" className="mt-4 h-12 w-full rounded-2xl gap-2" onClick={() => navigate('/mobile/checkout')}><PackageCheck className="h-4 w-4" />Lanjut bayar</Button>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" className="h-11 rounded-2xl gap-2" onClick={() => navigate('/mobile/catalog')}>
                <ShoppingBag className="h-4 w-4" />
                Belanja
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => navigate('/mobile/bespoke')}>
                Custom
              </Button>
            </div>
          )}
        </section>
        <section className="grid gap-3">
          {items.map((item) => (
            <article key={item.slug} className="mobile-card p-3">
              <div className="grid grid-cols-[76px_minmax(0,1fr)_42px] items-start gap-3">
                <ProductVisual product={getCartItemProduct(item)} className="h-[76px] rounded-[16px]" label={false} sizes="76px" />
                <div className="min-w-0">
                  <h2 className="mobile-line-clamp-2 text-sm font-bold leading-tight">{item.name}</h2>
                  <p className="mt-1 mobile-line-clamp-2 text-xs font-semibold leading-snug text-[#6b7280]">{item.notes}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase text-amber-700">{item.price} / {item.size}</p>
                </div>
                <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0 rounded-[14px] border-rose-200 bg-rose-50 text-rose-700" onClick={() => removeItem(item.slug)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="inline-flex items-center rounded-[14px] border border-[#263d27]/10 bg-white p-1">
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => decreaseQuantity(item)}><Minus className="h-4 w-4" /></Button>
                  <span className="grid h-8 min-w-10 place-items-center text-sm font-bold">{item.quantity}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => updateQuantity(item.slug, item.quantity + 1)}><Plus className="h-4 w-4" /></Button>
                </div>
                <span className="text-sm font-bold text-[#263d27]">{formatTotal(Number(item.priceNumber || 0) * Number(item.quantity || 0))}</span>
              </div>
            </article>
          ))}
          {!items.length ? <StateBlock className="mobile-card" icon={ShoppingBag} title="Keranjang kosong" description="Pilih parfum dari katalog untuk mulai belanja." action="Buka katalog" onAction={() => navigate('/mobile/catalog')} /> : null}
        </section>
        {items.length ? (
          <section className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => navigate('/mobile/catalog')} className="mobile-commerce-choice flex min-h-[82px] flex-col justify-between">
              <ShoppingBag className="h-4 w-4 text-[#263d27]" />
              <span className="text-left text-xs font-bold leading-tight text-[#0b130c]">Tambah aroma</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700">Katalog <ArrowRight className="h-3 w-3" /></span>
            </button>
            <button type="button" onClick={() => navigate('/mobile/bespoke')} className="mobile-commerce-choice flex min-h-[82px] flex-col justify-between">
              <Sparkles className="h-4 w-4 text-[#263d27]" />
              <span className="text-left text-xs font-bold leading-tight text-[#0b130c]">Custom aroma</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700">Brief <ArrowRight className="h-3 w-3" /></span>
            </button>
          </section>
        ) : null}
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileCartPage;
