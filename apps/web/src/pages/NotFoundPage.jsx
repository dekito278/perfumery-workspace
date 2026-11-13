import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate.js';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
const NotFoundPage = () => {
  const { t } = useTranslate();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  // A way forward from a wrong address: search the collection with the word the buyer had in mind (third
  // visitor audit, 13 Nov 2026 — the page offered only "home" and "collection").
  const search = (event) => {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog');
  };
  return (
  <>
    <Helmet>
      <title>{t("notfound.tab")}</title>
      <meta name="robots" content="noindex,follow" />
    </Helmet>

    <main className="solivagant-editorial-home">
      <PublicHeader />

      <section className="ng-section relative overflow-hidden !py-28 md:!py-40">
        <span className="ng-script-mark absolute -bottom-10 right-4 hidden text-[320px] md:block" aria-hidden="true">404</span>
        <div className="ng-container relative flex flex-col items-start gap-7">
          <p className="ng-eyebrow ng-mono m-0">404</p>
          <h1 className="ng-display ng-h1 max-w-[900px]">{t("notfound.title")}</h1>
          <p className="ng-lead">{t("notfound.body")}</p>
          <form onSubmit={search} role="search" className="flex w-full max-w-[520px] gap-2">
            <input type="search" className="ng-field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('notfound.searchPlaceholder')} aria-label={t('notfound.searchPlaceholder')} />
            <button type="submit" className="ng-btn shrink-0">{t('notfound.search')}</button>
          </form>
          <div className="flex flex-wrap gap-3.5">
            <Link to="/home" className="ng-btn ng-btn--ghost">{t("notfound.home")}</Link>
            <Link to="/catalog" className="ng-btn ng-btn--ghost">
              {t('home.seeCollection')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <StorefrontFooter />
    </main>
  </>
  );
};

export default NotFoundPage;
