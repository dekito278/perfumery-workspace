import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardCheck, ShoppingBag, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductGallery from '@/components/storefront/ProductGallery.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useCart } from '@/hooks/useCart.js';
import { formatRupiah } from '@/services/productCatalogService.js';

const NoteColumn = ({ title, notes }) => (
  <div className="rounded-2xl bg-[#f7f8f2] p-3">
    <div className="text-[10px] font-bold uppercase text-[#8b949e]">{title}</div>
    <div className="mt-2 space-y-1">
      {notes.map((note) => (
        <div key={note} className="text-xs font-bold text-[#0b130c]">{note}</div>
      ))}
    </div>
  </div>
);

const MobileProductDetailPage = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const products = useCatalogProducts();
  const product = products.find((item) => item.slug === slug);
  const { addItem } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [cartPromptOpen, setCartPromptOpen] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState(null);
  const selectedVariant = useMemo(() => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    return variants.find((variant) => (variant.id || variant.size) === selectedVariantId) || variants[0] || null;
  }, [product, selectedVariantId]);

  if (!product && products.loading) {
    return (
      <MobileCommerceLayout>
        <main className="mobile-page grid min-h-[70vh] place-items-center text-xs font-bold text-[#6b7280]">
          Loading product...
        </main>
      </MobileCommerceLayout>
    );
  }

  if (!product) {
    return <Navigate to="/mobile/catalog" replace />;
  }

  const selectedPrice = Number(selectedVariant?.priceNumber || product.priceNumber || 0);
  const selectedCompareAt = Number(selectedVariant?.compareAtPriceNumber || 0);
  const selectedStock = Number(selectedVariant?.stock ?? product.stock ?? 0);
  const selectedSize = selectedVariant?.size || product.size;
  const selectedVariantKey = selectedVariant?.id || selectedVariant?.size || '';
  const lowStock = selectedStock > 0 && selectedStock <= 5;
  const addSelectedVariant = () => {
    if (selectedStock <= 0) {
      toast.error('Stok varian ini sedang habis');
      return;
    }
    addItem({
      ...product,
      cartSlug: `${product.slug}-${selectedVariant?.id || selectedSize}`,
      variantId: selectedVariant?.id || '',
      size: selectedSize,
      price: formatRupiah(selectedPrice),
      priceNumber: selectedPrice,
    }, 1);
    setLastAddedItem({
      name: product.name,
      size: selectedSize,
      price: formatRupiah(selectedPrice),
    });
    setCartPromptOpen(true);
  };

  return (
    <MobileCommerceLayout>
      <Helmet>
        <title>{product.name} - Solivagant</title>
        <meta name="description" content={`${product.name}: ${product.notes}. ${product.description}`} />
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title={product.name}
          subtitle={product.category}
          eyebrow="Product"
          onBack={() => navigate('/mobile/catalog')}
          action={(
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => navigate('/mobile/customer')} aria-label="Check order" className="grid h-10 w-10 place-items-center rounded-2xl border border-[#e5e7eb] bg-white">
                <ClipboardCheck className="h-5 w-5 text-[#263d27]" />
              </button>
              <button type="button" onClick={() => navigate('/mobile/cart')} aria-label="Open cart" className="grid h-10 w-10 place-items-center rounded-2xl border border-[#e5e7eb] bg-white">
                <ShoppingBag className="h-5 w-5 text-[#263d27]" />
              </button>
            </div>
          )}
        />

        <ProductGallery product={product} visualClassName="aspect-square rounded-[24px]" compact />

        <section className="mobile-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold leading-tight text-[#0b130c]">{product.name}</h2>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">{product.description}</p>
            </div>
            <div className="shrink-0 text-right">
              {selectedCompareAt > selectedPrice ? <div className="text-xs font-bold text-[#9ca3af] line-through">{formatRupiah(selectedCompareAt)}</div> : null}
              <div className="text-base font-bold text-[#0b130c]">{formatRupiah(selectedPrice)}</div>
              <div className="text-[10px] font-bold uppercase text-[#8b949e]">{selectedSize}</div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3">
            <label className="text-[10px] font-bold uppercase text-[#6b7280]" htmlFor="mobile-product-variant">Size</label>
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
              <select
                id="mobile-product-variant"
                value={selectedVariantKey}
                onChange={(event) => setSelectedVariantId(event.target.value)}
                className="h-12 min-w-0 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-bold text-[#0b130c] outline-none focus:border-[#263d27]"
              >
                {product.variants.map((variant) => {
                  const variantKey = variant.id || variant.size;
                  const stock = Number(variant.stock || 0);
                  return (
                    <option key={variantKey} value={variantKey}>
                      {variant.size} - {formatRupiah(variant.priceNumber)} {stock <= 0 ? '(Sold out)' : ''}
                    </option>
                  );
                })}
              </select>
              <div className="rounded-2xl bg-white px-3 py-2 text-right">
                <div className="text-sm font-bold text-[#263d27]">{selectedStock}</div>
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Stock</div>
              </div>
            </div>
            {lowStock ? (
              <div className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                Stok varian ini mau habis, tinggal {selectedStock}.
              </div>
            ) : null}
            <Button className="mt-3 h-12 w-full rounded-2xl gap-2" onClick={addSelectedVariant} disabled={selectedStock <= 0}>
              Add to cart
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#6b7280]">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              Ready to order while stock lasts
            </div>
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#263d27]" />
            <h2 className="text-base font-bold text-[#0b130c]">Scent notes</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NoteColumn title="Top" notes={product.topNotes} />
            <NoteColumn title="Heart" notes={product.heartNotes} />
            <NoteColumn title="Base" notes={product.baseNotes} />
          </div>
        </section>

        <Link to="/mobile/catalog" className="mobile-card flex items-center justify-between p-3 text-sm font-bold text-[#0b130c]">
          Back to catalog
          <ShoppingBag className="h-4 w-4 text-[#263d27]" />
        </Link>
      </main>
      <MobileBottomSheet
        open={cartPromptOpen}
        onOpenChange={setCartPromptOpen}
        title="Produk masuk cart"
        description="Swipe turun untuk menutup, atau lanjut checkout."
        footer={(
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12 rounded-2xl bg-white" onClick={() => setCartPromptOpen(false)}>
              Lanjut belanja
            </Button>
            <Button className="h-12 rounded-2xl gap-2" onClick={() => navigate('/mobile/cart')}>
              Checkout
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      >
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#263d27] text-white">
          <ShoppingBag className="h-5 w-5" />
        </div>
        {lastAddedItem ? (
            <div className="mt-4 rounded-2xl border border-[#263d27]/10 bg-white p-3">
              <div className="text-sm font-bold text-[#0b130c]">{lastAddedItem.name}</div>
              <div className="mt-1 flex items-center justify-between text-xs font-bold text-[#6b7280]">
                <span>{lastAddedItem.size}</span>
                <span>{lastAddedItem.price}</span>
              </div>
            </div>
        ) : null}
      </MobileBottomSheet>
    </MobileCommerceLayout>
  );
};

export default MobileProductDetailPage;
