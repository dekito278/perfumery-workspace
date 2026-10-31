import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { whyDirectReasons } from '@/data/whyDirect.js';
import { getStorefrontWhatsAppNumber } from '@/services/cartService.js';
import { useTranslate } from '@/hooks/useTranslate.js';

// "Kenapa beli langsung" — one component for the home and the welcome page, so the reasons cannot drift.
// The WhatsApp card is hidden when no number is configured, the same rule OverseasInquiryButton uses:
// a chat button that opens wa.me with no recipient is worse than no button.
// Numbered, as the canvas sets them. A numeral, not a word, so there is nothing in it to translate.
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

const WhyBuyDirect = () => {
  const whatsapp = getStorefrontWhatsAppNumber();
  const { t, region } = useTranslate();
  const reasons = whyDirectReasons(region).filter((reason) => !reason.whatsapp || whatsapp);

  return (
    // data-reveal starts a section at opacity 0 and relies on the page's useScrollReveal container to
    // bring it back. The retired phone home had none, and this section stayed invisible there for good;
    // whyDirect.selfcheck now holds that every page rendering it has the container.
    <section
      className="ng-section ng-section--deep"
      data-reveal
      aria-labelledby="why-direct-title"
    >
      <div className="ng-container flex flex-col gap-14">
        <div className="flex max-w-[980px] flex-col gap-3.5">
          <p className="ng-mono m-0 text-ng-ash">{t('why.eyebrow')}</p>
          <h2 id="why-direct-title" className="ng-display ng-h2">{t('why.heading')}</h2>
        </div>
        <div className="ng-why">
          {reasons.map((reason, index) => (
            <article key={reason.key} className="ng-why__card">
              <p className="ng-mono m-0 text-ng-ember">{ROMAN[index] || index + 1}</p>
              <h3 className="m-0 font-ng-display text-[28px] font-normal leading-tight md:text-[30px]">{t(reason.titleKey)}</h3>
              <p className="m-0 text-[15px] leading-relaxed text-ng-dust">{t(reason.bodyKey)}</p>
              {reason.whatsapp ? (
                <a
                  href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(t('why.whatsappMessage'))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ng-link ng-mono mt-auto inline-flex min-h-[44px] items-center gap-2"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> {t(reason.ctaKey)}
                </a>
              ) : (
                <Link to={reason.to} className="ng-link ng-mono mt-auto inline-flex min-h-[44px] items-center gap-2">
                  {t(reason.ctaKey)} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyBuyDirect;
