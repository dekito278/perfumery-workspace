import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate.js';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
const NotFoundPage = () => {
  const { t } = useTranslate();
  return (
  <>
    <Helmet>
      <title>{t("notfound.tab")}</title>
      <meta name="robots" content="noindex,follow" />
    </Helmet>

    <main className="solivagant-editorial-home">
      <PublicHeader />

      <section className="notfound-content">
        <p className="editorial-eyebrow">404</p>
        <h1>{t("notfound.title")}</h1>
        <p>{t("notfound.body")}</p>
        <div className="notfound-actions">
          <Link to="/home" className="cart-empty__cta">{t("notfound.home")}</Link>
          <Link to="/catalog" className="notfound-secondary">
            {t('home.seeCollection')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <StorefrontFooter />
    </main>
  </>
  );
};

export default NotFoundPage;
