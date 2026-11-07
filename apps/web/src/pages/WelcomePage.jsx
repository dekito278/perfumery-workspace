import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, Ticket, UserRound } from 'lucide-react';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import WhyBuyDirect from '@/components/storefront/WhyBuyDirect.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { shopPrefixForRegion } from '@/utils/storefrontRegion.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { useStorefrontRegion } from '@/hooks/useStorefrontRegion.js';

// Where the greeting card in every parcel points. One URL for every buyer who came from a marketplace,
// so it is noindex — it is a door, not a page to be found.
//
// Two price claims, both true: the shop's own prices sit below the marketplace (Dekito, 2026-09-15 — its
// marketplace listings are priced higher), and signing in lowers them again to the member price. Stated as
// policy, never as a number or against a named marketplace: a figure goes stale and a name is a legal
// risk, and a landing page that lies once is not believed twice.
const WelcomeContent = ({ currentUser, signIn }) => {
  const prefix = '';
  const { t } = useTranslate();
  // The card's code is a VOUCHER thing, and the English cart has no voucher box: an international order
  // is confirmed on WhatsApp, where a domestic discount code has nothing to apply to. Telling that reader
  // to type it at checkout would be an instruction with nowhere to follow it — so the note is not shown
  // there, and its English words say what IS true instead, for the day this gate is edited.
  // (It read "the English shop has no cart" until 2026-10-06, when that shop got one.)
  const { isInternational } = useStorefrontRegion();
  return (
    <>
      <p className="ng-eyebrow ng-mono m-0">{t('welcome.eyebrow')}</p>
      <h1 className="ng-display mt-5 text-5xl sm:text-6xl">
        {t('welcome.heading')}
      </h1>
      <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-ng-dust">
        {t('welcome.lead')}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {currentUser ? (
          <Link to={`${prefix}/catalog`} className="ng-btn">
            {t('welcome.alreadyMember')} <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button type="button" onClick={signIn} className="ng-btn max-w-full py-3">
            <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" /> {t('welcome.signIn')}
          </button>
        )}
        <Link to={`${prefix}/catalog`} className="ng-btn ng-btn--ghost">
          {t('welcome.browse')} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {isInternational ? null : (
        <div className="mt-8 rounded-none border border-ng-bone/15 bg-ng-deep p-4">
          <p className="ng-mono m-0 flex items-center gap-2 text-ng-bone">
            <Ticket className="h-3.5 w-3.5" /> {t('welcome.voucherEyebrow')}
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-ng-dust">
            {t('welcome.voucherBody')}
          </p>
        </div>
      )}
    </>
  );
};

const WelcomePage = () => {
  const { currentUser, loginWithGoogle } = useAuth();
  const { t, region } = useTranslate();
  const revealRef = useScrollReveal();
  // The shop prefix has to survive the round trip. Built from the origin alone, an English visitor
  // who signed in from /en/welcome came back to the INDONESIAN /customer — the language follows the
  // stored region so the page still read English, but the /en address, its canonical and its
  // hreflang twin were all left behind.
  const signIn = () => loginWithGoogle(
    `${window.location.origin}${shopPrefixForRegion(region)}/customer`,
  ).catch(() => {});

  const head = (
    <Helmet>
      <title>{t('welcome.title')}</title>
      <meta name="description" content={t('welcome.meta')} />
      <meta name="robots" content="noindex,follow" />
    </Helmet>
  );

  return (
    <>
      {head}
      <main className="solivagant-editorial-home" ref={revealRef}>
        <PublicHeader />
        <section className="tracking-content !pt-16">
          <div className="tracking-card">
            <WelcomeContent currentUser={currentUser} signIn={signIn} />
          </div>
        </section>
        <WhyBuyDirect />
        <StorefrontFooter />
      </main>
    </>
  );
};

export default WelcomePage;
