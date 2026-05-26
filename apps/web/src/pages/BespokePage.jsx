import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';

const steps = ['Discovery', 'Scent Profiling', 'Formula Direction', 'Refinement', 'Final Fragrance'];

const BespokePage = () => (
  <>
    <Helmet>
      <title>Bespoke Perfume Consultation - SOLIVAGANT</title>
      <meta name="description" content="Book a bespoke perfume consultation with SOLIVAGANT by Dekito." />
    </Helmet>

    <main className="solivagant-editorial-home">
      <PublicHeader />

      <section className="editorial-page-hero editorial-page-hero--split">
        <div>
          <p className="editorial-eyebrow">BESPOKE PERFUME CONSULTATION</p>
          <h1>Bespoke Perfume Consultation</h1>
          <p>
            A personal fragrance direction shaped through memory, raw materials, skin texture, and the quiet rituals you want the perfume to hold.
          </p>
        </div>
        <ol className="editorial-steps editorial-steps--panel">
          {steps.map((step) => (
            <li key={step}><Check className="h-4 w-4" />{step}</li>
          ))}
        </ol>
      </section>

      <section className="editorial-section editorial-bespoke editorial-section--compact">
        <div>
          <p className="editorial-eyebrow">ATELIER BRIEF</p>
          <h2>Tell the atelier what the scent should remember.</h2>
          <p>
            Share a material, place, person, season, or mood. Dekito translates the brief into a focused olfactive direction before refinement and final fragrance.
          </p>
        </div>
        <form className="editorial-form">
          <label>Name<input type="text" placeholder="Your name" /></label>
          <label>Email / WhatsApp<input type="text" placeholder="name@example.com / +62..." /></label>
          <label>Preferred scent direction<input type="text" placeholder="Woody, floral, fresh, smoky..." /></label>
          <label>Occasion / purpose<input type="text" placeholder="Daily ritual, gift, wedding, signature..." /></label>
          <label>Message<textarea rows="5" placeholder="Tell us the memory, material, or mood you want to explore." /></label>
          <button type="button" className="editorial-button editorial-button--primary">Book Consultation</button>
        </form>
      </section>

      <footer className="editorial-footer">
        <span>SOLIVAGANT by Dekito</span>
        <Link to="/catalog">Explore Collection</Link>
      </footer>
    </main>
  </>
);

export default BespokePage;
