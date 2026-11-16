import RegionSwitch from '@/components/storefront/RegionSwitch.jsx';
import { useSiteFacts } from '@/hooks/useSiteFacts.js';
import React from 'react';
import { Link } from 'react-router-dom';
import { buildWhatsAppCheckoutUrl, getStorefrontWhatsAppNumber } from '@/services/cartService.js';
import { useTranslate } from '@/hooks/useTranslate.js';


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
    // The journal had a column of its own with one link in it, "Terbaru".
    links: [
      { labelKey: 'nav.about', to: '/about' },
      { labelKey: 'nav.help', to: '/help' },
      { labelKey: 'nav.journal', to: '/journal' },
      { labelKey: 'nav.account', to: '/customer' },
      { labelKey: 'nav.trackOrder', to: '/track-order' },
    ],
  },
];

const StorefrontFooter = () => {
  const { t } = useTranslate();
  const siteFacts = useSiteFacts();
  // One source for the number. Rendered only when configured — a wa.me link with no recipient is a dead end.
  const whatsapp = getStorefrontWhatsAppNumber();
  return (
    <footer className="ng-footer">
      <div className="ng-container">
        <div className="ng-footer__grid">
          <div className="ng-footer__brand">
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

          {/* WhatsApp only (Dekito, 16 Nov 2026): the box asked for an email and then sent it on WhatsApp, so a
              buyer without WhatsApp could not sign up and everyone else expected a newsletter. Now it says what
              it is — news on WhatsApp — and opens the chat with the request already written. */}
          <div className="ng-footer__column ng-footer__signup">
            <span className="ng-footer__heading ng-mono">{t('nav.stayInTouch')}</span>
            <p className="m-0 text-sm text-ng-dust">{t('nav.subscribeHow')}</p>
            <a
              href={buildWhatsAppCheckoutUrl(t('nav.subscribeDraft'))}
              target="_blank"
              rel="noopener noreferrer"
              className="ng-btn ng-btn--ghost mt-2 self-start"
            >
              {t('nav.subscribeCta')}
            </a>
          </div>
        </div>

        <div className="ng-footer__bottom ng-mono">
          <small>&copy; {new Date().getFullYear()} {siteFacts.footerOwner}</small>
          {/* It read "· ID / EN" — letters that looked like the switch and did nothing when tapped. */}
          <span className="ng-footer__place">{t('nav.footerPlace')}<RegionSwitch /></span>
        </div>
      </div>
    </footer>
  );
};

export default StorefrontFooter;
