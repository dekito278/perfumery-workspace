import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, CheckCircle2, Volume2, VolumeX, ChevronRight, Play, Pause } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { useCart } from '@/hooks/useCart.js';
import { useMicroInteractions } from '@/hooks/useParallax.js';
import {
  DEFAULT_SHARE_IMAGE,
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  getSiteOrigin,
  toAbsoluteUrl,
} from '@/utils/seo.js';
import { toast } from 'sonner';

const ImmersiveProductPage = ({ product, story }) => {
  const { addItem } = useCart();
  const { magnetic } = useMicroInteractions();
  const navigate = useNavigate();
  const [lastAddedSlug, setLastAddedSlug] = useState('');
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const pageRef = useRef(null);

  const { colors, hero, music, video, sections } = story;

  // Apply color world as CSS custom properties
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    el.style.setProperty('--imm-bg', colors.bg);
    el.style.setProperty('--imm-text', colors.text);
    el.style.setProperty('--imm-accent', colors.accent);
    el.style.setProperty('--imm-muted', colors.muted);
    el.style.setProperty('--imm-border', colors.border);
  }, [colors]);

  // Scroll-driven reveal
  useEffect(() => {
    const els = pageRef.current?.querySelectorAll('[data-imm-reveal]');
    if (!els?.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('imm-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const toggleMusic = useCallback(() => {
    if (!audioRef.current) return;
    if (musicPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setMusicPlaying((p) => !p);
  }, [musicPlaying]);

  const toggleVideo = useCallback(() => {
    if (!videoRef.current) return;
    if (videoPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
    setVideoPlaying((p) => !p);
  }, [videoPlaying]);

  const soldOut = product.publicStatus !== 'Available';

  const handleAddToCart = () => {
    if (soldOut) {
      toast.error(`${product.name} sedang habis`);
      return;
    }
    addItem(product, 1);
    setLastAddedSlug(product.slug);
    toast.success(`${product.name} masuk ke keranjang`, {
      description: 'Keranjang sudah diperbarui.',
      action: { label: 'Lihat cart', onClick: () => navigate('/cart') },
    });
    setTimeout(() => {
      setLastAddedSlug((c) => (c === product.slug ? '' : c));
    }, 1800);
  };

  const siteOrigin = getSiteOrigin();
  const canonicalUrl = toAbsoluteUrl(`/catalog/${product.slug}`, siteOrigin);
  const shareImage = toAbsoluteUrl(product.imageUrl || product.images?.[0] || DEFAULT_SHARE_IMAGE, siteOrigin);
  const metaDescription = String(hero.subtitle || product.subtitle || product.story || '').trim().slice(0, 155);
  const productJsonLd = buildProductJsonLd(product, { origin: siteOrigin, canonicalUrl });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Beranda', path: '/home' },
    { name: 'Koleksi', path: '/catalog' },
    { name: product.name, path: `/catalog/${product.slug}` },
  ], siteOrigin);

  return (
    <>
      <Helmet>
        <title>{product.name} — SOLIVAGANT</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:site_name" content="SOLIVAGANT" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={`${product.name} — SOLIVAGANT`} />
        <meta property="og:description" content={metaDescription} />
        {shareImage ? <meta property="og:image" content={shareImage} /> : null}
        {shareImage ? <meta property="og:image:alt" content={product.name} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${product.name} — SOLIVAGANT`} />
        <meta name="twitter:description" content={metaDescription} />
        {shareImage ? <meta name="twitter:image" content={shareImage} /> : null}
        {product.priceNumber > 0 ? <meta property="product:price:amount" content={String(product.priceNumber)} /> : null}
        {product.priceNumber > 0 ? <meta property="product:price:currency" content="IDR" /> : null}
        {productJsonLd ? <script type="application/ld+json">{JSON.stringify(productJsonLd)}</script> : null}
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <div className="immersive-page" ref={pageRef}>
        <ScrollProgress />
        <PublicHeader />

        {/* ── Hero ── */}
        <section className="imm-hero">
          <div className="imm-hero__visual">
            <ProductVisual product={product} className="imm-hero__image" imageFit="cover" priority label={false} />
            <div className="imm-hero__overlay" />
          </div>
          <div className="imm-hero__content">
            <span className="imm-hero__eyebrow">{hero.eyebrow}</span>
            {hero.headlineScript ? (
              <p className="imm-hero__script">{hero.headlineScript}</p>
            ) : null}
            <h1 className="imm-hero__title">{hero.headline}</h1>
            <p className="imm-hero__subtitle">{hero.subtitle}</p>
          </div>

          {/* Music toggle */}
          {music.src ? (
            <button type="button" className="imm-music-toggle" onClick={toggleMusic} aria-label={musicPlaying ? 'Matikan musik' : 'Putar musik'}>
              {musicPlaying ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <span>{music.label}</span>
            </button>
          ) : null}
        </section>

        {/* ── Audio element ── */}
        {music.src ? (
          <audio ref={audioRef} src={music.src} loop preload="none" />
        ) : null}

        {/* ── Story sections ── */}
        <div className="imm-story">
          {sections.map((section, i) => {
            if (section.type === 'quote') {
              return (
                <section key={i} className="imm-section imm-quote" data-imm-reveal>
                  <blockquote>
                    {section.text.split('\n').map((line, j) => (
                      <React.Fragment key={j}>
                        {line}
                        {j < section.text.split('\n').length - 1 ? <br /> : null}
                      </React.Fragment>
                    ))}
                  </blockquote>
                </section>
              );
            }

            if (section.type === 'text-image') {
              return (
                <section key={i} className={`imm-section imm-text-image imm-text-image--${section.layout}`} data-imm-reveal>
                  <div className="imm-text-image__text">
                    <span className="imm-eyebrow">{section.eyebrow}</span>
                    <h2>{section.heading}</h2>
                    <p>{section.body}</p>
                  </div>
                  <div className="imm-text-image__visual">
                    {section.image ? (
                      <img src={section.image} alt={section.heading} loading="lazy" />
                    ) : (
                      <div className="imm-placeholder-visual" />
                    )}
                  </div>
                </section>
              );
            }

            if (section.type === 'full-bleed') {
              return (
                <section key={i} className="imm-section imm-full-bleed" data-imm-reveal>
                  {section.image ? (
                    <img src={section.image} alt={section.caption || ''} loading="lazy" />
                  ) : (
                    <div className="imm-placeholder-visual imm-placeholder-visual--wide" />
                  )}
                  {section.caption ? <p className="imm-full-bleed__caption">{section.caption}</p> : null}
                </section>
              );
            }

            return null;
          })}
        </div>

        {/* ── Floating video ── */}
        {video.src ? (
          <div className="imm-floating-video">
            <video
              ref={videoRef}
              src={video.src}
              poster={video.poster || undefined}
              loop
              muted
              playsInline
              preload="none"
            />
            <button type="button" className="imm-floating-video__toggle" onClick={toggleVideo} aria-label={videoPlaying ? 'Pause video' : 'Play video'}>
              {videoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          </div>
        ) : null}

        {/* ── Product detail (compact) ── */}
        <section className="imm-product" data-imm-reveal>
          <div className="imm-product__notes">
            <div className="imm-product__note-row">
              <span className="imm-product__note-label">Top</span>
              <span className="imm-product__note-values">{(product.topNotes || []).join(', ')}</span>
            </div>
            <div className="imm-product__note-row">
              <span className="imm-product__note-label">Heart</span>
              <span className="imm-product__note-values">{(product.heartNotes || []).join(', ')}</span>
            </div>
            <div className="imm-product__note-row">
              <span className="imm-product__note-label">Base</span>
              <span className="imm-product__note-values">{(product.baseNotes || []).join(', ')}</span>
            </div>
          </div>

          <div className="imm-product__meta">
            <span>{product.concentration}</span>
            <span>{(product.sizeVariants || []).map((v) => v.size).join(' / ')}</span>
            <span>{product.price}</span>
          </div>

          <button type="button" className="imm-product__cta magnetic-hover" onClick={handleAddToCart} onMouseMove={magnetic} disabled={soldOut}>
            {soldOut ? (
              <>Stok Habis</>
            ) : lastAddedSlug === product.slug ? (
              <><CheckCircle2 className="h-4 w-4" /> Sudah di Keranjang</>
            ) : (
              <><ShoppingBag className="h-4 w-4" /> Tambah ke Keranjang &mdash; {product.price}</>
            )}
          </button>
        </section>

        {/* ── Back to catalog ── */}
        <nav className="imm-back" data-imm-reveal>
          <Link to="/catalog">
            <ChevronRight className="h-3 w-3" style={{ transform: 'rotate(180deg)' }} />
            Kembali ke Koleksi
          </Link>
        </nav>

        <StorefrontFooter />
      </div>
    </>
  );
};

export default ImmersiveProductPage;
