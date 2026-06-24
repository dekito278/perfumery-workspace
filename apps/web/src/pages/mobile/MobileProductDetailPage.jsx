import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import ProductGallery from '@/components/storefront/ProductGallery.jsx';
import { useMobileBackNavigation } from '@/hooks/useMobileBackNavigation.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useCart } from '@/hooks/useCart.js';
import { getPublicFragranceCatalog } from '@/data/publicStorefront.js';
import { formatRupiah, isProductVisibleInStorefront } from '@/services/productCatalogService.js';

const MobileProductDetailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = useMobileBackNavigation('/mobile/catalog');
  const { slug } = useParams();
  const allProducts = useCatalogProducts();
  const visibleProducts = useMemo(() => allProducts.filter(isProductVisibleInStorefront), [allProducts]);
  const catalog = useMemo(() => getPublicFragranceCatalog(visibleProducts), [visibleProducts]);
  const previewProduct = location.state?.previewMode && location.state?.previewProduct?.slug === slug
    ? location.state.previewProduct
    : null;
  const product = previewProduct || catalog.find((p) => p.slug === slug);
  const previewMode = Boolean(previewProduct);
  const previewBackTo = location.state?.previewBackTo || '/mobile/studio/products?view=new';
  const { addItem } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [cartPromptOpen, setCartPromptOpen] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState(null);

  const selectedVariant = useMemo(() => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    return variants.find((v) => (v.id || v.size) === selectedVariantId) || variants[0] || null;
  }, [product, selectedVariantId]);

  if (!product && allProducts.loading) {
    return (
      <MobileCommerceLayout>
        <main className="mobile-page m-editorial-page">
          <div className="m-editorial-pdp-skeleton" />
        </main>
      </MobileCommerceLayout>
    );
  }

  if (!product) {
    return (
      <MobileCommerceLayout>
        <Helmet><title>Not found - SOLIVAGANT</title></Helmet>
        <main className="mobile-page m-editorial-page">
          <div className="m-editorial-empty">
            <p className="m-editorial-eyebrow">NOT FOUND</p>
            <h2>This fragrance doesn't exist.</h2>
            <button type="button" className="m-editorial-cta" onClick={() => navigate('/mobile/catalog')}>
              Back to Collection <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </main>
      </MobileCommerceLayout>
    );
  }

  const selectedPrice = Number(selectedVariant?.priceNumber || product.priceNumber || 0);
  const selectedStock = Number(selectedVariant?.stock ?? product.stock ?? 0);
  const selectedSize = selectedVariant?.size || product.size;
  const selectedVariantKey = selectedVariant?.id || selectedVariant?.size || '';
  const soldOut = selectedStock <= 0;

  const addSelectedVariant = () => {
    if (previewMode) { toast.error('Preview — cart disabled'); return; }
    if (soldOut) { toast.error('Out of stock'); return; }
    addItem({
      ...product,
      cartSlug: `${product.slug}-${selectedVariant?.id || selectedSize}`,
      variantId: selectedVariant?.id || '',
      size: selectedSize,
      price: formatRupiah(selectedPrice),
      priceNumber: selectedPrice,
      maxStock: selectedStock,
    }, 1);
    setLastAddedItem({ name: product.name, size: selectedSize, price: formatRupiah(selectedPrice) });
    toast.success(`${product.name} added to cart`);
    setCartPromptOpen(true);
  };

  // Related products
  const related = catalog.filter((p) => p.slug !== product.slug).slice(0, 4);

  return (
    <MobileCommerceLayout>
      <Helmet>
        <title>{product.name} - SOLIVAGANT</title>
        <meta name="description" content={`${product.name}: ${product.story || product.description}`} />
      </Helmet>

      <main className="mobile-page m-editorial-page m-editorial-pdp">
        {/* Back button */}
        <nav className="m-editorial-pdp__nav">
          <button type="button" onClick={previewMode ? () => navigate(previewBackTo) : handleBack} className="m-editorial-pdp__back">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        </nav>

        {/* Product image gallery with swipe + zoom */}
        <ProductGallery product={product} className="m-editorial-pdp__gallery" visualClassName="m-editorial-pdp__image" compact priority />

        {/* Product info */}
        <div className="m-editorial-pdp__info">
          <p className="m-editorial-eyebrow">{product.category}</p>
          <h1>{product.name}</h1>
          <p className="m-editorial-pdp__price">{product.price}</p>

          {previewMode ? (
            <div className="m-editorial-pdp__preview-badge">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Admin preview — cart disabled</span>
            </div>
          ) : null}

          <p className="m-editorial-pdp__story">{product.story || product.description}</p>

          {/* Notes */}
          <div className="m-editorial-pdp__notes">
            <div className="m-editorial-pdp__notes-row">
              <span className="m-editorial-pdp__notes-label">Top</span>
              <span className="m-editorial-pdp__notes-values">{product.topNotes?.join(', ')}</span>
            </div>
            <div className="m-editorial-pdp__notes-row">
              <span className="m-editorial-pdp__notes-label">Heart</span>
              <span className="m-editorial-pdp__notes-values">{product.heartNotes?.join(', ')}</span>
            </div>
            <div className="m-editorial-pdp__notes-row">
              <span className="m-editorial-pdp__notes-label">Base</span>
              <span className="m-editorial-pdp__notes-values">{product.baseNotes?.join(', ')}</span>
            </div>
          </div>

          {/* Variant selector */}
          {product.variants?.length > 1 ? (
            <div className="m-editorial-pdp__variants">
              <label className="m-editorial-eyebrow" htmlFor="m-variant-select">SIZE</label>
              <select
                id="m-variant-select"
                value={selectedVariantKey}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                className="m-editorial-pdp__variant-select"
              >
                {product.variants.map((v) => {
                  const key = v.id || v.size;
                  const stock = Number(v.stock || 0);
                  return <option key={key} value={key}>{v.size} — {formatRupiah(v.priceNumber)}{stock <= 0 ? ' (Sold out)' : ''}</option>;
                })}
              </select>
            </div>
          ) : null}

          {/* Meta */}
          <div className="m-editorial-pdp__meta">
            {product.mood ? <span>{product.mood}</span> : null}
            {product.concentration ? <span>{product.concentration}</span> : null}
            {product.sizeVariants?.length ? <span>{product.sizeVariants.map((v) => v.size).join(' / ')}</span> : null}
          </div>
        </div>

        {/* Related */}
        {related.length ? (
          <section className="m-editorial-section m-editorial-pdp__related">
            <div className="m-editorial-section__head">
              <p className="m-editorial-eyebrow">YOU MAY ALSO LIKE</p>
            </div>
            <div className="m-editorial-product-grid">
              {related.map((item) => (
                <Link key={item.slug} to={`/mobile/products/${item.slug}`} className="m-editorial-product-card">
                  <ProductVisual product={item} className="m-editorial-product-card__visual" imageFit="cover" label={false} sizes="(max-width: 480px) 45vw, 200px" />
                  <div className="m-editorial-product-card__info">
                    <span className="m-editorial-product-card__category">{item.category}</span>
                    <h3>{item.name}</h3>
                    <span className="m-editorial-product-card__price">{item.price}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* Sticky add-to-cart bar */}
        <StickyBottomActionBar
          fixed
          reserveSpace
          aria-label="Product action"
          className="m-editorial-pdp__sticky-bar"
          contentClassName="m-editorial-pdp__sticky-content"
        >
          <div className="m-editorial-pdp__sticky-inner">
            <div className="m-editorial-pdp__sticky-info">
              <span className="m-editorial-pdp__sticky-name">{product.name}</span>
              <span className="m-editorial-pdp__sticky-price">{formatRupiah(selectedPrice)}</span>
            </div>
            <button type="button" className="m-editorial-pdp__sticky-btn" onClick={addSelectedVariant} disabled={soldOut || previewMode}>
              <ShoppingBag className="h-4 w-4" />
              {previewMode ? 'Preview' : soldOut ? 'Sold out' : 'Add to Cart'}
            </button>
          </div>
        </StickyBottomActionBar>
      </main>

      <MobileBottomSheet
        open={cartPromptOpen}
        onOpenChange={setCartPromptOpen}
        title="Added to cart"
        description="Continue shopping or proceed to checkout."
        footer={(
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12 rounded-2xl bg-white" onClick={() => setCartPromptOpen(false)}>
              Continue
            </Button>
            <Button className="h-12 rounded-2xl gap-2" onClick={() => navigate('/mobile/cart')}>
              Checkout <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      >
        {lastAddedItem ? (
          <div className="m-editorial-pdp__cart-confirm">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <strong>{lastAddedItem.name}</strong>
              <span>{lastAddedItem.size} — {lastAddedItem.price}</span>
            </div>
          </div>
        ) : null}
      </MobileBottomSheet>
    </MobileCommerceLayout>
  );
};

export default MobileProductDetailPage;
