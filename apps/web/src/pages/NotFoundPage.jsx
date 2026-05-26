import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';

const NotFoundPage = () => (
  <>
    <Helmet>
      <title>Page Not Found - SOLIVAGANT</title>
    </Helmet>

    <main className="solivagant-editorial-home">
      <PublicHeader />

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
