import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const NotFoundPage = () => (
  <>
    <Helmet>
      <title>Page Not Found - SOLIVAGANT</title>
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
        <Link to="/cart" className="editorial-cart-button">Cart</Link>
      </header>

      <section className="editorial-not-found">
        <p className="editorial-eyebrow">SOLIVAGANT</p>
        <h1>Page not found.</h1>
        <p>The requested page is not part of the public atelier storefront.</p>
        <div className="editorial-actions">
          <Link to="/home" className="editorial-button editorial-button--primary">Back to Homepage</Link>
          <Link to="/catalog" className="editorial-button">Explore Collection <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </main>
  </>
);

export default NotFoundPage;
