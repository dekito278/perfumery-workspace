import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import AskAtelierButton from '@/components/storefront/AskAtelierButton.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import { useSiteFacts } from '@/hooks/useSiteFacts.js';
import { checkoutCourierOptions } from '@/hooks/useCheckoutFlow.js';
import { checkoutPaymentMethods } from '@/services/cartService.js';
import { PAYMENT_RESERVATION_TTL_HOURS } from '@/services/orderService.js';
import { shopCanonicalUrl } from '@/utils/seo.js';

// The page a buyer reads before paying a stranger: how to order and pay, when it ships, how to follow it,
// what happens if something is wrong, what is kept about them, and how to reach a person.
//
// Visitor audit, 13 Nov 2026: neither shop had one — no shipping lead time, no word on a broken parcel, no
// privacy line, no email, and for a buyer abroad paying by Western Union that is the reason to hesitate.
//
// TWO KINDS OF SENTENCE. What the code already knows is said outright: the payment methods, the 24-hour
// hold, the couriers, the free vial, the bespoke days. What would be a PROMISE — days to dispatch, a
// window to report a broken parcel, an email address — is a shop fact Dekito sets in Studio, and each such
// sentence is shown only once it is set (src/data/siteFacts.js). The page never promises on his behalf.
const Section = ({ id, title, children }) => (
  <section aria-labelledby={id} className="border-t border-ng-bone/12 pt-6">
    <h2 id={id} className="ng-display m-0 text-2xl text-ng-bone sm:text-3xl">{title}</h2>
    <div className="mt-3 grid gap-3 text-base leading-7 text-ng-dust">{children}</div>
  </section>
);

const HelpContent = () => {
  const { t, isInternational } = useTranslate();
  const facts = useSiteFacts();
  const hasDoku = checkoutPaymentMethods.some((method) => method.provider === 'doku');
  const couriers = checkoutCourierOptions.map((courier) => courier.label).join(', ');

  return (
    <>
      <p className="ng-eyebrow ng-mono m-0">{t('help.eyebrow')}</p>
      <h1 className="ng-display mt-5 text-4xl text-ng-bone sm:text-6xl">{t('help.title')}</h1>
      <p className="mt-5 text-base leading-7 text-ng-dust sm:text-lg">{t('help.lead')}</p>

      <div className="mt-8 grid gap-8">
        <Section id="help-order" title={t('help.orderTitle')}>
          {isInternational ? (
            <p className="m-0">{t('help.orderEn', { hours: PAYMENT_RESERVATION_TTL_HOURS })}</p>
          ) : (
            <p className="m-0">{t(hasDoku ? 'help.orderIdDoku' : 'help.orderIdTransfer', { hours: PAYMENT_RESERVATION_TTL_HOURS })}</p>
          )}
          {!isInternational ? (
            <p className="m-0">
              {t('help.member')}{' '}
              <Link to="/customer" className="underline underline-offset-4">{t('price.howToMember')}</Link>
            </p>
          ) : null}
        </Section>

        <Section id="help-shipping" title={t('help.shipTitle')}>
          <p className="m-0">{isInternational ? t('help.shipEn') : t('help.shipId', { couriers })}</p>
          {/* What a buyer abroad worries about before paying a stranger (second audit, 13 Nov 2026): duties —
              the cart's own sentence, word for word — and why a second bottle can ship for less. */}
          {isInternational ? <p className="m-0">{t('intlQuote.duties')}</p> : null}
          {isInternational ? <p className="m-0">{t('help.shipEnShare')}</p> : null}
          {facts.dispatchDays ? <p className="m-0">{t('help.dispatch', { days: facts.dispatchDays })}</p> : null}
          <p className="m-0">{t('help.vial')}</p>
        </Section>

        <Section id="help-tracking" title={t('help.trackTitle')}>
          <p className="m-0">
            {t('help.track')}{' '}
            <Link to="/track-order" className="underline underline-offset-4">{t('nav.trackOrder')}</Link>
          </p>
        </Section>

        <Section id="help-problem" title={t('help.problemTitle')}>
          <p className="m-0">
            {facts.problemReportDays > 0 ? t('help.problemPromise', { days: facts.problemReportDays }) : t('help.problemAsk')}
          </p>
          <AskAtelierButton className="justify-self-start" />
        </Section>

        <Section id="help-bespoke" title={t('help.bespokeTitle')}>
          <p className="m-0">
            {t('help.bespoke', { days: facts.bespokeDays })}{' '}
            <Link to="/bespoke" className="underline underline-offset-4">{t('nav.bespoke')}</Link>
          </p>
        </Section>

        <Section id="help-privacy" title={t('help.privacyTitle')}>
          <p className="m-0">{t('help.privacy')}</p>
        </Section>

        <Section id="help-contact" title={t('help.contactTitle')}>
          <p className="m-0">{t('help.contact')}</p>
          <AskAtelierButton className="justify-self-start" />
          {facts.contactEmail ? (
            <p className="m-0">
              {t('help.email')}{' '}
              <a href={`mailto:${facts.contactEmail}`} className="underline underline-offset-4">{facts.contactEmail}</a>
            </p>
          ) : null}
        </Section>
      </div>
    </>
  );
};

const HelpPage = () => {
  const { t, region } = useTranslate();
  return (
    <>
      <Helmet>
        <title>{t('help.tab')}</title>
        <meta name="description" content={t('help.meta')} />
        <link rel="canonical" href={shopCanonicalUrl('/help', region)} />
      </Helmet>
      <main className="solivagant-editorial-home">
        <PublicHeader />
        <section className="tracking-content !pt-16">
          <div className="tracking-card">
            <HelpContent />
          </div>
        </section>
        <StorefrontFooter />
      </main>
    </>
  );
};

export default HelpPage;
