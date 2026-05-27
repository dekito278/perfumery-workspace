import React, { useCallback, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenText,
  ClipboardCheck,
  Gem,
  Leaf,
  PackagePlus,
  Search,
  ShoppingBag,
  Sparkles,
  UserRound,
  WandSparkles,
} from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import {
  perfumerProfile,
} from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useMobileRenderSectionMonitor } from '@/hooks/useMobileRenderSectionMonitor.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';
import {
  getProductLowStock,
  getVisibleProductTags,
  isProductVisibleInStorefront,
} from '@/services/productCatalogService.js';
import { logMobileRenderIssue } from '@/utils/mobileRenderMonitoring.js';
import { getMobileFromState, getMobileScrollTop } from '@/hooks/useMobileBackNavigation.js';

const mobileNotes = [
  { icon: Sparkles, label: 'Luxury' },
  { icon: Leaf, label: 'Fine notes' },
  { icon: Gem, label: 'Personal' },
];

const mobileHomeAssets = {
  rawMaterialLibrary: '/brand/home/raw-material-library.jpg',
  perfumerPipettes: '/brand/home/perfumer-pipettes.jpg',
};
const PRODUCT_NAVIGATION_SCROLL_SETTLE_MS = 1000;

const getProductCategoryLabel = (product) => product?.category || 'Solivagant';
const getProductStockLabel = (product) => (Number(product?.stock || 0) > 0 ? `${Number(product.stock)} pcs` : 'Habis');
const getProductSizeLabels = (product) => {
  const variantSizes = (product?.variants || []).map((variant) => variant?.size).filter(Boolean);
  return (variantSizes.length ? variantSizes : [product?.size || '30 ml']).slice(0, 2);
};
const getProductPrimaryTag = (product) => getVisibleProductTags(product).find(Boolean) || (product?.featured ? 'Pilihan' : 'Aroma khas');

export const MobileStorefrontContent = ({ active = true }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const outgoingScrollTopRef = useRef(0);
  const initialScrollTopRef = useRef(0);
  const stableScrollTopRef = useRef(0);
  const latestScrollTopRef = useRef(0);
  const lastScrollAtRef = useRef(0);
  const hasUserScrollIntentRef = useRef(false);
  const catalogProducts = useCatalogProducts({ active });
  const products = useMemo(() => catalogProducts.filter(isProductVisibleInStorefront), [catalogProducts]);
  const categories = useStorefrontCategories(products, { active });
  const homeProducts = useMemo(() => products.filter((product) => product.featured).slice(0, 3), [products]);
  const quickProducts = useMemo(() => (homeProducts.length ? homeProducts : products).slice(0, 4), [homeProducts, products]);
  const heroProduct = quickProducts[0];
  const productsLoading = Boolean(catalogProducts.loading);
  const hasProducts = products.length > 0;
  const captureOutgoingScrollTop = useCallback(() => {
    if (!hasUserScrollIntentRef.current) {
      outgoingScrollTopRef.current = initialScrollTopRef.current;
      return;
    }

    const currentScrollTop = getMobileScrollTop();
    const scrollIsSettled = Date.now() - lastScrollAtRef.current > PRODUCT_NAVIGATION_SCROLL_SETTLE_MS;
    if (scrollIsSettled) {
      stableScrollTopRef.current = currentScrollTop;
      latestScrollTopRef.current = currentScrollTop;
    }
    outgoingScrollTopRef.current = scrollIsSettled ? currentScrollTop : stableScrollTopRef.current;
  }, []);

  React.useEffect(() => {
    if (!active) return undefined;

    initialScrollTopRef.current = getMobileScrollTop();
    stableScrollTopRef.current = initialScrollTopRef.current;
    latestScrollTopRef.current = stableScrollTopRef.current;
    outgoingScrollTopRef.current = stableScrollTopRef.current;
    hasUserScrollIntentRef.current = false;
    let timeoutId = 0;
    const markUserScrollIntent = () => {
      hasUserScrollIntentRef.current = true;
    };
    const updateStableScrollTop = () => {
      latestScrollTopRef.current = getMobileScrollTop();
      lastScrollAtRef.current = Date.now();
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        stableScrollTopRef.current = latestScrollTopRef.current;
      }, PRODUCT_NAVIGATION_SCROLL_SETTLE_MS);
    };

    window.addEventListener('wheel', markUserScrollIntent, { passive: true });
    window.addEventListener('touchmove', markUserScrollIntent, { passive: true });
    window.addEventListener('keydown', markUserScrollIntent);
    window.addEventListener('scroll', updateStableScrollTop, { passive: true });
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('wheel', markUserScrollIntent);
      window.removeEventListener('touchmove', markUserScrollIntent);
      window.removeEventListener('keydown', markUserScrollIntent);
      window.removeEventListener('scroll', updateStableScrollTop);
    };
  }, [active]);
  const handleStaticImageError = (source) => {
    logMobileRenderIssue('image-load-failed', {
      source,
    }, {
      throttleKey: `image-load-failed:${source}`,
    });
  };

  useMobileRenderSectionMonitor({
    active,
    loading: productsLoading,
    section: 'mobile-home-featured-products',
    visibleCount: quickProducts.length,
    expectedCount: products.length,
    reason: products.length ? 'no-home-products' : 'no-products',
  });

  return (
    <>
      {active ? (
      <Helmet>
        <title>Solivagant - Beranda</title>
        <meta name="description" content="Solivagant storefront with featured perfumes, scent categories, and bespoke perfume consultation." />
      </Helmet>
      ) : null}
      <main className="mobile-page">
        <section className="mobile-soft-card mobile-commerce-hero overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_126px] gap-3 p-3">
            <div className="min-w-0">
              <div className="mobile-commerce-chip max-w-full gap-1.5 px-2.5 py-1 text-[9px] uppercase shadow-sm">
                <ShoppingBag className="h-3 w-3 shrink-0" />
                <span className="truncate">{productsLoading ? 'Memuat katalog' : `${products.length || 0} parfum`}</span>
              </div>
              <h1 className="mt-2 text-[22px] font-bold leading-[1.02] text-[#0b130c]">
                Belanja parfum Solivagant.
              </h1>
              <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-[#526351]">
                Pilih aroma ready stock, custom aroma, atau cek progress order.
              </p>
              <div className="mt-3 flex gap-2">
                <Button className="h-11 rounded-2xl px-3 text-xs shadow-lg shadow-[#263d27]/16" onClick={() => navigate('/mobile/catalog')}>
                  <ShoppingBag className="h-4 w-4" />
                  Belanja
                </Button>
                <Button variant="outline" className="h-11 rounded-2xl bg-white px-3 text-xs" onClick={() => navigate('/mobile/bespoke')}>
                  Custom
                </Button>
              </div>
            </div>
            {heroProduct ? (
              <button
                type="button"
                onPointerDown={captureOutgoingScrollTop}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') captureOutgoingScrollTop();
                }}
                onClick={() => navigate(`/mobile/products/${heroProduct.slug}`, { state: getMobileFromState(location, outgoingScrollTopRef.current) })}
                className="mobile-commerce-panel min-w-0 p-2 text-left"
              >
                <ProductVisual product={heroProduct} className="aspect-square rounded-xl" bottleClassName="left-4 top-4 h-14 w-7 rounded-[0.85rem]" label={false} priority sizes="126px" imageFit="cover" />
                <div className="mt-2">
                  <h2 className="truncate text-xs font-bold text-[#0b130c]">{heroProduct.name}</h2>
                  <p className="mt-0.5 truncate text-[10px] font-bold text-amber-700">{heroProduct.price}</p>
                </div>
              </button>
            ) : (
              <div className="mobile-commerce-panel overflow-hidden p-0">
                <img src={mobileHomeAssets.perfumerPipettes} alt="Dekito, Solivagant perfumer" className="h-full min-h-[156px] w-full object-cover object-[58%_34%]" loading="eager" decoding="async" width="232" height="312" onError={() => handleStaticImageError('home-perfumer-pipettes')} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-[#263d27]/10 p-3 pt-2">
            <div className="mobile-commerce-panel flex items-center justify-center gap-1.5 border-0 bg-white/78 px-2 py-2">
              <Sparkles className="h-3.5 w-3.5 text-[#263d27]" />
              <span className="text-[10px] font-bold uppercase leading-tight text-[#526351]">Ready</span>
            </div>
            <div className="mobile-commerce-panel flex items-center justify-center gap-1.5 border-0 bg-white/78 px-2 py-2">
              <WandSparkles className="h-3.5 w-3.5 text-[#263d27]" />
              <span className="text-[10px] font-bold uppercase leading-tight text-[#526351]">Custom</span>
            </div>
            <div className="mobile-commerce-panel flex items-center justify-center gap-1.5 border-0 bg-white/78 px-2 py-2">
              <ClipboardCheck className="h-3.5 w-3.5 text-[#263d27]" />
              <span className="text-[10px] font-bold uppercase leading-tight text-[#526351]">Order</span>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => navigate('/mobile/catalog')} className="mobile-commerce-choice flex min-h-[88px] flex-col justify-between">
            <Search className="h-4 w-4 text-[#263d27]" />
            <span className="text-left text-xs font-bold leading-tight text-[#0b130c]">Cari parfum</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700">Katalog <ArrowRight className="h-3 w-3" /></span>
          </button>
          <button type="button" onClick={() => navigate('/mobile/catalog?segment=limited')} className="mobile-commerce-choice flex min-h-[88px] flex-col justify-between">
            <Sparkles className="h-4 w-4 text-[#263d27]" />
            <span className="text-left text-xs font-bold leading-tight text-[#0b130c]">Drop terbatas</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700">Lihat <ArrowRight className="h-3 w-3" /></span>
          </button>
          <button type="button" onClick={() => navigate('/mobile/bespoke')} className="mobile-commerce-choice flex min-h-[88px] flex-col justify-between">
            <WandSparkles className="h-4 w-4 text-[#263d27]" />
            <span className="text-left text-xs font-bold leading-tight text-[#0b130c]">Custom aroma</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700">Brief <ArrowRight className="h-3 w-3" /></span>
          </button>
          <button type="button" onClick={() => navigate('/mobile/customer')} className="mobile-commerce-choice flex min-h-[88px] flex-col justify-between">
            <ClipboardCheck className="h-4 w-4 text-[#263d27]" />
            <span className="text-left text-xs font-bold leading-tight text-[#0b130c]">Cek order</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700">Lacak <ArrowRight className="h-3 w-3" /></span>
          </button>
        </section>

        <section className="mobile-card p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-[#eef2e8] text-[#263d27]">
              <BookOpenText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase text-amber-700">Artikel</p>
              <h2 className="mt-1 text-lg font-bold leading-tight text-[#0b130c]">Baca cerita aroma dan proses studio.</h2>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">Panduan singkat, catatan material, dan cerita di balik parfum Solivagant.</p>
            </div>
          </div>
          <Button variant="outline" className="mt-4 h-11 w-full rounded-2xl bg-white gap-2" onClick={() => navigate('/mobile/articles')}>
            Buka artikel
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        {!hasProducts ? (
          <section className="mobile-card overflow-hidden">
            <div className="bg-[linear-gradient(145deg,#050705,#111a11)] p-4 text-[#eef2e8]">
              <img src="/brand/solivagant-logo.png" alt="Solivagant" className="h-14 w-40 rounded-2xl object-contain" loading="lazy" decoding="async" width="160" height="56" onError={() => handleStaticImageError('solivagant-logo')} />
              <div className="mt-5 h-px w-20 bg-[#8d7a4f]" />
              <h2 className="mt-4 text-xl font-bold leading-tight">{productsLoading ? 'Memuat koleksi parfum.' : 'Atelier parfum sedang disiapkan.'}</h2>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#cbd6c5]">
                {productsLoading
                  ? 'Sebentar, kami sedang mengambil daftar parfum terbaru.'
                  : 'Produk akan tampil setelah ditambahkan dari Studio. Untuk sekarang, customer bisa mulai dari request bespoke.'}
              </p>
            </div>
            {!productsLoading ? (
            <div className="grid grid-cols-2 gap-2 p-3">
              <Button className="rounded-2xl gap-2" onClick={() => navigate('/mobile/bespoke')}>
                  Custom
                <WandSparkles className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => navigate('/mobile/login')}>
                Tambah produk
                <PackagePlus className="h-4 w-4" />
              </Button>
            </div>
            ) : null}
          </section>
        ) : null}

        {quickProducts.length ? (
        <section id="mobile-products" className="space-y-3 scroll-mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-amber-700">Belanja sekarang</p>
              <h2 className="text-base font-bold leading-tight">Produk pilihan</h2>
            </div>
            <Button variant="ghost" className="h-11 px-2 text-xs gap-1" onClick={() => navigate('/mobile/catalog')}>
              Lihat semua
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
          {quickProducts.map((product, index) => (
            <article key={product.id} className="mobile-card mobile-commerce-product-card min-w-0 overflow-hidden p-2">
              <button
                type="button"
                onPointerDown={captureOutgoingScrollTop}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') captureOutgoingScrollTop();
                }}
                onClick={() => navigate(`/mobile/products/${product.slug}`, { state: getMobileFromState(location, outgoingScrollTopRef.current) })}
                className="block w-full text-left"
              >
                <div className="relative">
                  <ProductVisual product={product} className="aspect-[4/5] rounded-2xl" bottleClassName="left-4 top-4 h-16 w-8 rounded-[1rem]" label={false} priority={index === 0} sizes="(max-width: 448px) 44vw, 198px" imageFit="cover" />
                  <div className="mobile-commerce-chip absolute left-2 top-2 max-w-[calc(100%-16px)] truncate bg-white/90 px-2 py-1 text-[9px] uppercase shadow-sm">
                    {getProductCategoryLabel(product)}
                  </div>
                  <div className="absolute bottom-2 left-2 max-w-[calc(100%-16px)] truncate rounded-full bg-[#263d27] px-2 py-1 text-[9px] font-bold uppercase text-white shadow-sm">
                    {product.featured ? 'Pilihan' : getProductPrimaryTag(product)}
                  </div>
                </div>
                <div className="mt-2 flex min-h-[148px] flex-col">
                  <div className="min-h-[54px] min-w-0">
                    <h3 className="mobile-line-clamp-2 min-h-[30px] text-[13px] font-bold leading-tight text-[#0b130c]">{product.name}</h3>
                    <p className="mobile-line-clamp-1 mt-1 min-h-[16px] text-[11px] font-semibold leading-snug text-[#6b7280]">{product.notes || product.mood || getProductCategoryLabel(product)}</p>
                  </div>
                  <div className="mt-2 grid min-h-8 grid-cols-[minmax(0,1fr)_58px] items-start gap-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-[#0b130c]">{product.price}</div>
                    </div>
                    <div className={`grid h-6 w-[58px] place-items-center rounded-full px-1.5 text-center text-[9px] font-bold leading-tight ${getProductLowStock(product) ? 'bg-rose-50 text-rose-700' : 'bg-[#f7f8f2] text-[#6b7280]'}`}>
                      {getProductStockLabel(product)}
                    </div>
                  </div>
                  <div className="mt-auto pt-2">
                    <div className="flex min-h-[24px] flex-wrap gap-1 overflow-hidden">
                      {getProductSizeLabels(product).map((size) => (
                        <span key={size} className="mobile-commerce-chip max-w-full truncate px-2 py-1 text-[9px]">{size}</span>
                      ))}
                    </div>
                    <div className="mt-1.5 flex min-h-[22px] flex-wrap gap-1 overflow-hidden">
                      <span className="mobile-commerce-muted-chip max-w-full truncate px-2 py-1 text-[9px] uppercase">
                        {getProductPrimaryTag(product)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </article>
          ))}
          </div>
        </section>
        ) : null}

        <section className="mobile-card overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-3 p-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase text-amber-700">Shortcut custom</p>
              <h2 className="mt-1 text-lg font-bold leading-tight text-[#0b130c]">Buat aroma dari cerita kamu.</h2>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">Isi brief singkat untuk mood, occasion, ukuran, dan budget.</p>
              <Button className="mt-3 h-11 rounded-2xl gap-2 px-3 text-xs" onClick={() => navigate('/mobile/bespoke')}>
                Mulai custom
                <WandSparkles className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative overflow-hidden rounded-[16px] bg-[#eef2e8]">
              <img src={mobileHomeAssets.perfumerPipettes} alt="Solivagant bespoke perfume consultation" className="absolute inset-0 h-full w-full object-cover object-[58%_34%]" loading="lazy" decoding="async" width="208" height="260" onError={() => handleStaticImageError('home-bespoke-shortcut')} />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(38,61,39,0.3))]" />
            </div>
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-[#eef2e8] text-[#263d27]">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase text-amber-700">Cek order</p>
              <h2 className="mt-1 text-lg font-bold leading-tight text-[#0b130c]">Pantau pembayaran dan pengiriman.</h2>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">Masukkan kode customer untuk melihat progress order dan invoice.</p>
            </div>
          </div>
          <Button variant="outline" className="mt-4 h-11 w-full rounded-2xl bg-white gap-2" onClick={() => navigate('/mobile/customer')}>
            Buka cek order
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        {categories.length ? (
        <section className="mobile-family-strip">
          <div className="mobile-segment-scroll flex gap-5 overflow-x-auto px-1 pb-2 pr-4">
            {categories.slice(0, 8).map((category) => (
              <div key={category.name} className="shrink-0">
                <button
                  type="button"
                  onClick={() => navigate(`/mobile/catalog?category=${encodeURIComponent(category.name)}`)}
                  className="mobile-family-link"
                >
                  {category.name}
                </button>
              </div>
            ))}
          </div>
        </section>
        ) : null}

        <section className="mobile-card p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-[#eef2e8] text-[#263d27]">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase text-amber-700">Perfumer</p>
              <h2 className="mt-1 text-lg font-bold leading-tight text-[#0b130c]">{perfumerProfile.name}</h2>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">{perfumerProfile.intro}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {mobileNotes.map((note) => {
              const Icon = note.icon;

              return (
                <div key={note.label} className="mobile-commerce-panel flex items-center justify-center gap-1.5 bg-[#f7f8f2] px-2 py-2">
                  <Icon className="h-3.5 w-3.5 text-[#263d27]" />
                  <span className="text-[10px] font-bold uppercase leading-tight text-[#526351]">{note.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mobile-card overflow-hidden bg-[#050705] text-[#eef2e8]">
          <div className="relative aspect-[16/9] min-h-[184px]">
            <img src={mobileHomeAssets.rawMaterialLibrary} alt="Solivagant raw material library" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" width="640" height="360" onError={() => handleStaticImageError('home-raw-material-library')} />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,5,0.08),rgba(5,7,5,0.82))]" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c6d5bf]">Di balik atelier</p>
              <h2 className="mt-2 text-lg font-bold leading-tight">Bahan asli, proses studio nyata.</h2>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

const MobileStorefrontPage = () => {
  return (
    <MobileCommerceLayout>
      <MobileStorefrontContent />
    </MobileCommerceLayout>
  );
};

export default MobileStorefrontPage;
