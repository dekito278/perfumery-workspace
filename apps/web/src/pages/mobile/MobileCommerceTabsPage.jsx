import React from 'react';
import { useLocation } from 'react-router-dom';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import { MobileArticlesContent } from '@/pages/mobile/MobileArticlesPage.jsx';
import { MobileCatalogContent } from '@/pages/mobile/MobileCatalogPage.jsx';
import { MobileStorefrontContent } from '@/pages/mobile/MobileStorefrontPage.jsx';

const MobileCommerceTabsPage = () => {
  const location = useLocation();
  const isArticlesActive = location.pathname === '/mobile/articles';
  const isCatalogActive = location.pathname === '/mobile/catalog';
  const isHomeActive = location.pathname === '/mobile/dashboard';

  return (
    <MobileCommerceLayout>
      <div className="mobile-keepalive-tabs">
        <div className={isHomeActive ? 'mobile-keepalive-tab is-active' : 'mobile-keepalive-tab is-inactive is-before'} aria-hidden={!isHomeActive}>
          <MobileStorefrontContent active={isHomeActive} />
        </div>
        <div className={isCatalogActive ? 'mobile-keepalive-tab is-active' : 'mobile-keepalive-tab is-inactive is-after'} aria-hidden={!isCatalogActive}>
          <MobileCatalogContent active={isCatalogActive} />
        </div>
        <div className={isArticlesActive ? 'mobile-keepalive-tab is-active' : 'mobile-keepalive-tab is-inactive is-after'} aria-hidden={!isArticlesActive}>
          <MobileArticlesContent active={isArticlesActive} />
        </div>
      </div>
    </MobileCommerceLayout>
  );
};

export default MobileCommerceTabsPage;
