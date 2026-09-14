import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { WHY_DIRECT_REASONS } from '@/data/whyDirect.js';
import { getStorefrontWhatsAppNumber } from '@/services/cartService.js';

// "Kenapa beli langsung" — one component for the desktop and phone homes, so the reasons cannot drift.
// The WhatsApp card is hidden when no number is configured, the same rule OverseasInquiryButton uses:
// a chat button that opens wa.me with no recipient is worse than no button.
const WhyBuyDirect = ({ mobile = false }) => {
  const whatsapp = getStorefrontWhatsAppNumber();
  const prefix = mobile ? '/mobile' : '';
  const reasons = WHY_DIRECT_REASONS.filter((reason) => !reason.whatsapp || whatsapp);

  return (
    // data-reveal starts a section at opacity 0 and relies on the page's useScrollReveal container to bring
    // it back. The desktop home has one; the phone home does not (only its LineDividers observe themselves),
    // and the safety net only rescues what is already on screen at 1.2/3/6 s. Below the fold on the phone,
    // this section stayed invisible for good — the fourth time this exact class of bug has hit this repo.
    <section
      className={mobile ? 'm-editorial-section' : 'home-section'}
      data-reveal={mobile ? undefined : true}
      aria-labelledby="why-direct-title"
    >
      <div className={mobile ? 'm-editorial-section__head' : 'home-section__head'}>
        <p className={mobile ? 'm-editorial-eyebrow' : 'editorial-eyebrow'}>KENAPA BELI LANGSUNG</p>
        <h2 id="why-direct-title">Yang tidak kamu dapat di marketplace.</h2>
      </div>
      <div className={`why-direct__grid${mobile ? ' why-direct__grid--mobile' : ''}`}>
        {reasons.map((reason) => (
          <article key={reason.key} className="why-direct__card">
            <h3 className="why-direct__title">{reason.title}</h3>
            <p className="why-direct__body">{reason.body}</p>
            {reason.whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('Halo Solivagant, saya mau tanya soal fragrance.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="why-direct__link"
              >
                <MessageCircle className="h-3.5 w-3.5" /> {reason.cta}
              </a>
            ) : (
              <Link to={`${prefix}${reason.to}`} className="why-direct__link">
                {reason.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

export default WhyBuyDirect;
