import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import AskAtelierButton from '@/components/storefront/AskAtelierButton.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';

// /pay/<token> — RETIRED, 15 Nov 2026 (Dekito: the payment-link page is no longer used).
//
// From 10 to 14 Nov an order from abroad could be paid here: bank details, Wise/Remitly/Western Union steps
// and a receipt upload, opened by a secret link Studio handed out. Since 14 Nov buyers abroad order AND pay
// on WhatsApp, so the page is a short notice now: it looks nothing up, prints no account and accepts no
// file. The route stays so a link already sent in a chat lands on a sentence and a way to reach us, not on
// a 404. Still noindex (robots.txt keeps /pay/ closed as well).
const PaymentInstructionsPage = () => {
  const { t } = useTranslate();

  return (
    <>
      <Helmet>
        <title>{t('pay.link.retiredTab')}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="solivagant-editorial-home">
        <PublicHeader />
        <main>
          <section className="ng-section">
            <div className="ng-container flex max-w-[760px] flex-col gap-6">
              <p className="ng-eyebrow ng-mono m-0">{t('pay.link.eyebrow')}</p>
              <h1 className="ng-display m-0 text-[clamp(36px,9vw,64px)] font-normal">{t('pay.link.retiredTitle')}</h1>
              <p className="ng-lead m-0">{t('pay.link.retiredBody')}</p>
              <div className="flex flex-wrap gap-3">
                <AskAtelierButton labelKey="help.contactCta" />
                <Link to="/catalog" className="ng-btn ng-btn--ghost">{t('mcheckout.openCatalog')}</Link>
              </div>
            </div>
          </section>
        </main>
        <StorefrontFooter />
      </div>
    </>
  );
};

export default PaymentInstructionsPage;
