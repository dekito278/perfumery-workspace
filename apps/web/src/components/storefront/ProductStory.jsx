import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate.js';
import { getOptimizedStorageImageUrl, getStorageImageSrcSet } from '@/utils/storageImage.js';

const STORY_WIDTHS = [480, 768, 1080, 1600];

/**
 * A product's story — hero, letter, verses, music, video — told INSIDE the ordinary product page,
 * between the buy block and the pyramid.
 *
 * It used to be a page of its own that replaced the product page whenever a story existed, with its
 * own header, its own price, its own cart button and a compact note list at the very end. So the one
 * perfume with a story (Ayang-ayang) was shaped like no other bottle in the shop: no photos or price at
 * the top, the cart about 3,500px down, and no stock line, gift vial, "when to wear", buyer answers or
 * "you may also like". Dekito noticed it, 2026-11-08 ("ayang2 bentukannya beda"), and chose this: the
 * same frame as every product, the story whole in the middle, in its own colours.
 *
 * Everything a buyer acts on — price, cart, export quote, share — belongs to the product page, once.
 * This component renders words and media only.
 */
const ProductStory = ({ product, story }) => {
  const { t, isInternational } = useTranslate();
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const storyRef = useRef(null);

  const { colors, hero, music, video } = story;

  // The stories were written with every image slot empty (image: null), so the page drew four blank
  // frames between the paragraphs. The slots take the product's own gallery photos, in order, after the
  // cover the gallery opens on; a slot left without one is not drawn at all (2026-11-07).
  const sections = useMemo(() => {
    const heroImage = String(product.imageUrl || product.images?.[0] || '').trim();
    const photos = [...new Set([...(product.images || []), product.imageUrl].map((url) => String(url || '').trim()).filter(Boolean))]
      .filter((url) => url !== heroImage);
    let next = 0;
    return (story.sections || []).map((section) => (
      ['text-image', 'full-bleed'].includes(section.type) && !section.image ? { ...section, image: photos[next++] || null } : section
    ));
  }, [story.sections, product.images, product.imageUrl]);

  // The story's colour world, scoped to the story — the page around it keeps the shop's own.
  useEffect(() => {
    const el = storyRef.current;
    if (!el) return;
    el.style.setProperty('--imm-bg', colors.bg);
    el.style.setProperty('--imm-text', colors.text);
    el.style.setProperty('--imm-accent', colors.accent);
    el.style.setProperty('--imm-muted', colors.muted);
    el.style.setProperty('--imm-border', colors.border);
  }, [colors]);

  // Scroll-driven reveal
  useEffect(() => {
    const els = storyRef.current?.querySelectorAll('[data-imm-reveal]');
    if (!els?.length) return undefined;
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
  }, [sections]);

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

  return (
    <div className="immersive-page" ref={storyRef}>
      {/* ── Hero ── */}
      {/* Words only: the photo this opening used to sit on is the gallery's cover, one scroll up. */}
      <section className="imm-hero" lang={isInternational ? 'id' : undefined}>
        <div className="imm-hero__content">
          <span className="imm-hero__eyebrow">{hero.eyebrow}</span>
          {hero.headlineScript ? (
            <p className="imm-hero__script">{hero.headlineScript}</p>
          ) : null}
          {/* h2, not h1: the page's h1 is the perfume's name, in the product block above. */}
          <h2 className="imm-hero__title">{hero.headline}</h2>
          <p className="imm-hero__subtitle">{hero.subtitle}</p>
          {/* The story is Dekito's own words and stays in Indonesian, as the journal does. Said, the way the
              journal says it, so an English reader is not left wondering why the page changed language
              (visitor audit, 13 Nov 2026: six perfumes). */}
          {isInternational ? <p lang="en" className="imm-hero__subtitle">{t('imm.storyIndonesian')}</p> : null}
        </div>

        {music.src ? (
          <button type="button" className="imm-music-toggle" onClick={toggleMusic} aria-label={t(musicPlaying ? 'imm.musicOff' : 'imm.musicOn')}>
            {musicPlaying ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span>{music.label}</span>
          </button>
        ) : null}
      </section>

      {music.src ? (
        <audio ref={audioRef} src={music.src} loop preload="none" />
      ) : null}

      {/* ── Story sections ── */}
      <div className="imm-story" lang={isInternational ? 'id' : undefined}>
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
              <section key={i} className={`imm-section imm-text-image ${section.image ? `imm-text-image--${section.layout}` : 'imm-text-image--text-only'}`} data-imm-reveal>
                <div className="imm-text-image__text">
                  <span className="imm-eyebrow">{section.eyebrow}</span>
                  <h3>{section.heading}</h3>
                  <p>{section.body}</p>
                </div>
                {section.image ? (
                  <div className="imm-text-image__visual">
                    {/* Through the resize endpoint, like every other product photo: the story sent its
                        originals, 1.8 MB on a phone for Ayang-ayang (seventh visitor audit, 13 Nov 2026). */}
                    <img
                      src={getOptimizedStorageImageUrl(section.image, 1080)}
                      srcSet={getStorageImageSrcSet(section.image, STORY_WIDTHS)}
                      sizes="(max-width: 767px) 100vw, 50vw"
                      alt={section.heading}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : null}
              </section>
            );
          }

          if (section.type === 'full-bleed') {
            if (!section.image) return null;
            return (
              <section key={i} className="imm-section imm-full-bleed" data-imm-reveal>
                <img
                  src={getOptimizedStorageImageUrl(section.image, 1600)}
                  srcSet={getStorageImageSrcSet(section.image, STORY_WIDTHS)}
                  sizes="100vw"
                  alt={section.caption || ''}
                  loading="lazy"
                  decoding="async"
                />
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
          <button type="button" className="imm-floating-video__toggle" onClick={toggleVideo} aria-label={t(videoPlaying ? 'imm.videoPause' : 'imm.videoPlay')}>
            {videoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default ProductStory;
