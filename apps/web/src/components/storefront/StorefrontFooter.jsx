import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

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

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
    }
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
            <p className="sf-footer__subscribed">Thank you for subscribing.</p>
          ) : (
            <form onSubmit={handleSubscribe} className="sf-footer__newsletter-form">
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="sf-footer__newsletter-input"
              />
              <button type="submit" className="sf-footer__newsletter-btn" aria-label="Subscribe">
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="sf-footer__bottom">
        <small>&copy; {new Date().getFullYear()} SOLIVAGANT by Dekito</small>
      </div>
    </footer>
  );
};

export default StorefrontFooter;
