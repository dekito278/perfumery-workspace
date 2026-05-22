import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, PackageCheck, ShoppingBag, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ProductGallery from '@/components/storefront/ProductGallery.jsx';
import StorefrontLoadingState from '@/components/storefront/StorefrontLoadingState.jsx';
import StorefrontHeader from '@/components/storefront/StorefrontHeader.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useCart } from '@/hooks/useCart.js';
import { formatRupiah, isProductVisibleInStorefront } from '@/services/productCatalogService.js';

const ProductDetailPage = () => {
  const { slug } = useParams();
  const location = useLocation();
  const products = useCatalogProducts();
  const previewProduct = location.state?.previewMode && location.state?.previewProduct?.slug === slug
    ? location.state.previewProduct
    : null;
  const product = previewProduct || products.find((item) => item.slug === slug && isProductVisibleInStorefront(item));
  const previewMode = Boolean(previewProduct);
  const previewBackTo = location.state?.previewBackTo || '/studio/products';
  const { addItem } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const selectedVariant = useMemo(() => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    return variants.find((variant) => variant.id === selectedVariantId) || variants[0] || null;
  }, [product, selectedVariantId]);

  if (!product && products.loading) {
    return (
      <StorefrontLoadingState
        mode="product"
        title="Memuat produk"
        description="Mengambil detail parfum, varian ukuran, foto, dan stok terbaru."
      />
    );
  }

  if (!product) {
    return <Navigate to="/catalog" replace />;
  }

  const selectedPrice = Number(selectedVariant?.priceNumber || product.priceNumber || 0);
  const selectedCompareAt = Number(selectedVariant?.compareAtPriceNumber || 0);
  const selectedStock = Number(selectedVariant?.stock ?? product.stock ?? 0);
  const selectedSize = selectedVariant?.size || product.size;
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
    toast.success(`${selectedSize} masuk keranjang`);
  };

  return (
    <>
      <Helmet>
        <title>{product.name} - Solivagant</title>
        <meta name="description" content={`${product.name}: ${product.notes}. ${product.description}`} />
      </Helmet>
      <main className="min-h-screen bg-[#f7f8f2] text-[#0b130c]">
        <StorefrontHeader
          backTo={previewMode ? previewBackTo : '/catalog'}
          backLabel={previewMode ? 'Kembali ke editor' : 'Katalog'}
          previewLabel={previewMode ? 'Preview draft' : undefined}
          actions={previewMode ? [] : [{ to: '/cart', label: 'Keranjang' }]}
        />
        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <ProductGallery product={product} visualClassName="min-h-[520px] rounded-[28px]" priority />
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#263d27]/15 bg-white px-3 py-1 text-xs font-bold uppercase text-[#263d27]">
              <Sparkles className="h-4 w-4" />
              {product.category}
            </div>
            <h1 className="mt-5 text-5xl font-bold leading-none">{product.name}</h1>
            <p className="mt-4 text-lg font-semibold text-muted-foreground">{product.notes}</p>
            {previewMode ? (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="text-sm font-bold">Mode preview admin</div>
                  <p className="mt-1 text-xs font-semibold leading-relaxed">Data ini belum tentu sudah tersimpan atau publish. Tombol cart dimatikan selama preview.</p>
                </div>
              </div>
            ) : null}
            <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground">{product.description}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[['Harga', formatRupiah(selectedPrice)], ['Stok', `${selectedStock} tersisa`], ['Intensity', product.intensity]].map(([label, value]) => (
                <div key={label} className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="text-xs font-bold uppercase text-muted-foreground">{label}</div>
                  {label === 'Harga' && selectedCompareAt > selectedPrice ? <div className="mt-2 text-sm font-bold text-muted-foreground line-through">{formatRupiah(selectedCompareAt)}</div> : null}
                  <div className={label === 'Harga' && selectedCompareAt > selectedPrice ? 'mt-0 text-lg font-bold' : 'mt-2 text-lg font-bold'}>{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase text-muted-foreground">Ukuran tersedia</div>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">Pilih varian sebelum masuk cart supaya harga dan stoknya jelas.</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase ${soldOut ? 'bg-rose-50 text-rose-700' : lowStock ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
                  {soldOut ? 'Habis' : lowStock ? 'Stok menipis' : 'Ready'}
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {product.variants.map((variant) => {
                  const variantKey = variant.id || variant.size;
                  const variantStock = Number(variant.stock || 0);
                  const active = (selectedVariant?.id || selectedVariant?.size) === variantKey;
                  return (
                    <button
                      key={variantKey}
                      type="button"
                      onClick={() => setSelectedVariantId(variantKey)}
                      disabled={variantStock <= 0}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${active ? 'border-[#263d27] bg-[#eef2e8] text-[#263d27] shadow-sm' : 'bg-white hover:border-[#263d27]/40'} disabled:cursor-not-allowed disabled:bg-[#f7f8f2] disabled:text-muted-foreground disabled:opacity-70`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{variant.size}</span>
                        <span>{formatRupiah(variant.priceNumber)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
                        <span>{variantStock > 0 ? `${variantStock} tersisa` : 'Habis'}</span>
                        {active ? <CheckCircle2 className="h-4 w-4 text-[#263d27]" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[['Top', product.topNotes], ['Heart', product.heartNotes], ['Base', product.baseNotes]].map(([label, notes]) => (
                <div key={label} className="rounded-2xl border bg-white p-4">
                  <div className="text-xs font-bold uppercase text-muted-foreground">{label}</div>
                  <div className="mt-3 space-y-1">
                    {notes.map((note) => <div key={note} className="text-sm font-bold">{note}</div>)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-2xl border border-[#263d27]/15 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
                    <PackageCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs font-bold uppercase text-muted-foreground">Selected</div>
                    <div className="mt-1 text-lg font-bold">{selectedSize} / {formatRupiah(selectedPrice)}</div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {soldOut ? 'Varian ini sedang habis.' : lowStock ? `Stok menipis, tinggal ${selectedStock}.` : `${selectedStock} stok tersedia.`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to="/cart" className="inline-flex h-12 items-center rounded-2xl border bg-white px-5 text-sm font-bold text-[#263d27]">
                    Lihat keranjang
                  </Link>
                  <button type="button" onClick={addSelectedVariant} disabled={soldOut || previewMode} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#263d27] px-5 text-sm font-bold text-[#eef2e8] disabled:opacity-50">
                    {previewMode ? 'Preview saja' : 'Masukkan keranjang'}
                    <ShoppingBag className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default ProductDetailPage;
