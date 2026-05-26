import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';

const steps = ['Aroma', 'Preferensi', 'Botol', 'Ongkir', 'Bayar'];

const BespokePage = () => (
  <>
    <Helmet>
      <title>Bespoke Perfume Consultation - SOLIVAGANT</title>
      <meta name="description" content="Request a SOLIVAGANT custom perfume consultation through Aroma, Preferensi, Botol, Ongkir, and Bayar. Pre-order 7-14 hari." />
      <meta property="og:title" content="Bespoke Perfume Consultation - SOLIVAGANT" />
      <meta property="og:description" content="A public customer-facing custom perfume request flow by SOLIVAGANT, with internal formula and studio workflow kept private." />
    </Helmet>

    <main className="solivagant-editorial-home">
      <PublicHeader />

      <section className="editorial-page-hero editorial-page-hero--split">
        <div>
          <p className="editorial-eyebrow">BESPOKE PERFUME CONSULTATION</p>
          <h1>Bespoke Perfume Consultation</h1>
          <p className="editorial-product-detail__price">Request parfum custom · Pre-order 7-14 hari</p>
          <p>
            A customer-facing request ritual for translating aroma direction, personal preference, bottle size, delivery area, and payment readiness into a refined atelier brief.
          </p>
        </div>
        <ol className="editorial-steps editorial-steps--panel">
          {steps.map((step, index) => (
            <li key={step}><Check className="h-4 w-4" />{index + 1}. {step}</li>
          ))}
        </ol>
      </section>

      <section className="editorial-section editorial-bespoke editorial-section--compact">
        <div>
          <p className="editorial-eyebrow">ATELIER BRIEF</p>
          <h2>A custom scent request, kept public and simple.</h2>
          <p>
            This page mirrors the customer side of the SOLIVAGANT custom flow without exposing formula work, validation, material cost, or internal studio operations.
          </p>
          <div className="editorial-bespoke-summary">
            <p className="editorial-eyebrow">REQUEST SUMMARY</p>
            <dl>
              <div><dt>Selected aroma</dt><dd>Woody floral direction</dd></div>
              <div><dt>Selected size</dt><dd>30 ml / 50 ml / 100 ml</dd></div>
              <div><dt>Pre-order time</dt><dd>7-14 hari</dd></div>
              <div><dt>Estimated price</dt><dd>Price on request</dd></div>
            </dl>
          </div>
        </div>
        <form className="editorial-form">
          <label>Nama parfum / project name<input type="text" placeholder="A working name for the custom scent" /></label>
          <label>Scent direction<input type="text" placeholder="Woody, floral, aquatic, gourmand, smoky..." /></label>
          <label>Notes / mood reference<input type="text" placeholder="Materials, memories, places, or fragrances you like" /></label>
          <label>Size selection<select defaultValue="30 ml"><option>30 ml</option><option>50 ml</option><option>100 ml</option></select></label>
          <label>Bottle preference<input type="text" placeholder="Minimal, ceremonial, travel-friendly..." /></label>
          <label>Delivery area<input type="text" placeholder="City / district for shipping estimate" /></label>
          <label>Name<input type="text" placeholder="Your name" /></label>
          <label>Email / WhatsApp<input type="text" placeholder="name@example.com / +62..." /></label>
          <label>Message<textarea rows="5" placeholder="Tell us the memory, material, or mood you want to explore." /></label>
          <button type="button" className="editorial-button editorial-button--primary">Submit Request</button>
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
