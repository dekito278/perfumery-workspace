import React, { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import { MobileCatalogContent } from '@/pages/mobile/MobileCatalogPage.jsx';
import { MobileStorefrontContent } from '@/pages/mobile/MobileStorefrontPage.jsx';
import { scheduleMobileCommerceScrollReset } from '@/utils/mobileCommerceScroll.js';

const MobileCommerceTabsPage = () => {
  const location = useLocation();
  const isCatalogActive = location.pathname === '/mobile/catalog';
  const isHomeActive = location.pathname === '/mobile/dashboard';

  useLayoutEffect(() => {
    return scheduleMobileCommerceScrollReset();
  }, [location.pathname]);

  return (
    <MobileCommerceLayout>
      <div className="mobile-keepalive-tabs">
        <div className={isHomeActive ? 'mobile-keepalive-tab is-active' : 'mobile-keepalive-tab is-inactive is-before'} aria-hidden={!isHomeActive}>
          <MobileStorefrontContent active={isHomeActive} />
        </div>
        <div className={isCatalogActive ? 'mobile-keepalive-tab is-active' : 'mobile-keepalive-tab is-inactive is-after'} aria-hidden={!isCatalogActive}>
          <MobileCatalogContent active={isCatalogActive} />
        </div>
      </div>
    </MobileCommerceLayout>
  );
};

export default MobileCommerceTabsPage;
