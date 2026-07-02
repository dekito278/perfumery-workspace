import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { buildWhatsAppCheckoutUrl } from '@/services/cartService.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const footerColumns = [
  {
    title: 'Shop',
    links: [
      { label: 'All Fragrances', to: '/catalog' },
      { label: 'Bespoke Ritual', to: '/bespoke' },
    ],
  },
  {
    title: 'Info',
    links: [
      { label: 'Raw Materials', to: '/materials' },
      { label: 'Track Order', to: '/track-order' },
    ],
  },
  {
    title: 'Journal',
    links: [
      { label: 'Latest', to: '/journal' },
    ],
  },
];

const StorefrontFooter = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState('');

  const handleSubscribe = (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('Masukkan alamat email yang valid.');
      return;
    }
    // No mailing-list backend yet — route the request to the atelier's WhatsApp so it
    // actually reaches a human instead of silently pretending to subscribe.
    const message = `Halo SOLIVAGANT, saya mau berlangganan update atelier. Email saya: ${trimmed}`;
    const url = buildWhatsAppCheckoutUrl(message);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    setError('');
    setSubscribed(true);
    setEmail('');
  };

  return (
    <footer className="sf-footer">
      <div className="sf-footer__inner">
        <div className="sf-footer__brand">
          <Link to="/home" className="sf-footer__wordmark">SOLIVAGANT</Link>
          <p className="sf-footer__tagline">Artisan Perfumery Atelier by Dekito</p>
        </div>

        <div className="sf-footer__columns">
          {footerColumns.map((col) => (
            <div key={col.title} className="sf-footer__column">
              <span className="sf-footer__column-title">{col.title}</span>
              {col.links.map((link) => (
                <Link key={link.to} to={link.to}>{link.label}</Link>
              ))}
            </div>
          ))}
        </div>

        <div className="sf-footer__newsletter">
          <span className="sf-footer__column-title">Stay with the atelier</span>
          {subscribed ? (
            <p className="sf-footer__subscribed">Terima kasih — lanjutkan di WhatsApp untuk konfirmasi langganan.</p>
          ) : (
            <form onSubmit={handleSubscribe} className="sf-footer__newsletter-form" noValidate>
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                required
                aria-invalid={error ? 'true' : undefined}
                className="sf-footer__newsletter-input"
              />
              <button type="submit" className="sf-footer__newsletter-btn" aria-label="Subscribe">
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
          {error ? <p className="sf-footer__newsletter-error" role="alert">{error}</p> : null}
        </div>
      </div>

      <div className="sf-footer__bottom">
        <small>&copy; {new Date().getFullYear()} SOLIVAGANT by Dekito</small>
      </div>
    </footer>
  );
};

export default StorefrontFooter;
