import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';

const materials = [
  {
    name: 'Orris butter',
    origin: 'Italy / aged rhizome',
    family: 'Powdered woods',
    description: 'Cool violet dust, suede, and cosmetic softness with a long, intimate trace.',
    mood: 'Quiet, polished, intimate',
  },
  {
    name: 'Green fig leaf',
    origin: 'Mediterranean impression',
    family: 'Green aromatic',
    description: 'Milky leaf, pear skin, wet stem, and a clean bitter-green edge.',
    mood: 'Verdant, reflective, airy',
  },
  {
    name: 'Tuberose absolute',
    origin: 'India / cultivated white flowers',
    family: 'White floral',
    description: 'Creamed petals, warm skin, night air, and a luminous ceremonial floral body.',
    mood: 'Radiant, intimate, magnetic',
  },
  {
    name: 'Amberwood accord',
    origin: 'Atelier structure',
    family: 'Amber woods',
    description: 'Dry resin, modern woods, and polished depth used to give formulas architecture.',
    mood: 'Sculptural, warm, composed',
  },
  {
    name: 'Vetiver fraction',
    origin: 'Haiti / refined root material',
    family: 'Dry woods',
    description: 'Earth, smoke, mineral grass, and a tailored woody dryness.',
    mood: 'Grounded, elegant, restrained',
  },
  {
    name: 'Clean musk trace',
    origin: 'Soft musk palette',
    family: 'Skin musk',
    description: 'Transparent linen, warmed skin, and a low-volume trail made for daily ritual.',
    mood: 'Tactile, close, serene',
  },
];

const PublicMaterialsPage = () => (
  <>
    <Helmet>
      <title>Materials - SOLIVAGANT</title>
      <meta name="description" content="A public raw material storytelling archive from SOLIVAGANT." />
    </Helmet>

    <main className="solivagant-editorial-home">
      <header className="editorial-header">
        <Link to="/home" className="editorial-wordmark">SOLIVAGANT</Link>
        <nav className="editorial-nav" aria-label="Storefront navigation">
          <Link to="/catalog">Collection</Link>
          <Link to="/bespoke">Bespoke</Link>
          <Link to="/materials">Materials</Link>
          <Link to="/journal">Journal</Link>
          <Link to="/track-order">Track Order</Link>
        </nav>
        <Link to="/cart" className="editorial-cart-button"><ShoppingBag className="h-4 w-4" />Cart</Link>
      </header>

      <section className="editorial-page-hero">
        <p className="editorial-eyebrow">PUBLIC RAW MATERIAL ARCHIVE</p>
        <h1>Materials</h1>
        <p>Raw materials presented as sensory stories: origin, olfactive family, texture, and mood. This is a public archive, not an internal inventory.</p>
      </section>

      <section className="editorial-section editorial-section--compact">
        <div className="editorial-material-grid">
          {materials.map((material) => (
            <article key={material.name} className="editorial-material-card">
              <span>{material.family}</span>
              <h3>{material.name}</h3>
              <p className="editorial-material-card__origin">{material.origin}</p>
              <p>{material.description}</p>
              <strong>{material.mood}</strong>
            </article>
          ))}
        </div>
      </section>

      <footer className="editorial-footer">
        <span>SOLIVAGANT by Dekito</span>
        <Link to="/journal">Read Journal</Link>
      </footer>
    </main>
  </>
);

export default PublicMaterialsPage;
