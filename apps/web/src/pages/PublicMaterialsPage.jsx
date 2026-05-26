import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { publicMaterials as materials } from '@/data/publicStorefront.js';

const PublicMaterialsPage = () => (
  <>
    <Helmet>
      <title>Raw Material Archive - SOLIVAGANT</title>
      <meta name="description" content="A public raw material storytelling archive from SOLIVAGANT." />
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
        <p className="editorial-eyebrow">PUBLIC RAW MATERIAL ARCHIVE</p>
        <h1>Raw Material Archive</h1>
        <p>Raw materials presented as sensory stories: origin, olfactive family, texture, and mood. This is a public archive, not an internal inventory.</p>
      </section>

      <section className="editorial-section editorial-section--compact">
        <div className="editorial-material-grid">
          {materials.map((material) => (
            <article key={material.name} className="editorial-material-card">
              <span>{material.family}</span>
              <h3>{material.name}</h3>
              <p className="editorial-material-card__origin">{material.origin}</p>
              <p>{material.description}</p>
              <strong>{material.mood}</strong>
              <p>{material.usageStory}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="editorial-footer">
        <span>SOLIVAGANT by Dekito</span>
        <Link to="/journal">Read Journal</Link>
      </footer>
    </main>
  </>
);

export default PublicMaterialsPage;
