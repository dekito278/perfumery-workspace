import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Search, ShoppingBag } from 'lucide-react';

const timeline = ['Order received', 'Payment confirmed', 'Atelier preparation', 'Packed for delivery', 'Estimated delivery'];

const PublicTrackingPage = () => (
  <>
    <Helmet>
      <title>Track Order - SOLIVAGANT</title>
      <meta name="description" content="Customer-facing SOLIVAGANT order tracking." />
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

      <section className="editorial-page-hero editorial-page-hero--split">
        <div>
          <p className="editorial-eyebrow">CUSTOMER ORDER TRACKING</p>
          <h1>Track Order</h1>
          <p>Check public order progress with your order number and customer contact. Internal production management stays inside the studio.</p>
        </div>
        <form className="editorial-form editorial-form--compact">
          <label>Order number<input type="text" placeholder="SOL-2026-001" /></label>
          <label>Email / phone<input type="text" placeholder="Customer email or WhatsApp" /></label>
          <button type="button" className="editorial-button editorial-button--primary"><Search className="h-4 w-4" />Check Status</button>
        </form>
      </section>

      <section className="editorial-section editorial-section--compact">
        <div className="editorial-tracking-preview editorial-tracking-preview--wide">
          <p className="editorial-eyebrow">PUBLIC STATUS PLACEHOLDER</p>
          <h2>Estimated delivery appears here after lookup.</h2>
          <div className="editorial-timeline">
            {timeline.map((item, index) => (
              <span key={item} className={index < 2 ? 'is-complete' : ''}>{item}</span>
            ))}
          </div>
          <div className="editorial-checkout-fields">
            <span>Estimated delivery: 3-5 business days after dispatch</span>
            <span>Courier tracking: added when shipment is ready</span>
          </div>
        </div>
      </section>

      <footer className="editorial-footer">
        <span>SOLIVAGANT by Dekito</span>
        <Link to="/cart">View Cart</Link>
      </footer>
    </main>
  </>
);

export default PublicTrackingPage;
