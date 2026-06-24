import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';

const NotFoundPage = () => (
  <>
    <Helmet>
      <title>Halaman Tidak Ditemukan - SOLIVAGANT</title>
    </Helmet>

    <main className="solivagant-editorial-home">
      <PublicHeader />

      <section className="notfound-content">
        <p className="editorial-eyebrow">404</p>
        <h1>Halaman tidak ditemukan</h1>
        <p>Halaman yang kamu cari tidak tersedia atau sudah dipindahkan.</p>
        <div className="notfound-actions">
          <Link to="/home" className="cart-empty__cta">Kembali ke Beranda</Link>
          <Link to="/catalog" className="notfound-secondary">
            Explore Collection <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <StorefrontFooter />
    </main>
  </>
);

export default NotFoundPage;
