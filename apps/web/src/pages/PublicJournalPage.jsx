import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { BookOpenText, ShoppingBag } from 'lucide-react';
import { publicJournalArticles as articles } from '@/data/publicStorefront.js';

const PublicJournalPage = () => (
  <>
    <Helmet>
      <title>Journal - SOLIVAGANT</title>
      <meta name="description" content="Editorial notes from the SOLIVAGANT perfume atelier." />
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
        <p className="editorial-eyebrow">JOURNAL / EDITORIAL</p>
        <h1>Journal</h1>
        <p>Field notes on scent memory, raw materials, atelier process, and the stories behind SOLIVAGANT perfume objects.</p>
      </section>

      <section className="editorial-section editorial-journal editorial-section--compact">
        <div className="editorial-journal-grid editorial-journal-grid--wide">
          {articles.map((article) => (
            <article key={article.title}>
              <span>{article.category}</span>
              <h3>{article.title}</h3>
              <p>{article.date}</p>
              <p>{article.text}</p>
              <Link to="/journal" className="editorial-journal-link">
                Read More <BookOpenText className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <footer className="editorial-footer">
        <span>SOLIVAGANT by Dekito</span>
        <Link to="/materials">Explore Materials</Link>
      </footer>
    </main>
  </>
);

export default PublicJournalPage;
