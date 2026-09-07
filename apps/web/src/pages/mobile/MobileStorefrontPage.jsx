import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useSiteImages } from '@/hooks/useSiteImages.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { LineDivider, LineMark } from '@/components/line/LineArt.jsx';
import { getPublishedJournalPosts, getJournalCategoryLabel, getJournalPublicPath } from '@/services/journalPostsSupabaseService.js';

// The notes come from the desktop home page's mood list, shortened. Without them each card was a flat
// pastel square holding one italic word, which reads as unfinished rather than minimal (UX backlog U-11).
const moodCategories = [
  { name: 'Tenang & Minimal', family: 'Fresh', notes: 'Citrus · Musk · Ringan' },
  { name: 'Hangat & Nostalgia', family: 'Gourmand', notes: 'Vanila · Tonka · Hangat' },
  { name: 'Gelap & Moody', family: 'Woody', notes: 'Cedar · Vetiver · Mineral' },
  { name: 'Lembut & Romantis', family: 'Floral', notes: 'Mawar · Melati · Powdery' },
];

const getArticleExcerpt = (article) =>
  article?.excerpt || String(article?.content || '').replace(/[`*_>#-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);

export const MobileStorefrontContent = ({ active = true }) => {
  const navigate = useNavigate();
  const catalogProducts = useCatalogProducts({ active });
  const { images: siteImages } = useSiteImages();
  const [articles, setArticles] = useState([]);

  const visibleProducts = useMemo(
    () => catalogProducts.filter(isProductVisibleInStorefront),
    [catalogProducts]
  );
  const publicCatalog = useMemo(() => getPublicFragranceCatalog(visibleProducts), [visibleProducts]);
  const collection = publicCatalog.slice(0, 4);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    getPublishedJournalPosts()
      .then((posts) => { if (!cancelled) setArticles(posts.slice(0, 3)); })
      .catch(() => { if (!cancelled) setArticles([]); });
    return () => { cancelled = true; };
  }, [active]);

  return (
    <>
      {active ? (
        <Helmet>
          <title>SOLIVAGANT - Artisan Perfumery</title>
          <meta name="description" content="SOLIVAGANT, atelier parfum artisan oleh Dekito. Karya olfaktori yang tenang dari raw material, kenangan, dan ritual pribadi." />
        </Helmet>
      ) : null}

      <main className="mobile-page m-editorial-page">
        {/* Hero — fullscreen image */}
        <section className="m-editorial-hero">
          <img src={siteImages['home-hero'] || '/brand/home/raw-material-library.jpg'} alt="Atelier parfum artisan Solivagant" className="m-editorial-hero__image" loading="eager" />
          <div className="m-editorial-hero__overlay">
            <p className="m-editorial-eyebrow">ATELIER PARFUM ARTISAN</p>
            <h1>Aroma sebagai objek kenangan.</h1>
            <p className="m-editorial-hero__lede">Karya olfaktori yang tenang dari raw material, kenangan, dan ritual.</p>
            <button type="button" className="m-editorial-cta" onClick={() => navigate('/mobile/catalog')}>
              Lihat koleksi <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Collection — image-first cards */}
        {collection.length ? (
          <section className="m-editorial-section">
            <div className="m-editorial-section__head">
              <p className="m-editorial-eyebrow">KOLEKSI SAAT INI</p>
              <h2>Fragrance pilihan</h2>
            </div>
            <div className="m-editorial-product-grid">
              {collection.map((product) => (
                <Link key={product.slug} to={`/mobile/products/${product.slug}`} className="m-editorial-product-card">
                  <ProductVisual product={product} className="m-editorial-product-card__visual" imageFit="cover" label={false} sizes="(max-width: 480px) 45vw, 200px" />
                  <div className="m-editorial-product-card__info">
                    <span className="m-editorial-product-card__category">{product.category}</span>
                    <h3>{product.name}</h3>
                    <span className="m-editorial-product-card__price">{product.price}</span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="m-editorial-section__action">
              <Link to="/mobile/catalog">Lihat semua <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </section>
        ) : null}

        <LineDivider className="line-divider" draw data-reveal />

        {/* Mood categories */}
        <section className="m-editorial-section">
          <div className="m-editorial-section__head">
            <p className="m-editorial-eyebrow">JELAJAHI LEWAT MOOD</p>
            <h2>Temukan arah aromamu</h2>
          </div>
          <div className="m-editorial-mood-grid">
            {moodCategories.map((mood) => (
              <Link key={mood.name} to={`/mobile/catalog?category=${mood.family}`} className="m-editorial-mood-card">
                <div className="m-editorial-mood-card__visual" data-family={mood.family.toLowerCase()}>
                  <LineMark className="m-editorial-mood-card__mark" />
                  <span>{mood.family}</span>
                </div>
                <h3>{mood.name}</h3>
                <p className="m-editorial-mood-card__notes">{mood.notes}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Statement block */}
        <section className="m-editorial-statement">
          <img src={siteImages['home-statement'] || '/brand/home/perfumer-pipettes.jpg'} alt="Perfumer bekerja di atelier Solivagant" className="m-editorial-statement__image" loading="lazy" />
          <div className="m-editorial-statement__overlay">
            <p className="m-editorial-eyebrow">ATELIER</p>
            <h2>Aroma sebagai atmosfer pribadi.</h2>
            <button type="button" className="m-editorial-cta" onClick={() => navigate('/mobile/bespoke')}>
              Konsultasi bespoke <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Journal preview */}
        {articles.length ? (
          <section className="m-editorial-section">
            <div className="m-editorial-section__head">
              <p className="m-editorial-eyebrow">JURNAL</p>
              <h2>Catatan lapangan</h2>
            </div>
            <div className="m-editorial-journal-list">
              {articles.map((article) => (
                <Link key={article.id} to={getJournalPublicPath(article)} className="m-editorial-journal-card">
                  <span className="m-editorial-journal-card__category">{getJournalCategoryLabel(article.category)}</span>
                  <h3>{article.title}</h3>
                  <p>{getArticleExcerpt(article)}</p>
                </Link>
              ))}
            </div>
            <div className="m-editorial-section__action">
              <Link to="/mobile/articles">Baca jurnal <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
};

const MobileStorefrontPage = () => (
  <MobileCommerceLayout>
    <MobileStorefrontContent />
  </MobileCommerceLayout>
);

export default MobileStorefrontPage;
