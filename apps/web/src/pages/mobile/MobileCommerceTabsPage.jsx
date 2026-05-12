import React from 'react';
import { useLocation } from 'react-router-dom';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import { MobileCatalogContent } from '@/pages/mobile/MobileCatalogPage.jsx';
import { MobileStorefrontContent } from '@/pages/mobile/MobileStorefrontPage.jsx';

const MobileCommerceTabsPage = () => {
  const location = useLocation();
  const isCatalogActive = location.pathname === '/mobile/catalog';
  const isHomeActive = location.pathname === '/mobile/dashboard';

  return (
    <MobileCommerceLayout>
      <div className="mobile-keepalive-tabs">
        <div className={isHomeActive ? 'block' : 'hidden'} aria-hidden={!isHomeActive}>
          <MobileStorefrontContent active={isHomeActive} />
        </div>
        <div className={isCatalogActive ? 'block' : 'hidden'} aria-hidden={!isCatalogActive}>
          <MobileCatalogContent active={isCatalogActive} />
        </div>
      </div>
    </MobileCommerceLayout>
  );
};

export default MobileCommerceTabsPage;
