import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { useStorefrontProducts } from '@/hooks/useStorefrontProducts.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { getProductStorefrontPath } from '@/services/productCatalogService.js';

/**
 * The perfume an article is about, at the end of the article.
 *
 * "Kisah Jason Vorhees" tells the story of a perfume that is in the catalogue, and the page it was told
 * on had no link to it at all — a reader finished and had nowhere to go. related_formula_id already
 * existed and was already filled in, but it points at a formula in Studio and cannot reach the shop:
 * storefront_products carries no formula column. related_product_slug is the column that can.
 *
 * One component for both surfaces. Desktop and mobile drifting apart is this repo's commonest defect,
 * and an article that offers the perfume on one and not the other is the kind that nobody reports.
 *
 * Renders nothing when there is no product, when the slug no longer matches anything, or while the
 * catalogue is still loading — a broken link under a story is worse than no link, and a product can be
 * unpublished or renamed long after the article was written.
 */
const JournalRelatedProduct = ({ post, mobile = false, className = '' }) => {
  const { t } = useTranslate();
  const products = useStorefrontProducts();
  const slug = String(post?.related_product_slug || '').trim();

  if (!slug) return null;
  const product = products.find((item) => item.slug === slug);
  if (!product) return null;

  const path = getProductStorefrontPath(product, { mobile });
  if (!path) return null;

  return (
    <aside className={`journal-related-product ${className}`.trim()}>
      <p className="editorial-eyebrow">{t('journal.relatedProductEyebrow')}</p>
      <Link to={path} className="journal-related-product__card">
        <ProductVisual product={product} className="journal-related-product__visual" label={false} sizes="96px" />
        <span className="journal-related-product__text">
          <strong className="journal-related-product__name">{product.name}</strong>
          {product.price ? <span className="journal-related-product__price">{product.price}</span> : null}
          <span className="journal-related-product__cta">
            {t('journal.relatedProductCta')} <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </span>
      </Link>
    </aside>
  );
};

export default JournalRelatedProduct;
