import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { useSiteImages } from '@/hooks/useSiteImages.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import { getPublishedJournalPosts, getJournalCategoryLabel, getJournalPublicPath } from '@/services/journalPostsSupabaseService.js';

const moodCategories = [
  { name: 'Quiet & Minimal', family: 'Fresh', description: 'Clean citrus, soft musk, and airy texture for effortless daily wear.', image: null },
  { name: 'Warm & Nostalgic', family: 'Gourmand', description: 'Vanilla, tonka, and roasted warmth — comfort distilled into scent.', image: null },
  { name: 'Dark & Moody', family: 'Woody', description: 'Cedar, vetiver, and mineral depth for structured presence.', image: null },
  { name: 'Soft & Romantic', family: 'Floral', description: 'Rose, jasmine, and powdery musk — tender without being sweet.', image: null },
];

const getArticleExcerpt = (article) =>
  article?.excerpt || String(article?.content || '').replace(/[`*_>#-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);

const HomePage = () => {
  const catalogProducts = useCatalogProducts();
  const { images: siteImages } = useSiteImages();
  const [publishedArticles, setPublishedArticles] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [activeMood, setActiveMood] = useState(0);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const revealRef = useScrollReveal();
  const heroTimerRef = useRef(null);
  const carouselRef = useRef(null);

  const visibleProducts = useMemo(
    () => catalogProducts.filter(isProductVisibleInStorefront),
    [catalogProducts]
  );
  const publicCatalog = useMemo(() => getPublicFragranceCatalog(visibleProducts), [visibleProducts]);
  const heroProducts = publicCatalog.slice(0, 6);
  const collectionProducts = publicCatalog.slice(0, 8);

  // Hero slideshow auto-advance
  useEffect(() => {
    if (heroProducts.length <= 1) return;
    heroTimerRef.current = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroProducts.length);
    }, 5000);
    return () => clearInterval(heroTimerRef.current);
  }, [heroProducts.length]);

  const goToHeroSlide = useCallback((index) => {
    setHeroIndex(index);
    clearInterval(heroTimerRef.current);
    heroTimerRef.current = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroProducts.length);
    }, 5000);
  }, [heroProducts.length]);

  // Journal articles
  useEffect(() => {
    let active = true;
    getPublishedJournalPosts()
      .then((posts) => { if (active) setPublishedArticles(posts.slice(0, 3)); })
      .catch(() => { if (active) setPublishedArticles([]); });
    return () => { active = false; };
  }, []);

  // Carousel scroll
  const scrollCarousel = (direction) => {
    if (!carouselRef.current) return;
    const scrollAmount = carouselRef.current.offsetWidth * 0.6;
    carouselRef.current.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
  };

  return (
    <>
      <Helmet>
        <title>SOLIVAGANT - Artisan Perfumery Atelier by Dekito</title>
        <meta name="description" content="SOLIVAGANT is an artisan perfumery atelier by Dekito, crafting quiet olfactive works from raw materials, memory, and personal ritual." />
        <meta property="og:title" content="SOLIVAGANT - Artisan Perfumery Atelier" />
        <meta property="og:description" content="A refined editorial perfume house by perfumer Dekito." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/brand/home/raw-material-library.jpg" />
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <PublicHeader />

        {/* ── 1. Hero Slideshow ── */}
        <section className="home-hero">
          {heroProducts.length > 0 ? (
            <>
              {heroProducts.map((product, i) => (
                <div key={product.id} className={`home-hero__slide ${i === heroIndex ? 'home-hero__slide--active' : ''}`}>
                  <ProductVisual
                    product={product}
                    className="home-hero__slide-image"
                    imageFit="cover"
                    priority={i === 0}
                  />
                </div>
              ))}
              <div className="home-hero__overlay">
                <Link to={`/catalog/${heroProducts[heroIndex]?.slug}`} className="home-hero__product-name hero-animate-text">
                  {heroProducts[heroIndex]?.name}
                </Link>
              </div>
              <div className="home-hero__counter">
                <span>{heroIndex + 1}/{heroProducts.length}</span>
              </div>
              <div className="home-hero__nav">
                <button className="home-hero__nav-btn" onClick={() => goToHeroSlide((heroIndex - 1 + heroProducts.length) % heroProducts.length)} aria-label="Previous slide">&larr;</button>
                <button className="home-hero__nav-btn" onClick={() => goToHeroSlide((heroIndex + 1) % heroProducts.length)} aria-label="Next slide">&rarr;</button>
              </div>
            </>
          ) : (
            <>
              <img src={siteImages['home-hero'] || '/brand/home/raw-material-library.jpg'} alt="Solivagant artisan perfumery atelier" className="home-hero__slide-image home-hero__slide--active" />
              <div className="home-hero__overlay">
                <span className="home-hero__product-name">SOLIVAGANT</span>
              </div>
            </>
          )}
        </section>

        {/* ── 2. Brand Mark + Tagline ── */}
        <section className="home-brandmark" data-reveal>
          <div className="home-brandmark__inner">
            <span className="home-brandmark__logo">SOLIVAGANT</span>
            <h2 className="home-brandmark__tagline">Artisan perfumery crafted from memory, material, and personal ritual.</h2>
            <Link to="/catalog" className="home-brandmark__cta">
              Explore the Collection <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── 3. Horizontal Scroll Carousel — "Current Collection" ── */}
        <section className="home-section home-section--flush" data-reveal>
          <div className="home-carousel__header">
            <div>
              <p className="editorial-eyebrow">CURRENT COLLECTION</p>
              <h2>Selected fragrances</h2>
            </div>
            <Link to="/catalog" className="home-carousel__see-all">See the Collection <ArrowRight className="h-4 w-4" /></Link>
          </div>
          {collectionProducts.length ? (
            <div className="home-carousel__wrapper">
              <button className="home-carousel__arrow home-carousel__arrow--left" onClick={() => scrollCarousel('left')} aria-label="Scroll left">&larr;</button>
              <div className="home-carousel__track" ref={carouselRef}>
                {collectionProducts.map((product, index) => (
                  <Link key={product.slug || product.id} to={`/catalog/${product.slug}`} className="home-carousel__card card-lift img-hover-zoom">
                    <ProductVisual
                      product={product}
                      className="home-carousel__card-visual"
                      imageFit="cover"
                      priority={index < 3}
                    />
                    <div className="home-carousel__card-info">
                      <h3>{product.name}</h3>
                      <span className="home-carousel__card-perfumer">by Dekito</span>
                    </div>
                  </Link>
                ))}
              </div>
              <button className="home-carousel__arrow home-carousel__arrow--right" onClick={() => scrollCarousel('right')} aria-label="Scroll right">&rarr;</button>
            </div>
          ) : (
            <div className="editorial-empty-state editorial-empty-state--inline">
              <p>Belum ada produk published. Publish produk dari Studio Products.</p>
            </div>
          )}
        </section>

        {/* ── 4. Full-bleed Editorial Statement ── */}
        <section className="home-statement" data-reveal="scale">
          <img src={siteImages['home-statement'] || '/brand/home/perfumer-pipettes.jpg'} alt="Perfumer at work in the Solivagant atelier" className="home-statement__image" />
          <div className="home-statement__overlay">
            <h2>Feeling Over Formula.</h2>
            <p>We don't chase trends or mass appeal. Every SOLIVAGANT fragrance is an atmosphere — composed from obsession, intuition, and the raw conviction that perfume should change how you carry yourself through a room.</p>
            <Link to="/bespoke" className="home-statement__cta">
              Book a Bespoke Consultation <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── 5. Tabbed "Explore by Mood" ── */}
        <section className="home-section" data-reveal>
          <div className="home-section__head">
            <p className="editorial-eyebrow">EXPLORE BY MOOD</p>
            <h2>Find your scent direction</h2>
          </div>
          <div className="home-moods">
            <div className="home-moods__tabs">
              {moodCategories.map((mood, i) => (
                <button
                  key={mood.name}
                  className={`home-moods__tab ${i === activeMood ? 'home-moods__tab--active' : ''}`}
                  onClick={() => setActiveMood(i)}
                  onMouseEnter={() => setActiveMood(i)}
                >
                  <span className="home-moods__tab-name">{mood.name}</span>
                  <ArrowRight className="home-moods__tab-arrow h-4 w-4" />
                </button>
              ))}
            </div>
            <div className="home-moods__panel">
              <div className="home-moods__panel-visual" data-family={moodCategories[activeMood].family.toLowerCase()}>
                <span className="home-moods__panel-family">{moodCategories[activeMood].family}</span>
              </div>
              <div className="home-moods__panel-body">
                <h3>{moodCategories[activeMood].name}</h3>
                <p>{moodCategories[activeMood].description}</p>
                <Link to={`/catalog?family=${moodCategories[activeMood].family.toLowerCase()}`} className="home-moods__panel-link">
                  Shop {moodCategories[activeMood].name} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. Journal Section ── */}
        {publishedArticles.length ? (
          <section className="home-section" data-reveal>
            <div className="home-section__head">
              <p className="editorial-eyebrow">JOURNAL</p>
              <h2>Field notes from the atelier</h2>
            </div>
            <div className="home-journal-grid" data-reveal data-stagger-children>
              {publishedArticles.map((article) => (
                <Link key={article.id} to={getJournalPublicPath(article)} className="home-journal-card">
                  <span className="home-journal-card__category">{getJournalCategoryLabel(article.category)}</span>
                  <h3>{article.title}</h3>
                  <p>{getArticleExcerpt(article)}</p>
                  <span className="home-journal-card__read-more">Read More <ArrowRight className="h-3 w-3" /></span>
                </Link>
              ))}
            </div>
            <div className="home-section__action">
              <Link to="/journal">Read the journal <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </section>
        ) : null}

        {/* ── 7. Newsletter Section ── */}
        <section className="home-newsletter" data-reveal>
          <img src={siteImages['home-newsletter'] || '/brand/home/raw-material-library.jpg'} alt="Solivagant atelier" className="home-newsletter__bg" />
          <div className="home-newsletter__inner">
            <p className="editorial-eyebrow">STAY CLOSE</p>
            <h2>Notes from the atelier, delivered quietly.</h2>
            <p className="home-newsletter__sub">New compositions, journal entries, and invitations to bespoke sessions — no noise, only signal.</p>
            <form className="home-newsletter__form" onSubmit={(e) => { e.preventDefault(); setNewsletterEmail(''); }}>
              <input
                type="email"
                placeholder="Your email address"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                className="home-newsletter__input"
                required
              />
              <button type="submit" className="home-newsletter__btn">Subscribe</button>
            </form>
          </div>
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default HomePage;
