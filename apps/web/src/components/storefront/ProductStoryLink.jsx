import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getJournalPublicPath, getPublishedJournalPosts } from '@/services/journalPostsSupabaseService.js';
import { useTranslate } from '@/hooks/useTranslate.js';

/**
 * The story this perfume was written about, on the perfume's own page.
 *
 * THE LINK ALREADY EXISTED AND ONLY WENT ONE WAY. JournalRelatedProduct puts the perfume at the end of
 * the article, for the reason written in that file: "a reader finished and had nowhere to go". The
 * reverse was never built, so a buyer standing on the product page had no idea a story existed at all —
 * and the product page is where almost everyone arrives first. The journal has one article today and it
 * is about a perfume in the catalogue; nothing on that perfume's page said so.
 *
 * Same column, read the other way: journal_posts.related_product_slug.
 *
 * One component for both surfaces. Desktop and mobile drifting apart is this repo's commonest defect,
 * and a story offered on one and not the other is the kind nobody reports.
 *
 * Renders nothing when there is no story, when the fetch fails, or while it is still loading — a
 * heading with an empty space under it is worse than no heading.
 */
const ProductStoryLink = ({ product, mobile = false, className = '' }) => {
  const { t } = useTranslate();
  const [post, setPost] = useState(null);
  const slug = String(product?.slug || '').trim();

  useEffect(() => {
    let active = true;
    if (!slug) { setPost(null); return () => { active = false; }; }
    getPublishedJournalPosts()
      .then((posts) => {
        if (!active) return;
        const list = Array.isArray(posts) ? posts : [];
        // The newest, when a perfume has been written about more than once. Oldest-first would pin the
        // page to whatever was written in 2026 for ever.
        const found = list
          .filter((entry) => String(entry?.related_product_slug || '').trim() === slug)
          .sort((a, b) => String(b?.published_at || '').localeCompare(String(a?.published_at || '')))[0];
        setPost(found || null);
      })
      .catch(() => { if (active) setPost(null); });
    return () => { active = false; };
  }, [slug]);

  if (!post) return null;
  const path = getJournalPublicPath(post, { mobile });
  if (!path) return null;

  return (
    <aside className={`product-story-link flex flex-col gap-4 ${className}`.trim()}>
      <p className="ng-mono m-0 text-ng-ash">{t('pdp.storyEyebrow')}</p>
      <Link to={path} className="ng-specimen !min-h-0">
        <strong className="font-ng-display text-[30px] font-normal leading-tight">{post.title}</strong>
        {post.excerpt ? <span className="text-[15px] leading-relaxed text-ng-dust">{post.excerpt}</span> : null}
        <span className="ng-mono inline-flex items-center gap-2">
          {t('pdp.storyCta')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </Link>
    </aside>
  );
};

export default ProductStoryLink;
