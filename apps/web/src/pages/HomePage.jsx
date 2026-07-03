import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { featuredProducts } from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { useSiteImages } from '@/hooks/useSiteImages.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import { getPublishedJournalPosts, getJournalCategoryLabel, getJournalPublicPath } from '@/services/journalPostsSupabaseService.js';

const moodCategories = [
  // `family` is the display label; `filter` is the real catalog category used in the link
  // (the catalog has no "Fresh" category — those scents live under "Aquatic").
  { name: 'Tenang & Minimal', family: 'Fresh', filter: 'aquatic', description: 'Citrus bersih, musk lembut, dan tekstur ringan untuk pemakaian harian.', siteImageKey: 'mood-fresh' },
  { name: 'Hangat & Nostalgia', family: 'Gourmand', filter: 'gourmand', description: 'Vanila, tonka, dan kehangatan panggang — kenyamanan yang disuling jadi aroma.', siteImageKey: 'mood-gourmand' },
  { name: 'Gelap & Moody', family: 'Woody', filter: 'woody', description: 'Cedar, vetiver, dan kedalaman mineral untuk kehadiran yang tegas.', siteImageKey: 'mood-woody' },
  { name: 'Lembut & Romantis', family: 'Floral', filter: 'floral', description: 'Mawar, melati, dan musk powdery — lembut tanpa terlalu manis.', siteImageKey: 'mood-floral' },
];

const getArticleExcerpt = (article) =>
  article?.excerpt || String(article?.content || '').replace(/[`*_>#-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);

const HomePage = () => {
  const fetchedProducts = useCatalogProducts();
  const catalogProducts = fetchedProducts.length ? fetchedProducts : featuredProducts;
  const { images: siteImages } = useSiteImages();
  const [publishedArticles, setPublishedArticles] = useState([]);
  const [activeMood, setActiveMood] = useState(0);
  const revealRef = useScrollReveal();
  const carouselRef = useRef(null);

  const visibleProducts = useMemo(
    () => catalogProducts.filter(isProductVisibleInStorefront),
    [catalogProducts]
  );
  const publicCatalog = useMemo(() => getPublicFragranceCatalog(visibleProducts), [visibleProducts]);
  const collectionProducts = publicCatalog.slice(0, 8);

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
        <meta name="description" content="SOLIVAGANT adalah atelier parfum artisan oleh Dekito — merakit karya olfaktori yang tenang dari raw material, kenangan, dan ritual pribadi." />
        <meta property="og:title" content="SOLIVAGANT - Artisan Perfumery Atelier" />
        <meta property="og:description" content="Rumah parfum editorial oleh perfumer Dekito." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/brand/home/raw-material-library.jpg" />
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <PublicHeader />

        {/* ── 1. Hero Slideshow ── */}
        <section className="home-hero">
          <img src={siteImages['home-hero'] || '/brand/home/raw-material-library.jpg'} alt="Atelier parfum artisan Solivagant" className="home-hero__slide-image home-hero__slide--active" style={{ objectFit: 'cover' }} />
          <div className="home-hero__overlay home-hero__overlay--editorial">
            <p className="home-hero__eyebrow">ATELIER PARFUM ARTISAN</p>
            <h1 className="home-hero__title">Aroma sebagai<br />objek kenangan.</h1>
            <p className="home-hero__subtitle">Karya olfaktori yang tenang dari raw material, kenangan, dan ritual.</p>
            <Link to="/catalog" className="home-hero__cta">
              LIHAT KOLEKSI <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── 2. Brand Mark + Tagline ── */}
        <section className="home-brandmark" data-reveal>
          <div className="home-brandmark__inner">
            <span className="home-brandmark__logo">SOLIVAGANT</span>
            <h2 className="home-brandmark__tagline">Parfum artisan yang dirakit dari kenangan, material, dan ritual pribadi.</h2>
            <Link to="/catalog" className="home-brandmark__cta">
              Lihat Koleksi <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── 3. Horizontal Scroll Carousel — "Current Collection" ── */}
        <section className="home-section home-section--flush" data-reveal>
          <div className="home-carousel__header">
            <div>
              <p className="editorial-eyebrow">KOLEKSI SAAT INI</p>
              <h2>Fragrance pilihan</h2>
            </div>
            <Link to="/catalog" className="home-carousel__see-all">Lihat Koleksi <ArrowRight className="h-4 w-4" /></Link>
          </div>
          {collectionProducts.length ? (
            <div className="home-carousel__wrapper">
              <button className="home-carousel__arrow home-carousel__arrow--left" onClick={() => scrollCarousel('left')} aria-label="Geser kiri">&larr;</button>
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
                      <div className="home-carousel__card-meta">
                        <span className="home-carousel__card-perfumer">oleh Dekito</span>
                        {(product.price || product.priceNumber) ? (
                          <span className="home-carousel__card-price">{product.price || `Rp ${(product.priceNumber || 0).toLocaleString('id-ID')}`}</span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <button className="home-carousel__arrow home-carousel__arrow--right" onClick={() => scrollCarousel('right')} aria-label="Geser kanan">&rarr;</button>
            </div>
          ) : (
            <div className="editorial-empty-state editorial-empty-state--inline">
              <p>Koleksi baru sedang disiapkan. Nantikan rilis fragrance berikutnya.</p>
            </div>
          )}
        </section>

        {/* ── 4. Full-bleed Editorial Statement ── */}
        <section className="home-statement" data-reveal="scale">
          <img src={siteImages['home-statement'] || '/brand/home/perfumer-pipettes.jpg'} alt="Perfumer bekerja di atelier Solivagant" className="home-statement__image" />
          <div className="home-statement__overlay">
            <h2>Rasa di Atas Formula.</h2>
            <p>Kami tidak mengejar tren atau selera pasar. Setiap fragrance SOLIVAGANT adalah sebuah atmosfer — dirakit dari obsesi, intuisi, dan keyakinan bahwa parfum seharusnya mengubah cara kamu membawa diri di sebuah ruangan.</p>
            <Link to="/bespoke" className="home-statement__cta">
              Konsultasi Bespoke <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── 5. Tabbed "Explore by Mood" ── */}
        <section className="home-section" data-reveal>
          <div className="home-section__head">
            <p className="editorial-eyebrow">JELAJAHI BERDASARKAN MOOD</p>
            <h2>Temukan arah aromamu</h2>
          </div>
          <div className="home-moods">
            <div className="home-moods__tabs">
              {moodCategories.map((mood, i) => (
                <button
                  key={mood.name}
                  className={`home-moods__tab ${i === activeMood ? 'home-moods__tab--active' : ''}`}
                  onClick={() => setActiveMood(i)}
                >
                  <span className="home-moods__tab-name">{mood.name}</span>
                  <ArrowRight className="home-moods__tab-arrow h-4 w-4" />
                </button>
              ))}
            </div>
            <div className="home-moods__panel">
              <div className="home-moods__panel-visual" data-family={moodCategories[activeMood].family.toLowerCase()}>
                {siteImages[moodCategories[activeMood].siteImageKey] ? (
                  <img src={siteImages[moodCategories[activeMood].siteImageKey]} alt={moodCategories[activeMood].name} className="home-moods__panel-image" />
                ) : null}
                <span className="home-moods__panel-family">{moodCategories[activeMood].family}</span>
              </div>
              <div className="home-moods__panel-body">
                <h3>{moodCategories[activeMood].name}</h3>
                <p>{moodCategories[activeMood].description}</p>
                <Link to={`/catalog?family=${moodCategories[activeMood].filter}`} className="home-moods__panel-link">
                  Belanja {moodCategories[activeMood].name} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. Journal Section ── */}
        {publishedArticles.length ? (
          <section className="home-section" data-reveal>
            <div className="home-section__head">
              <p className="editorial-eyebrow">JURNAL</p>
              <h2>Catatan dari atelier</h2>
            </div>
            <div className="home-journal-grid" data-reveal data-stagger-children>
              {publishedArticles.map((article) => (
                <Link key={article.id} to={getJournalPublicPath(article)} className="home-journal-card">
                  <span className="home-journal-card__category">{getJournalCategoryLabel(article.category)}</span>
                  <h3>{article.title}</h3>
                  <p>{getArticleExcerpt(article)}</p>
                  <span className="home-journal-card__read-more">Baca Selengkapnya <ArrowRight className="h-3 w-3" /></span>
                </Link>
              ))}
            </div>
            <div className="home-section__action">
              <Link to="/journal">Baca jurnal <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </section>
        ) : null}

        {/* ── 7. Newsletter Section ── */}
        <section className="home-newsletter" data-reveal>
          <img src={siteImages['home-newsletter'] || '/brand/home/raw-material-library.jpg'} alt="Atelier Solivagant" className="home-newsletter__bg" />
          <div className="home-newsletter__inner">
            <p className="editorial-eyebrow">KOLABORASI</p>
            <h2>Mari berkolaborasi dengan atelier.</h2>
            <p className="home-newsletter__sub">Untuk kolaborasi, bespoke khusus, atau sekadar berbagi ide — hubungi Dekito langsung lewat WhatsApp.</p>
            <a
              href="https://wa.me/6287774026625?text=Halo%20Dekito%2C%20saya%20tertarik%20berkolaborasi%20dengan%20SOLIVAGANT."
              target="_blank"
              rel="noopener noreferrer"
              className="home-newsletter__wa"
            >
              <MessageCircle className="h-4 w-4" /> Hubungi WhatsApp Dekito
            </a>
          </div>
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default HomePage;
