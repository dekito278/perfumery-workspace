import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenText,
  Check,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
} from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { featuredProducts, perfumerProfile } from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';

const homeAssets = {
  rawMaterialLibrary: '/brand/home/raw-material-library.jpg',
  rawMaterialShelf: '/brand/home/raw-material-shelf.jpg',
  perfumerPipettes: '/brand/home/perfumer-pipettes.jpg',
  perfumerCylinder: '/brand/home/perfumer-cylinder.jpg',
};

const fallbackCollection = featuredProducts.slice(0, 4);

const materials = [
  {
    name: 'Orris butter',
    origin: 'Italy / aged rhizome',
    family: 'Powdered woods',
    description: 'Cool violet dust, suede, and a cosmetic softness that settles close to skin.',
    mood: 'Quiet, polished, intimate',
  },
  {
    name: 'Green fig leaf',
    origin: 'Mediterranean impression',
    family: 'Green aromatic',
    description: 'Milky leaf, sap, pear skin, and humid shade with a clean bitter edge.',
    mood: 'Verdant, reflective, airy',
  },
  {
    name: 'Amberwood accord',
    origin: 'Atelier structure',
    family: 'Amber woods',
    description: 'A dry modern warmth that gives a formula architecture, diffusion, and shadow.',
    mood: 'Sculptural, warm, composed',
  },
  {
    name: 'Clean musk trace',
    origin: 'Soft musk palette',
    family: 'Skin musk',
    description: 'Transparent linen, skin warmth, and a low-volume trail made for daily ritual.',
    mood: 'Tactile, close, serene',
  },
];

const journalArticles = [
  {
    title: 'Scent memory as a design material',
    category: 'Memory',
    text: 'How places, gestures, and personal rituals become the first structure of a perfume brief.',
  },
  {
    title: 'Reading the raw material shelf',
    category: 'Materials',
    text: 'A field note on woods, musks, resins, florals, and the small decisions that shape texture.',
  },
  {
    title: 'From lab note to finished bottle',
    category: 'Process',
    text: 'Inside the resting, evaluation, refinement, and finishing rhythm of a small atelier batch.',
  },
];

const formatProductDescription = (product) => product?.description || product?.notes || product?.mood || 'A quiet Solivagant composition made for skin, atmosphere, and ritual.';
const getNotes = (product, key, fallback = []) => (Array.isArray(product?.[key]) && product[key].length ? product[key] : fallback);

const HomePage = () => {
  const catalogProducts = useCatalogProducts();
  const visibleProducts = useMemo(
    () => catalogProducts.filter(isProductVisibleInStorefront),
    [catalogProducts]
  );
  const collection = (visibleProducts.length ? visibleProducts : fallbackCollection).slice(0, 4);
  const featured = collection[0] || fallbackCollection[0];

  const topNotes = getNotes(featured, 'topNotes', ['Bergamot', 'Green fig', 'Cardamom']);
  const heartNotes = getNotes(featured, 'heartNotes', ['Orris', 'Tea absolute', 'Soft woods']);
  const baseNotes = getNotes(featured, 'baseNotes', ['Amberwood', 'Clean musk', 'Cedar']);

  return (
    <>
      <Helmet>
        <title>SOLIVAGANT - Artisan Perfumery Atelier by Dekito</title>
        <meta
          name="description"
          content="SOLIVAGANT is an artisan perfumery atelier by Dekito, crafting quiet olfactive works from raw materials, memory, and personal ritual."
        />
        <meta property="og:title" content="SOLIVAGANT - Artisan Perfumery Atelier" />
        <meta property="og:description" content="A refined editorial perfume house by perfumer Dekito." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/brand/home/raw-material-library.jpg" />
      </Helmet>

      <main className="solivagant-editorial-home">
        <header className="editorial-header">
          <Link to="/home" className="editorial-wordmark" aria-label="SOLIVAGANT home">
            SOLIVAGANT
          </Link>
          <nav className="editorial-nav" aria-label="Storefront navigation">
            <Link to="/catalog">Collection</Link>
            <Link to="/bespoke">Bespoke</Link>
            <Link to="/materials">Materials</Link>
            <Link to="/journal">Journal</Link>
            <Link to="/track-order">Track Order</Link>
          </nav>
          <Link to="/cart" className="editorial-cart-button">
            <ShoppingBag className="h-4 w-4" />
            Cart
          </Link>
        </header>

        <section className="editorial-hero">
          <div className="editorial-hero__copy">
            <p className="editorial-eyebrow">ARTISAN PERFUMERY ATELIER</p>
            <h1>Fragrance as a memory object.</h1>
            <p className="editorial-lede">
              SOLIVAGANT is an artisan perfume atelier by Dekito, crafting quiet olfactive works from raw materials, memory, and personal ritual.
            </p>
            <div className="editorial-actions">
              <Link to="/catalog" className="editorial-button editorial-button--primary">
                Explore Collection
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/bespoke" className="editorial-button">
                Book Bespoke Consultation
              </Link>
            </div>
          </div>
          <div className="editorial-hero__visual" aria-label="Solivagant perfume atelier composition">
            <div className="editorial-hero__panel">
              <img src={homeAssets.perfumerCylinder} alt="Perfume bottle and formulation objects in the Solivagant atelier" />
              <div className="editorial-bottle-card">
                <span>Limited atelier object</span>
                <strong>{featured?.name || 'Santal Morn'}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="editorial-section editorial-story">
          <div className="editorial-image-frame">
            <img src={homeAssets.perfumerPipettes} alt="Dekito working with pipettes and perfume materials" />
          </div>
          <div className="editorial-story__copy">
            <p className="editorial-eyebrow">PERFUMER STORY</p>
            <h2>Dekito builds scent as personal atmosphere.</h2>
            <p>{perfumerProfile.intro}</p>
            <blockquote>
              <span>Atelier note</span>
              <p>Each formula is treated as a small archive: raw material behavior, emotional direction, skin texture, and the memory it should leave behind.</p>
            </blockquote>
          </div>
        </section>

        <section id="collection" className="editorial-section">
          <div className="editorial-section-heading">
            <p className="editorial-eyebrow">FRAGRANCE COLLECTION</p>
            <h2>Quiet signatures for skin, atmosphere, and ritual.</h2>
            <Link to="/catalog">View all fragrances <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="editorial-product-grid">
            {collection.map((product, index) => (
              <article key={product.id || product.slug || product.name} className="editorial-product-card">
                <ProductVisual
                  product={product}
                  className="editorial-product-card__visual"
                  imageFit="cover"
                  priority={index === 0}
                />
                <div className="editorial-product-card__body">
                  <span>{product.category || 'Atelier'}</span>
                  <h3>{product.name}</h3>
                  <p>{formatProductDescription(product)}</p>
                  <dl>
                    <div>
                      <dt>Notes</dt>
                      <dd>{product.notes || [topNotes[0], heartNotes[0], baseNotes[0]].join(', ')}</dd>
                    </div>
                    <div>
                      <dt>Size</dt>
                      <dd>{product.size || '30 ml'} / {product.price || 'Rp 289.000'}</dd>
                    </div>
                  </dl>
                  <div className="editorial-product-card__actions">
                    <Link to={`/catalog/${product.slug}`}>View Details</Link>
                    <Link to="/cart">Add to Cart</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="editorial-section editorial-featured">
          <div className="editorial-featured__visual">
            <ProductVisual product={featured} className="editorial-featured__product" priority />
          </div>
          <div className="editorial-featured__copy">
            <p className="editorial-eyebrow">PRODUCT DETAIL PREVIEW</p>
            <h2>{featured?.name || 'Santal Morn'}</h2>
            <p>{formatProductDescription(featured)}</p>
            <div className="editorial-notes-grid">
              <div><span>Top</span><p>{topNotes.join(', ')}</p></div>
              <div><span>Heart</span><p>{heartNotes.join(', ')}</p></div>
              <div><span>Base</span><p>{baseNotes.join(', ')}</p></div>
            </div>
            <div className="editorial-feature-list">
              <span>{featured?.mood || 'Quiet daily signature'}</span>
              <span>{featured?.concentration || 'Eau de Parfum'}</span>
              <span>10 ml / 30 ml / 50 ml</span>
            </div>
            <Link to="/cart" className="editorial-button editorial-button--primary">
              Add to Cart
              <ShoppingBag className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section id="bespoke" className="editorial-section editorial-bespoke">
          <div>
            <p className="editorial-eyebrow">BESPOKE CONSULTATION</p>
            <h2>A personal scent direction, shaped through conversation.</h2>
            <p>
              Begin with a place, a person, a texture, or a private ritual. The atelier translates the brief into a focused formula direction and refined finished fragrance.
            </p>
            <ol className="editorial-steps">
              {['Discovery', 'Scent Profiling', 'Formula Direction', 'Refinement', 'Final Fragrance'].map((step) => (
                <li key={step}><Check className="h-4 w-4" />{step}</li>
              ))}
            </ol>
          </div>
          <form className="editorial-form">
            <label>Name<input type="text" placeholder="Your name" /></label>
            <label>Email / WhatsApp<input type="text" placeholder="name@example.com / +62..." /></label>
            <label>Preferred scent direction<input type="text" placeholder="Woody, floral, fresh, smoky..." /></label>
            <label>Occasion / purpose<input type="text" placeholder="Daily ritual, gift, wedding, signature..." /></label>
            <label>Message<textarea rows="4" placeholder="Tell us the memory, mood, or material you want to explore." /></label>
            <Link to="/bespoke" className="editorial-button editorial-button--primary">Book Consultation</Link>
          </form>
        </section>

        <section id="materials" className="editorial-section">
          <div className="editorial-section-heading">
            <p className="editorial-eyebrow">PUBLIC RAW MATERIAL ARCHIVE</p>
            <h2>Materials as stories, not inventory.</h2>
          </div>
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

        <section id="journal" className="editorial-section editorial-journal">
          <div className="editorial-section-heading">
            <p className="editorial-eyebrow">JOURNAL / EDITORIAL</p>
            <h2>Field notes from the atelier.</h2>
            <Link to="/journal">Read journal <BookOpenText className="h-4 w-4" /></Link>
          </div>
          <div className="editorial-journal-grid">
            {journalArticles.map((article) => (
              <article key={article.title}>
                <span>{article.category}</span>
                <h3>{article.title}</h3>
                <p>{article.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="editorial-section editorial-commerce">
          <div className="editorial-cart-preview">
            <p className="editorial-eyebrow">CART / CHECKOUT PREVIEW</p>
            <h2>Customer checkout, kept calm.</h2>
            <div className="editorial-cart-line">
              <div>
                <strong>{featured?.name || 'Santal Morn'}</strong>
                <span>{featured?.size || '30 ml'} - {featured?.price || 'Rp 289.000'}</span>
              </div>
              <div className="editorial-qty"><Minus className="h-3 w-3" />1<Plus className="h-3 w-3" /></div>
            </div>
            <div className="editorial-subtotal"><span>Subtotal</span><strong>{featured?.price || 'Rp 289.000'}</strong></div>
            <div className="editorial-checkout-fields">
              <span>Shipping information</span>
              <span>Payment confirmation placeholder</span>
            </div>
            <Link to="/cart" className="editorial-button editorial-button--primary">Open Cart</Link>
          </div>
          <div id="tracking" className="editorial-tracking-preview">
            <p className="editorial-eyebrow">ORDER TRACKING</p>
            <h2>Public order status.</h2>
            <label>Order number<input type="text" placeholder="SOL-2026-001" /></label>
            <label>Email / phone<input type="text" placeholder="Customer contact" /></label>
            <div className="editorial-timeline">
              {['Order received', 'Formula checked', 'Packed for delivery', 'Estimated delivery'].map((item, index) => (
                <span key={item} className={index < 2 ? 'is-complete' : ''}>{item}</span>
              ))}
            </div>
            <Link to="/track-order" className="editorial-button"><Search className="h-4 w-4" />Track Order</Link>
          </div>
        </section>

        <footer className="editorial-footer">
          <PackageCheck className="h-5 w-5" />
          <span>SOLIVAGANT by Dekito</span>
          <Link to="/customer">Customer Portal</Link>
        </footer>
      </main>
    </>
  );
};

export default HomePage;
