import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import { useCart } from '@/hooks/useCart.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const CartPage = () => {
  const { items, summary, updateQuantity, removeItem } = useCart();
  const subtotal = summary.subtotal;

  return (
    <>
      <Helmet>
        <title>Cart - SOLIVAGANT</title>
      </Helmet>

      <main className="solivagant-editorial-home">
        <PublicHeader />

        <section className="editorial-page-hero">
          <p className="editorial-eyebrow">CUSTOMER CART</p>
          <h1>Cart</h1>
          <p>Review fragrance pilihanmu sebelum memilih ongkir dan metode pembayaran di checkout.</p>
        </section>

        <section className="editorial-section editorial-commerce editorial-section--compact">
          <div className="editorial-cart-preview">
            <p className="editorial-eyebrow">CART ITEMS</p>
            <h2>{items.length ? 'Your selected fragrances.' : 'Keranjang masih kosong.'}</h2>
            {!items.length ? (
              <div className="editorial-empty-state editorial-empty-state--inline">
                <ShoppingBag className="h-8 w-8" />
                <p>Belum ada produk di cart. Pilih fragrance dari collection, lalu item akan muncul di sini secara langsung.</p>
                <Link to="/catalog" className="editorial-button editorial-button--primary">Explore Collection</Link>
              </div>
            ) : null}
            {items.map((item) => (
              <div key={item.slug} className="editorial-cart-line">
                <ProductVisual product={item} className="editorial-cart-line__image" imageFit="cover" />
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.notes} / {item.size} / {item.price}</span>
                </div>
                <div className="editorial-qty">
                  <button type="button" onClick={() => updateQuantity(item.slug, Math.max(1, item.quantity - 1))} aria-label={`Decrease ${item.name}`}>
                    <Minus className="h-3 w-3" />
                  </button>
                  {item.quantity}
                  <button type="button" onClick={() => updateQuantity(item.slug, item.quantity + 1)} aria-label={`Increase ${item.name}`}>
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button type="button" className="editorial-text-button" onClick={() => removeItem(item.slug)}>Remove</button>
              </div>
            ))}
          </div>
          <aside className="editorial-tracking-preview">
            <p className="editorial-eyebrow">CHECKOUT</p>
            <h2>Order summary.</h2>
            <div className="editorial-subtotal"><span>Subtotal</span><strong>{formatTotal(subtotal)}</strong></div>
            <div className="editorial-checkout-fields">
              <span>Shipping dihitung di checkout</span>
              <span>Payment tersedia di langkah berikutnya</span>
            </div>
            {items.length ? (
              <Link to="/checkout" className="editorial-button editorial-button--primary">Proceed to Checkout</Link>
            ) : (
              <Link to="/catalog" className="editorial-button editorial-button--primary">Add Product First</Link>
            )}
            <Link to="/catalog" className="editorial-button">Continue Shopping</Link>
          </aside>
        </section>

        <footer className="editorial-footer">
          <span>SOLIVAGANT by Dekito</span>
          <Link to="/track-order">Track Order</Link>
        </footer>
      </main>
    </>
  );
};

export default CartPage;
