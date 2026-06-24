import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgePercent, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCart } from '@/hooks/useCart.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const CartPage = () => {
  const { items, summary, updateQuantity, removeItem } = useCart();
  const voucher = useAppliedVoucher(summary.subtotal, items);
  const subtotal = summary.subtotal;
  const totalAfterVoucher = Math.max(subtotal - voucher.discountAmount, 0);

  return (
    <>
      <Helmet>
        <title>Cart - SOLIVAGANT</title>
      </Helmet>

      <main className="solivagant-editorial-home">
        <PublicHeader />

        <section className="cart-hero">
          <p className="editorial-eyebrow">KERANJANG</p>
          <h1>Cart</h1>
          <p>Review fragrance pilihanmu sebelum checkout.</p>
        </section>

        <section className="cart-layout">
          {/* Cart items */}
          <div className="cart-items">
            {!items.length ? (
              <div className="cart-empty">
                <ShoppingBag className="h-10 w-10" />
                <h2>Keranjang masih kosong</h2>
                <p>Pilih fragrance dari collection, lalu item akan muncul di sini.</p>
                <Link to="/catalog" className="cart-empty__cta">
                  Explore Collection <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.slug} className="cart-line">
                  <Link to={`/catalog/${item.slug}`} className="cart-line__image">
                    <ProductVisual product={item} imageFit="cover" />
                  </Link>
                  <div className="cart-line__info">
                    <Link to={`/catalog/${item.slug}`} className="cart-line__name">{item.name}</Link>
                    <span className="cart-line__meta">{item.notes} · {item.size}</span>
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
                <Link to="/checkout" className="cart-actions__primary">Lanjut ke Checkout</Link>
              ) : (
                <Link to="/catalog" className="cart-actions__primary">Tambah Produk Dulu</Link>
              )}
              <Link to="/catalog" className="cart-actions__secondary">Lanjut Belanja</Link>
            </div>
          </aside>
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default CartPage;
