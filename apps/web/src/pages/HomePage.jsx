import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Beaker,
  BookOpenText,
  FlaskConical,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import Lenis from 'lenis';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import StorefrontHeader from '@/components/storefront/StorefrontHeader.jsx';
import {
  perfumerProfile,
  storefrontSegments,
} from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.78, ease: [0.22, 1, 0.36, 1] },
  },
};

const CinematicAtelierScene = lazy(() => import('@/components/storefront/CinematicAtelierScene.jsx'));

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.08 },
  },
};

const homeAssets = {
  rawMaterialLibrary: '/brand/home/raw-material-library.jpg',
  rawMaterialShelf: '/brand/home/raw-material-shelf.jpg',
  perfumerPipettes: '/brand/home/perfumer-pipettes.jpg',
  perfumerCylinder: '/brand/home/perfumer-cylinder.jpg',
  perfumerAtWork: '/brand/home/perfumer-at-work.jpg',
};

const atelierPrinciples = [
  {
    icon: FlaskConical,
    label: 'Raw material first',
    text: 'Aroma dibangun dari material nyata, bukan sekadar moodboard.',
  },
  {
    icon: Sparkles,
    label: 'Quiet signature',
    text: 'Dipoles untuk terasa personal, wearable, dan punya jejak halus.',
  },
  {
    icon: Beaker,
    label: 'Measured by hand',
    text: 'Setiap komposisi melewati takaran, evaluasi, dan revisi studio.',
  },
];

const bespokeSteps = [
  'Mood',
  'Memori',
  'Notes',
  'Occasion',
  'Bottle',
  'Direction',
];

const archiveMaterials = [
  {
    name: 'Tuberose absolute',
    profile: 'Creamy floral, narcotic, luminous.',
    tone: '#d8c5a3',
  },
  {
    name: 'Amberwood accord',
    profile: 'Warm resin, dry woods, modern depth.',
    tone: '#9b7554',
  },
  {
    name: 'Green fig leaf',
    profile: 'Milky green, humid, quietly bitter.',
    tone: '#899d76',
  },
  {
    name: 'Clean musk trace',
    profile: 'Soft skin, linen air, transparent trail.',
    tone: '#c8d1c1',
  },
];

const journalTeasers = [
  {
    title: 'How a perfume brief becomes a memory map',
    meta: 'Atelier Notes',
  },
  {
    title: 'Inside the raw material shelf: woods, musks, and smoke',
    meta: 'Material Archive',
  },
  {
    title: 'Why quiet perfume can still feel unforgettable',
    meta: 'Editorial',
  },
];

const getProductMood = (product) => product?.mood || product?.category || 'Atelier signature';

const HomePage = () => {
  const introRef = useRef(null);
  const [introComplete, setIntroComplete] = useState(false);
  const [shouldRenderScene, setShouldRenderScene] = useState(false);
  const catalogProducts = useCatalogProducts();
  const products = useMemo(() => catalogProducts.filter(isProductVisibleInStorefront), [catalogProducts]);
  const categories = useStorefrontCategories(products);
  const homeProducts = products.filter((product) => product.featured).slice(0, 4);
  const featuredProducts = homeProducts.length ? homeProducts : products.slice(0, 4);
  const heroProduct = featuredProducts[0] || products[0];

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setIntroComplete(true), reducedMotion ? 120 : 1650);

    if (introRef.current && !reducedMotion) {
      gsap.fromTo(
        introRef.current.querySelectorAll('[data-loader-line]'),
        { opacity: 0, y: 18, filter: 'blur(8px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, stagger: 0.16, ease: 'power3.out' }
      );
      gsap.to(introRef.current, {
        opacity: 0,
        scale: 1.015,
        delay: 1.18,
        duration: 0.82,
        ease: 'power2.inOut',
      });
    }

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const isDesktop = window.matchMedia?.('(min-width: 900px)').matches;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!isDesktop || reducedMotion) return undefined;

    const lenis = new Lenis({
      duration: 1.16,
      lerp: 0.085,
      smoothWheel: true,
      wheelMultiplier: 0.86,
    });
    let frameId;
    const raf = (time) => {
      lenis.raf(time);
      frameId = window.requestAnimationFrame(raf);
    };
    frameId = window.requestAnimationFrame(raf);

    return () => {
      window.cancelAnimationFrame(frameId);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 900px)');
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const updateScenePreference = () => {
      setShouldRenderScene(Boolean(media?.matches) && !reducedMotion?.matches);
    };

    updateScenePreference();
    media?.addEventListener?.('change', updateScenePreference);
    reducedMotion?.addEventListener?.('change', updateScenePreference);

    return () => {
      media?.removeEventListener?.('change', updateScenePreference);
      reducedMotion?.removeEventListener?.('change', updateScenePreference);
    };
  }, []);

  const storefrontStats = [
    { value: String(products.length || 13), label: 'Perfume objects' },
    { value: String(categories.length || 8), label: 'Aroma families' },
    { value: '1:1', label: 'Bespoke ritual' },
  ];

  return (
    <>
      <Helmet>
        <title>Solivagant - Cinematic Artisan Perfumery Atelier</title>
        <meta name="description" content="Solivagant is an artisan perfumery atelier by Dekito, built around fragrance, memory, raw materials, and bespoke perfume rituals." />
      </Helmet>

      {!introComplete ? (
        <div ref={introRef} className="solivagant-loader" aria-label="Loading Solivagant">
          <div className="solivagant-loader__grain" />
          <div className="solivagant-loader__fog" />
          <p data-loader-line>Artisan Perfumery Atelier</p>
          <h1 data-loader-line>SOLIVAGANT</h1>
          <span data-loader-line>Fragrance, memory, and craftsmanship</span>
        </div>
      ) : null}

      <main className="solivagant-cinematic min-h-screen overflow-hidden bg-[#070906] text-[#f6f0e3]">
        <StorefrontHeader
          className="solivagant-cinematic-nav"
          actions={[
            { to: '/catalog', label: 'Collection' },
            { to: '/bespoke', label: 'Bespoke' },
            { to: '/articles', label: 'Journal' },
            { to: '/cart', label: 'Cart', icon: 'cart', iconOnly: true },
          ]}
        />

        <section className="solivagant-hero">
          <div className="solivagant-hero__scene" aria-hidden="true">
            {introComplete && shouldRenderScene ? (
              <Suspense fallback={<div className="solivagant-scene-fallback" />}>
                <CinematicAtelierScene />
              </Suspense>
            ) : (
              <div className="solivagant-scene-fallback" />
            )}
          </div>
          <div className="solivagant-hero__grain" />
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="solivagant-hero__content"
          >
            <motion.div variants={fadeUp} className="solivagant-kicker">
              <Sparkles className="h-4 w-4" />
              Artisan perfumery atelier by Dekito
            </motion.div>
            <motion.h1 variants={fadeUp}>
              Fragrance as a cinematic memory object.
            </motion.h1>
            <motion.p variants={fadeUp}>
              SOLIVAGANT creates signature perfumes, limited drops, and bespoke scent rituals from a quiet laboratory of raw materials, glass, smoke, and hand-built formulas.
            </motion.p>
            <motion.div variants={fadeUp} className="solivagant-hero__actions">
              <Link to="/catalog" className="solivagant-magnetic-button solivagant-magnetic-button--light">
                Explore Collection
                <ShoppingBag className="h-4 w-4" />
              </Link>
              <Link to="/bespoke" className="solivagant-magnetic-button">
                Create Bespoke Perfume
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </motion.div>
          <div className="solivagant-hero__meta">
            {storefrontStats.map((stat) => (
              <div key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-120px' }}
          className="solivagant-section solivagant-story"
        >
          <motion.div variants={fadeUp} className="solivagant-story__image">
            <img src={homeAssets.perfumerAtWork} alt="Dekito working inside the Solivagant atelier" />
          </motion.div>
          <div className="solivagant-story__copy">
            <motion.div variants={fadeUp} className="solivagant-kicker">
              <UserRound className="h-4 w-4" />
              Perfumer Story
            </motion.div>
            <motion.h2 variants={fadeUp}>Dekito builds perfume like a memory archive.</motion.h2>
            <motion.p variants={fadeUp}>
              {perfumerProfile.intro}
            </motion.p>
            <motion.div variants={fadeUp} className="solivagant-note-card">
              <span>Studio note</span>
              <p>{perfumerProfile.experienceSummary}</p>
            </motion.div>
            <div className="solivagant-principles">
              {atelierPrinciples.map((principle) => {
                const Icon = principle.icon;
                return (
                  <motion.div key={principle.label} variants={fadeUp}>
                    <Icon className="h-5 w-5" />
                    <h3>{principle.label}</h3>
                    <p>{principle.text}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        <motion.section
          id="collection"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-120px' }}
          className="solivagant-section solivagant-collection"
        >
          <motion.div variants={fadeUp} className="solivagant-section-heading">
            <span>Fragrance Collection</span>
            <h2>Objects for atmosphere, skin, and quiet presence.</h2>
            <Link to="/catalog">View full catalog <ArrowRight className="h-4 w-4" /></Link>
          </motion.div>
          <div className="solivagant-product-grid">
            {featuredProducts.slice(0, 4).map((product, index) => (
              <motion.article key={product.id || product.slug} variants={fadeUp} className="solivagant-product-card">
                <div className="solivagant-product-card__number">0{index + 1}</div>
                <ProductVisual product={product} className="solivagant-product-card__visual" imageFit="cover" priority={index === 0} />
                <div className="solivagant-product-card__body">
                  <div>
                    <p>{product.category || 'Atelier'}</p>
                    <h3>{product.name}</h3>
                  </div>
                  <span>{product.price}</span>
                  <p>{product.notes || getProductMood(product)}</p>
                  <div className="solivagant-product-card__footer">
                    <span>{product.size || '30 ml'}</span>
                    <span>{getProductMood(product)}</span>
                    <Link to={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
          <div className="solivagant-category-rail" aria-label="Aroma families">
            {(categories.length ? categories : storefrontSegments).slice(0, 8).map((category) => (
              <Link key={category.name} to={category.filter === 'bespoke' ? '/bespoke' : `/catalog?category=${encodeURIComponent(category.name)}`}>
                {category.name}
              </Link>
            ))}
          </div>
        </motion.section>

        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-120px' }}
          className="solivagant-section solivagant-bespoke"
        >
          <div className="solivagant-bespoke__visual">
            <img src={homeAssets.perfumerPipettes} alt="Perfume pipettes and bespoke formulation objects" />
            <div className="solivagant-bespoke__particles" />
          </div>
          <div className="solivagant-bespoke__copy">
            <motion.div variants={fadeUp} className="solivagant-kicker">
              <MessageCircle className="h-4 w-4" />
              Bespoke Perfume Experience
            </motion.div>
            <motion.h2 variants={fadeUp}>Design a memory, then let the atelier translate it into scent.</motion.h2>
            <motion.p variants={fadeUp}>
              Start with atmosphere, notes, a place, a person, a texture, a season. The brief becomes a personal fragrance direction built for your skin and your ritual.
            </motion.p>
            <motion.div variants={fadeUp} className="solivagant-bespoke__steps">
              {bespokeSteps.map((step, index) => (
                <span key={step}>0{index + 1} {step}</span>
              ))}
            </motion.div>
            <motion.div variants={fadeUp}>
              <Link to="/bespoke" className="solivagant-magnetic-button solivagant-magnetic-button--light">
                Begin Bespoke Brief
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </motion.section>

        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-120px' }}
          className="solivagant-section solivagant-archive"
        >
          <motion.div variants={fadeUp} className="solivagant-section-heading">
            <span>Raw Material Archive</span>
            <h2>A public window into the perfumer's private shelf.</h2>
          </motion.div>
          <div className="solivagant-archive__grid">
            <motion.figure variants={fadeUp}>
              <img src={homeAssets.rawMaterialLibrary} alt="Solivagant raw material library" />
              <figcaption>Glass, labels, tinctures, and quiet laboratory light.</figcaption>
            </motion.figure>
            <div className="solivagant-material-list">
              {archiveMaterials.map((material) => (
                <motion.div key={material.name} variants={fadeUp} className="solivagant-material-card" style={{ '--material-tone': material.tone }}>
                  <span />
                  <div>
                    <h3>{material.name}</h3>
                    <p>{material.profile}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-120px' }}
          className="solivagant-section solivagant-editorial"
        >
          <motion.div variants={fadeUp} className="solivagant-section-heading">
            <span>Journal / Editorial</span>
            <h2>Notes from the archive, written like field records.</h2>
            <Link to="/articles">Read journal <BookOpenText className="h-4 w-4" /></Link>
          </motion.div>
          <div className="solivagant-editorial__grid">
            {journalTeasers.map((article, index) => (
              <motion.article key={article.title} variants={fadeUp}>
                <span>{article.meta}</span>
                <h3>{article.title}</h3>
                <p>{String(index + 1).padStart(2, '0')} / SOLIVAGANT archive</p>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <section className="solivagant-commerce">
          <div>
            <PackageCheck className="h-5 w-5" />
            <h2>Elegant commerce, still usable.</h2>
            <p>Cart, voucher, shipping, payment confirmation, and public order tracking stay clear and direct beneath the cinematic surface.</p>
          </div>
          <div className="solivagant-commerce__actions">
            <Link to="/catalog" className="solivagant-magnetic-button solivagant-magnetic-button--light">Shop Collection</Link>
            <Link to="/track" className="solivagant-magnetic-button">Track Order</Link>
            <Link to="/customer" className="solivagant-magnetic-button">Customer Portal</Link>
          </div>
        </section>
      </main>
    </>
  );
};

export default HomePage;
