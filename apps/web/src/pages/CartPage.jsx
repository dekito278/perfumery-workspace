import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { useCart } from '@/hooks/useCart.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const CartPage = () => {
  const { items, summary, updateQuantity, removeItem } = useCart();
  const previewItems = items.length ? items : [{
    slug: 'sample-cart-item',
    name: 'Santal Morn',
    notes: 'Sandalwood, bergamot, soft musk',
    size: '30 ml',
    price: 'Rp 289.000',
    priceNumber: 289000,
    quantity: 1,
  }];
  const subtotal = items.length ? summary.subtotal : 289000;

  return (
    <>
      <Helmet>
        <title>Cart - SOLIVAGANT</title>
      </Helmet>

      <main className="solivagant-editorial-home">
        <header className="editorial-header">
          <Link to="/home" className="editorial-wordmark">SOLIVAGANT</Link>
          <nav className="editorial-nav" aria-label="Storefront navigation">
            <Link to="/catalog">Collection</Link>
            <Link to="/bespoke">Bespoke</Link>
            <Link to="/materials">Materials</Link>
            <Link to="/journal">Journal</Link>
            <Link to="/track-order">Track Order</Link>
          </nav>
          <Link to="/cart" className="editorial-cart-button"><ShoppingBag className="h-4 w-4" />Cart</Link>
        </header>

        <section className="editorial-page-hero">
          <p className="editorial-eyebrow">CUSTOMER CART</p>
          <h1>Cart</h1>
          <p>A simple customer checkout preview for perfume objects, shipping information, and payment confirmation.</p>
        </section>

        <section className="editorial-section editorial-commerce editorial-section--compact">
          <div className="editorial-cart-preview">
            <p className="editorial-eyebrow">CART ITEMS</p>
            <h2>{items.length ? 'Your selected fragrances.' : 'Cart preview.'}</h2>
            {previewItems.map((item) => (
              <div key={item.slug} className="editorial-cart-line">
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.notes} / {item.size} / {item.price}</span>
                </div>
                <div className="editorial-qty">
                  <button type="button" onClick={() => items.length && updateQuantity(item.slug, Math.max(1, item.quantity - 1))} aria-label={`Decrease ${item.name}`}>
                    <Minus className="h-3 w-3" />
                  </button>
                  {item.quantity}
                  <button type="button" onClick={() => items.length && updateQuantity(item.slug, item.quantity + 1)} aria-label={`Increase ${item.name}`}>
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                {items.length ? <button type="button" className="editorial-text-button" onClick={() => removeItem(item.slug)}>Remove</button> : null}
              </div>
            ))}
          </div>
          <aside className="editorial-tracking-preview">
            <p className="editorial-eyebrow">CHECKOUT</p>
            <h2>Order summary.</h2>
            <div className="editorial-subtotal"><span>Subtotal</span><strong>{formatTotal(subtotal)}</strong></div>
            <div className="editorial-checkout-fields">
              <span>Shipping information placeholder</span>
              <span>Payment placeholder</span>
            </div>
            <button type="button" className="editorial-button editorial-button--primary">Proceed to Checkout</button>
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
