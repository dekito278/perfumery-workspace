import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { BookOpenText } from 'lucide-react';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import { publicJournalArticles as articles } from '@/data/publicStorefront.js';

const PublicJournalPage = () => (
  <>
    <Helmet>
      <title>Journal - SOLIVAGANT</title>
      <meta name="description" content="Editorial notes from the SOLIVAGANT perfume atelier." />
    </Helmet>

    <main className="solivagant-editorial-home">
      <PublicHeader />

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
