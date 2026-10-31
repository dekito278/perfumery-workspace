import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { buildWhatsAppCheckoutUrl, getStorefrontWhatsAppNumber } from '@/services/cartService.js';
import { useTranslate } from '@/hooks/useTranslate.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// `key` is what the code branches on — the WhatsApp link hangs off the info column — and it must not be
// a translated string, or the branch breaks the moment the shop is read in English.
const footerColumns = [
  {
    key: 'shop',
    titleKey: 'nav.shop',
    links: [
      { labelKey: 'nav.allFragrances', to: '/catalog' },
      { labelKey: 'nav.bespoke', to: '/bespoke' },
    ],
  },
  {
    key: 'info',
    titleKey: 'nav.info',
    links: [
      { labelKey: 'nav.about', to: '/about' },
      { labelKey: 'nav.account', to: '/customer' },
      { labelKey: 'nav.trackOrder', to: '/track-order' },
    ],
  },
  {
    key: 'journal',
    titleKey: 'nav.journal',
    links: [
      { labelKey: 'nav.latest', to: '/journal' },
    ],
  },
];

const StorefrontFooter = () => {
  const { t } = useTranslate();
  // One source for the number. Rendered only when configured — a wa.me link with no recipient is a dead end.
  const whatsapp = getStorefrontWhatsAppNumber();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState('');

  const handleSubscribe = (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(t('nav.invalidEmail'));
      return;
    }
    // No mailing-list backend yet — route the request to the atelier's WhatsApp so it
    // actually reaches a human instead of silently pretending to subscribe.
    const message = t('nav.subscribeDraft', { email: trimmed });
    const url = buildWhatsAppCheckoutUrl(message);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    setError('');
    setSubscribed(true);
    setEmail('');
  };

  return (
    <footer className="ng-footer">
      <div className="ng-container">
        <div className="ng-footer__grid">
          <div>
            <Link to="/home" className="ng-footer__wordmark">SOLIVAGANT</Link>
            <p className="ng-footer__tagline">{t('nav.footerTagline')}</p>
          </div>

          {footerColumns.map((col) => (
            <div key={col.key} className="ng-footer__column">
              <span className="ng-footer__heading ng-mono">{t(col.titleKey)}</span>
              {col.links.map((link) => (
                <Link key={link.to} to={link.to} className="ng-link">{t(link.labelKey)}</Link>
              ))}
              {col.key === 'info' && whatsapp ? (
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="ng-link">{t('nav.whatsapp')}</a>
              ) : null}
            </div>
          ))}

          <div className="ng-footer__column">
            <span className="ng-footer__heading ng-mono">{t('nav.stayInTouch')}</span>
            {subscribed ? (
              <p className="m-0 text-sm text-ng-sand">{t('nav.subscribeThanks')}</p>
            ) : (
              <form onSubmit={handleSubscribe} className="ng-footer__form" noValidate>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  aria-label={t('nav.emailPlaceholder')}
                  placeholder={t('nav.emailPlaceholder')}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                  required
                  aria-invalid={error ? 'true' : undefined}
                  className="ng-field"
                />
                <button type="submit" aria-label={t('nav.subscribeAria')}>
                  <ArrowRight className="mx-auto h-4 w-4" />
                </button>
              </form>
            )}
            {error ? <p className="ng-error m-0 mt-2 text-sm" role="alert">{error}</p> : null}
          </div>
        </div>

        <div className="ng-footer__bottom ng-mono">
          <small>&copy; {new Date().getFullYear()} SOLIVAGANT by Dekito</small>
          <span>{t('nav.footerPlace')}</span>
        </div>
      </div>
    </footer>
  );
};

export default StorefrontFooter;
