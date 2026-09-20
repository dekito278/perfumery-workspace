import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, Ticket, UserRound } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import WhyBuyDirect from '@/components/storefront/WhyBuyDirect.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { useStorefrontRegion } from '@/hooks/useStorefrontRegion.js';

// Where the greeting card in every parcel points. One URL for every buyer who came from a marketplace,
// so it is noindex — it is a door, not a page to be found.
//
// Two price claims, both true: the shop's own prices sit below the marketplace (Dekito, 2026-09-15 — his
// marketplace listings are priced higher), and signing in lowers them again to the member price. Stated as
// policy, never as a number or against a named marketplace: a figure goes stale and a name is a legal
// risk, and a landing page that lies once is not believed twice.
const WelcomeContent = ({ mobile, currentUser, signIn }) => {
  const prefix = mobile ? '/mobile' : '';
  const { t } = useTranslate();
  // The card's code is a CART thing, and the English shop has no cart. Telling an international reader to
  // type it at checkout would be an instruction with nowhere to follow it — so the note is not shown
  // there at all, and its English words say what IS true instead, for the day this gate is edited.
  const { isInternational } = useStorefrontRegion();
  return (
    <>
      <p className={mobile ? 'm-editorial-eyebrow' : 'editorial-eyebrow'}>{t('welcome.eyebrow')}</p>
      <h1 className={mobile ? 'mt-2 text-2xl font-bold text-editorial-charcoal' : 'storefront-display-heading mt-3 text-4xl font-bold sm:text-5xl'}>
        {t('welcome.heading')}
      </h1>
      <p className={mobile ? 'mt-3 text-sm font-medium leading-relaxed text-[#6b7280]' : 'mt-4 max-w-xl text-base font-medium leading-relaxed text-muted-foreground'}>
        {t('welcome.lead')}
      </p>
      <div className={`mt-6 flex flex-wrap gap-3${mobile ? ' flex-col' : ''}`}>
        {currentUser ? (
          <Link to={`${prefix}/catalog`} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-editorial-charcoal px-5 text-sm font-bold text-editorial-ivory">
            {t('welcome.alreadyMember')} <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Button type="button" onClick={signIn} className="h-12 rounded-2xl gap-2 px-5 text-sm font-bold">
            <UserRound className="h-4 w-4" /> {t('welcome.signIn')}
          </Button>
        )}
        <Link to={`${prefix}/catalog`} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-editorial-charcoal/20 bg-white px-5 text-sm font-bold text-editorial-charcoal">
          {t('welcome.browse')} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {isInternational ? null : (
        <div className="mt-8 rounded-2xl border border-editorial-charcoal/15 bg-[#fbfaf7] p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-editorial-charcoal">
            <Ticket className="h-3.5 w-3.5" /> {t('welcome.voucherEyebrow')}
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
            {t('welcome.voucherBody')}
          </p>
        </div>
      )}
    </>
  );
};

const WelcomePage = ({ mobile = false }) => {
  const { currentUser, loginWithGoogle } = useAuth();
  const { t } = useTranslate();
  const revealRef = useScrollReveal();
  const signIn = () => loginWithGoogle(`${window.location.origin}${mobile ? '/mobile/customer' : '/customer'}`).catch(() => {});

  const head = (
    <Helmet>
      <title>{t('welcome.title')}</title>
      <meta name="description" content={t('welcome.meta')} />
      <meta name="robots" content="noindex,follow" />
    </Helmet>
  );

  if (mobile) {
    return (
      <MobileCommerceLayout>
        {head}
        <main className="mobile-page m-editorial-page">
          <section className="mobile-card m-editorial-section p-5">
            <WelcomeContent mobile currentUser={currentUser} signIn={signIn} />
          </section>
          <WhyBuyDirect mobile />
        </main>
      </MobileCommerceLayout>
    );
  }

  return (
    <>
      {head}
      <main className="solivagant-editorial-home" ref={revealRef}>
        <PublicHeader />
        <section className="tracking-content">
          <div className="tracking-card">
            <WelcomeContent mobile={false} currentUser={currentUser} signIn={signIn} />
          </div>
        </section>
        <WhyBuyDirect />
        <StorefrontFooter />
      </main>
    </>
  );
};

export default WelcomePage;
