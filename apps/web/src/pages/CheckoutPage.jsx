import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/hooks/useCart.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const CheckoutPage = () => {
  const { items, summary } = useCart();
  const previewItems = items.length ? items : [{
    slug: 'sample-cart-item',
    name: 'Santal Morn',
    size: '30 ml',
    price: 'Rp 289.000',
    priceNumber: 289000,
    quantity: 1,
  }];
  const subtotal = items.length ? summary.subtotal : 289000;

  return (
    <>
      <Helmet>
        <title>Checkout - SOLIVAGANT</title>
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
          <p className="editorial-eyebrow">SECURE CHECKOUT</p>
          <h1>Checkout</h1>
          <p>Customer information, shipping details, and payment confirmation placeholder for SOLIVAGANT orders.</p>
        </section>

        <section className="editorial-section editorial-checkout-page editorial-section--compact">
          <form className="editorial-form" onSubmit={(event) => event.preventDefault()}>
            <p className="editorial-eyebrow">CUSTOMER INFORMATION</p>
            <label>
              Full name
              <input type="text" name="name" placeholder="Your name" autoComplete="name" />
            </label>
            <label>
              Email / WhatsApp
              <input type="text" name="contact" placeholder="email@example.com / +62..." autoComplete="email" />
            </label>
            <label>
              Shipping address
              <textarea name="address" rows="4" placeholder="Street, city, province, postal code" />
            </label>
            <label>
              Delivery notes
              <textarea name="notes" rows="3" placeholder="Gift note, preferred delivery time, or scent request" />
            </label>
            <div className="editorial-checkout-fields">
              <span>Shipping information placeholder</span>
              <span>Payment confirmation placeholder</span>
            </div>
            <button type="submit" className="editorial-button editorial-button--primary">Place Order Request</button>
          </form>

          <aside className="editorial-cart-preview">
            <p className="editorial-eyebrow">ORDER SUMMARY</p>
            <h2>Selected works.</h2>
            {previewItems.map((item) => (
              <div key={item.slug} className="editorial-cart-line">
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.size} / Qty {item.quantity}</span>
                </div>
                <strong>{item.price}</strong>
              </div>
            ))}
            <div className="editorial-subtotal"><span>Subtotal</span><strong>{formatTotal(subtotal)}</strong></div>
            <Link to="/cart" className="editorial-button">Return to Cart</Link>
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

export default CheckoutPage;
