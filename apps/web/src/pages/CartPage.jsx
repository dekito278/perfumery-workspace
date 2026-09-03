import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgePercent, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import TextReveal from '@/components/storefront/TextReveal.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCart } from '@/hooks/useCart.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useMicroInteractions } from '@/hooks/useParallax.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';


const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const CartPage = () => {
  const { items, summary, updateQuantity, removeItem } = useCart();
  const voucher = useAppliedVoucher(summary.subtotal, items);
  const subtotal = summary.subtotal;
  const totalAfterVoucher = Math.max(subtotal - voucher.discountAmount, 0);
  const revealRef = useScrollReveal();
  const { magnetic, tilt, resetTilt } = useMicroInteractions();
  const catalogProducts = useCatalogProducts();
  // Lines whose product left the catalog or ran out of stock — checkout refuses them, so say so here
  // rather than at the end of the form (audit round 9).
  const unavailableItems = items.filter((item) => item.unavailable || item.outOfStock);

  const recommendations = useMemo(() => {
    const inCart = new Set(items.map((item) => item.productSlug || item.slug));
    const visible = catalogProducts.filter(isProductVisibleInStorefront);
    return getPublicFragranceCatalog(visible)
      .filter((product) => !inCart.has(product.slug))
      .slice(0, 4);
  }, [catalogProducts, items]);

  return (
    <>
      <Helmet>
        <title>Cart - SOLIVAGANT</title>
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <ScrollProgress />
        <PublicHeader />

        <section className="cart-hero">
          <p className="editorial-eyebrow hero-animate-text hero-animate-text--d1">KERANJANG</p>
          <TextReveal as="h1" text="Keranjang" />
          <p className="hero-animate-text hero-animate-text--d3">Tinjau fragrance pilihanmu sebelum checkout.</p>
        </section>

        <section className="cart-layout" data-reveal>
          {/* Cart items */}
          <div className="cart-items">
            {items.some((item) => item.priceChanged) ? (
              <p className="cart-line__meta" role="status">
                Harga beberapa item sudah diperbarui mengikuti katalog terbaru.
              </p>
            ) : null}
            {unavailableItems.length ? (
              <p className="checkout-notice is-error" role="alert">
                {unavailableItems.map((item) => item.name).join(', ')} sudah tidak tersedia. Hapus dari keranjang untuk lanjut checkout.
              </p>
            ) : null}
            {!items.length ? (
              <div className="cart-empty">
                <ShoppingBag className="h-10 w-10" />
                <h2>Keranjang masih kosong</h2>
                <p>Pilih fragrance dari koleksi, lalu item akan muncul di sini.</p>
                <Link to="/catalog" className="cart-empty__cta">
                  Lihat Koleksi <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.slug} className="cart-line">
                  <Link to={`/catalog/${item.productSlug || item.slug}`} className="cart-line__image">
                    <ProductVisual product={item} imageFit="cover" />
                  </Link>
                  <div className="cart-line__info">
                    <Link to={`/catalog/${item.productSlug || item.slug}`} className="cart-line__name">{item.name}</Link>
                    <span className="cart-line__meta">{[item.notes, item.size].filter(Boolean).join(' · ')}</span>
                    <span className="cart-line__price">{item.price}</span>
                  </div>
                  <div className="cart-line__qty">
                    <button type="button" onClick={() => updateQuantity(item.slug, Math.max(1, item.quantity - 1))} aria-label={`Kurangi ${item.name}`}>
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.slug, item.quantity + 1)} aria-label={`Tambah ${item.name}`}>
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button type="button" className="cart-line__remove" onClick={() => removeItem(item.slug)} aria-label={`Hapus ${item.name}`}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Order summary sidebar */}
          <aside className="cart-summary">
            <p className="editorial-eyebrow">RINGKASAN</p>
            <h2>Ringkasan pesanan</h2>

            {/* Voucher */}
            <div className="cart-voucher">
              <label className="cart-voucher__label">
                {voucher.appliedVoucher ? `${voucher.appliedVoucher.code} diterapkan` : 'Punya kode voucher?'}
              </label>
              <div className="cart-voucher__input">
                <input
                  type="text"
                  value={voucher.inputCode}
                  onChange={(event) => voucher.setInputCode(event.target.value)}
                  placeholder="Masukkan kode"
                  disabled={!items.length || voucher.loading}
                />
                <button type="button" onClick={voucher.applyVoucher} disabled={!items.length || voucher.loading}>
                  <BadgePercent className="h-4 w-4" />
                  {voucher.loading ? 'Cek...' : 'Pakai'}
                </button>
              </div>
              {voucher.message ? <p className={`cart-voucher__msg${voucher.appliedVoucher ? ' is-success' : ''}`}>{voucher.message}</p> : null}
              {voucher.appliedVoucher ? (
                <button type="button" className="cart-voucher__remove" onClick={voucher.removeVoucher}>
                  <X className="h-3.5 w-3.5" /> Hapus voucher
                </button>
              ) : null}
            </div>

            {/* Totals */}
            <div className="cart-totals">
              <div className="cart-totals__row">
                <span>Subtotal</span>
                <strong>{formatTotal(subtotal)}</strong>
              </div>
              {voucher.discountAmount ? (
                <>
                  <div className="cart-totals__row cart-totals__row--discount">
                    <span>Voucher {voucher.appliedVoucher?.code}</span>
                    <strong>-{formatTotal(voucher.discountAmount)}</strong>
                  </div>
                  <div className="cart-totals__row">
                    <span>Setelah voucher</span>
                    <strong>{formatTotal(totalAfterVoucher)}</strong>
                  </div>
                </>
              ) : null}
              <div className="cart-totals__note">
                <span>Ongkir dihitung di checkout</span>
              </div>
            </div>

            {/* Actions */}
            <div className="cart-actions">
              {items.length ? (
                <Link to="/checkout" className="cart-actions__primary magnetic-hover" onMouseMove={magnetic}>Lanjut ke Checkout</Link>
              ) : (
                <Link to="/catalog" className="cart-actions__primary magnetic-hover" onMouseMove={magnetic}>Tambah Produk Dulu</Link>
              )}
              <Link to="/catalog" className="cart-actions__secondary">Lanjut Belanja</Link>
            </div>
          </aside>
        </section>

        {/* Cross-sell — complete the ritual */}
        {items.length && recommendations.length ? (
          <section className="cart-recommend" data-reveal>
            <div className="home-section__head">
              <p className="editorial-eyebrow">LENGKAPI RITUALMU</p>
              <h2>Mungkin kamu suka</h2>
            </div>
            <div className="catalog-grid catalog-grid--four" data-reveal data-stagger-children>
              {recommendations.map((item) => (
                <Link
                  key={item.slug}
                  to={`/catalog/${item.slug}`}
                  className="catalog-card card-lift card-tilt img-hover-zoom"
                  onMouseMove={tilt}
                  onMouseLeave={resetTilt}
                >
                  <div className="catalog-card__media">
                    <ProductVisual product={item} className="catalog-card__visual" imageFit="cover" label={false} />
                  </div>
                  <div className="catalog-card__info">
                    <span className="catalog-card__category">{item.category}</span>
                    <h3>{item.name}</h3>
                    <span className="catalog-card__price">{item.price}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <StorefrontFooter />
      </main>
    </>
  );
};

export default CartPage;
