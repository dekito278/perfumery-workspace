import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, PackageCheck, ShoppingBag, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import MobileStatePanel from '@/components/mobile-ui/MobileStatePanel.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductGallery from '@/components/storefront/ProductGallery.jsx';
import { useMobileBackNavigation } from '@/hooks/useMobileBackNavigation.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useCart } from '@/hooks/useCart.js';
import { formatRupiah, isProductVisibleInStorefront } from '@/services/productCatalogService.js';

const NoteColumn = ({ title, notes }) => (
  <div className="mobile-commerce-panel bg-[#f7f8f2] p-3">
    <div className="text-[10px] font-bold uppercase text-[#8b949e]">{title}</div>
    <div className="mt-2 space-y-1">
      {notes.map((note) => (
        <div key={note} className="text-xs font-bold text-[#0b130c]">{note}</div>
      ))}
    </div>
  </div>
);

const MobileProductDetailSkeleton = () => (
  <MobileCommerceLayout>
    <main className="mobile-page">
      <div className="mobile-card h-12 animate-pulse bg-white" />
      <div className="mobile-catalog-skeleton aspect-square rounded-[18px]" />
      <section className="mobile-card p-4" aria-busy="true">
        <div className="mobile-catalog-skeleton h-7 w-3/4 rounded-full" />
        <div className="mobile-catalog-skeleton mt-3 h-4 w-full rounded-full" />
        <div className="mobile-catalog-skeleton mt-2 h-4 w-5/6 rounded-full" />
        <div className="mobile-catalog-skeleton mt-5 h-24 rounded-2xl" />
      </section>
      <section className="mobile-card p-4">
        <div className="mobile-catalog-skeleton h-5 w-36 rounded-full" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="mobile-catalog-skeleton h-24 rounded-2xl" />
          <div className="mobile-catalog-skeleton h-24 rounded-2xl" />
          <div className="mobile-catalog-skeleton h-24 rounded-2xl" />
        </div>
      </section>
    </main>
  </MobileCommerceLayout>
);

const MobileProductDetailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = useMobileBackNavigation('/mobile/catalog');
  const { slug } = useParams();
  const products = useCatalogProducts();
  const previewProduct = location.state?.previewMode && location.state?.previewProduct?.slug === slug
    ? location.state.previewProduct
    : null;
  const product = previewProduct || products.find((item) => item.slug === slug && isProductVisibleInStorefront(item));
  const previewMode = Boolean(previewProduct);
  const previewBackTo = location.state?.previewBackTo || '/mobile/studio/products?view=new';
  const { addItem } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [cartPromptOpen, setCartPromptOpen] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState(null);
  const selectedVariant = useMemo(() => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    return variants.find((variant) => (variant.id || variant.size) === selectedVariantId) || variants[0] || null;
  }, [product, selectedVariantId]);

  if (!product && products.loading) {
    return <MobileProductDetailSkeleton />;
  }

  if (!product) {
    return (
      <MobileCommerceLayout>
        <Helmet>
          <title>Produk tidak ditemukan - Solivagant</title>
        </Helmet>
        <main className="mobile-page space-y-4">
          <MobileTopBar
            title="Produk tidak ditemukan"
            subtitle="Produk mungkin belum publish atau stok katalog sedang diperbarui."
            eyebrow="Katalog"
            onBack={handleBack}
            action={<ShoppingBag className="h-5 w-5 text-[#263d27]" />}
          />
          <MobileStatePanel
            tone="empty"
            title="Produk belum tersedia"
            description="Kembali ke katalog untuk melihat produk yang sedang aktif."
            action="Buka katalog"
            onAction={() => navigate('/mobile/catalog')}
          />
        </main>
      </MobileCommerceLayout>
    );
  }

  const selectedPrice = Number(selectedVariant?.priceNumber || product.priceNumber || 0);
  const selectedCompareAt = Number(selectedVariant?.compareAtPriceNumber || 0);
  const selectedStock = Number(selectedVariant?.stock ?? product.stock ?? 0);
  const selectedSize = selectedVariant?.size || product.size;
  const selectedVariantKey = selectedVariant?.id || selectedVariant?.size || '';
  const soldOut = selectedStock <= 0;
  const lowStock = selectedStock > 0 && selectedStock <= 5;
  const addSelectedVariant = () => {
    if (previewMode) {
      toast.error('Preview draft belum bisa masuk keranjang');
      return;
    }
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
      maxStock: selectedStock,
    }, 1);
    setLastAddedItem({
      name: product.name,
      size: selectedSize,
      price: formatRupiah(selectedPrice),
    });
    toast.success(`${product.name} masuk keranjang`);
    setCartPromptOpen(true);
  };

  return (
    <MobileCommerceLayout>
      <Helmet>
        <title>{product.name} - Solivagant</title>
        <meta name="description" content={`${product.name}: ${product.notes}. ${product.description}`} />
      </Helmet>
      <main className="mobile-page mobile-product-detail-page">
        <MobileTopBar
          title={product.name}
          subtitle={previewMode ? 'Preview admin' : product.category}
          eyebrow={previewMode ? 'Preview draft' : 'Produk'}
          onBack={previewMode ? () => navigate(previewBackTo) : handleBack}
          action={<ShoppingBag className="h-5 w-5 text-[#263d27]" />}
        />

        <ProductGallery product={product} visualClassName="aspect-square rounded-[18px]" compact priority />

        <section className="mobile-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold leading-tight text-[#0b130c]">{product.name}</h2>
              {previewMode ? (
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">Mode preview admin</div>
                    <p className="mt-1 text-[11px] font-semibold leading-relaxed">Data ini belum tentu sudah tersimpan atau publish. Aksi cart dimatikan.</p>
                  </div>
                </div>
              ) : null}
              <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">{product.description}</p>
            </div>
            <div className="shrink-0 text-right">
              {selectedCompareAt > selectedPrice ? <div className="text-xs font-bold text-[#9ca3af] line-through">{formatRupiah(selectedCompareAt)}</div> : null}
              <div className="text-base font-bold text-[#0b130c]">{formatRupiah(selectedPrice)}</div>
              <div className="text-[10px] font-bold uppercase text-[#8b949e]">{selectedSize}</div>
            </div>
          </div>
          <div className="mobile-commerce-panel mt-4 bg-[#fbfaf7]">
            <label className="text-[10px] font-bold uppercase text-[#6b7280]" htmlFor="mobile-product-variant">Ukuran</label>
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
              <select
                id="mobile-product-variant"
                value={selectedVariantKey}
                onChange={(event) => setSelectedVariantId(event.target.value)}
                className="mobile-commerce-control h-12 min-w-0 px-3 text-sm font-bold text-[#0b130c]"
              >
                {product.variants.map((variant) => {
                  const variantKey = variant.id || variant.size;
                  const stock = Number(variant.stock || 0);
                  return (
                    <option key={variantKey} value={variantKey}>
                      {variant.size} - {formatRupiah(variant.priceNumber)} {stock <= 0 ? '(Habis)' : ''}
                    </option>
                  );
                })}
              </select>
              <div className="mobile-commerce-panel border-0 bg-white px-3 py-2 text-right">
                <div className="text-sm font-bold text-[#263d27]">{selectedStock}</div>
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Stok</div>
              </div>
            </div>
            <div className={`mt-3 rounded-[14px] px-3 py-2 text-xs font-bold ${soldOut ? 'bg-rose-50 text-rose-700' : lowStock ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
              {soldOut ? 'Varian ini sedang habis.' : lowStock ? `Stok varian ini mau habis, tinggal ${selectedStock}.` : 'Stok tersedia, siap masuk keranjang.'}
            </div>
            <Button className="mt-3 h-12 w-full rounded-2xl gap-2" onClick={addSelectedVariant} disabled={selectedStock <= 0 || previewMode}>
              {previewMode ? 'Preview saja' : 'Masukkan keranjang'}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#6b7280]">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              Siap dipesan selama stok tersedia
            </div>
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#263d27]" />
            <h2 className="text-base font-bold text-[#0b130c]">Catatan aroma</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NoteColumn title="Pembuka" notes={product.topNotes} />
            <NoteColumn title="Tengah" notes={product.heartNotes} />
            <NoteColumn title="Dasar" notes={product.baseNotes} />
          </div>
        </section>

        <button
          type="button"
          onClick={previewMode ? () => navigate(previewBackTo, { replace: true }) : handleBack}
          className="mobile-card flex w-full items-center justify-between p-3 text-left text-sm font-bold text-[#0b130c]"
        >
          {previewMode ? 'Kembali ke editor' : 'Kembali ke katalog'}
          <ShoppingBag className="h-4 w-4 text-[#263d27]" />
        </button>

        <section className="mobile-card border border-[#263d27]/15 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[#eef2e8] text-[#263d27]">
                <PackageCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-[#0b130c]">{selectedSize}</div>
                <div className="text-xs font-semibold text-[#6b7280]">{formatRupiah(selectedPrice)}</div>
              </div>
            </div>
            <Button className="h-11 shrink-0 rounded-2xl gap-2 px-4" onClick={addSelectedVariant} disabled={soldOut || previewMode}>
              {previewMode ? 'Preview' : 'Tambah'}
              <ShoppingBag className="h-4 w-4" />
            </Button>
          </div>
        </section>
        <StickyBottomActionBar
          fixed
          reserveSpace
          aria-label="Aksi produk"
          className="mobile-product-action-bar"
          contentClassName="rounded-2xl border-[#263d27]/10 bg-white/95"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase text-[#8b949e]">{selectedSize}</p>
              <p className="truncate text-lg font-bold leading-tight text-[#263d27]">{formatRupiah(selectedPrice)}</p>
              <p className={`truncate text-[10px] font-bold ${soldOut ? 'text-rose-700' : lowStock ? 'text-amber-700' : 'text-emerald-700'}`}>
                {soldOut ? 'Stok habis' : lowStock ? `Sisa ${selectedStock}` : 'Siap masuk keranjang'}
              </p>
            </div>
            <Button type="button" className="h-12 rounded-2xl gap-2 px-4" onClick={addSelectedVariant} disabled={soldOut || previewMode}>
              <ShoppingBag className="h-4 w-4" />
              {previewMode ? 'Preview' : 'Tambah'}
            </Button>
          </div>
        </StickyBottomActionBar>
      </main>
      <MobileBottomSheet
        open={cartPromptOpen}
        onOpenChange={setCartPromptOpen}
        title="Produk masuk keranjang"
        description="Geser turun untuk menutup, atau lanjut ke checkout."
        footer={(
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12 rounded-2xl bg-white" onClick={() => setCartPromptOpen(false)}>
              Lanjut belanja
            </Button>
            <Button className="h-12 rounded-2xl gap-2" onClick={() => navigate('/mobile/cart')}>
              Lanjut bayar
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      >
        <div className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#263d27] text-white">
          <ShoppingBag className="h-5 w-5" />
        </div>
        {lastAddedItem ? (
            <div className="mobile-commerce-panel mt-4">
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
