import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, ShoppingBag, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useCart } from '@/hooks/useCart.js';

const ProductDetailPage = () => {
  const { slug } = useParams();
  const products = useCatalogProducts();
  const product = products.find((item) => item.slug === slug);
  const { addItem } = useCart();

  if (!product && products.loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbfaf7] text-sm font-bold text-muted-foreground">
        Loading product...
      </main>
    );
  }

  if (!product) {
    return <Navigate to="/catalog" replace />;
  }

  return (
    <>
      <Helmet>
        <title>{product.name} - Dekito Perfumery</title>
        <meta name="description" content={`${product.name}: ${product.notes}. ${product.description}`} />
      </Helmet>
      <main className="min-h-screen bg-[#fbfaf7] text-[#1f2937]">
        <section className="border-b border-stone-200 bg-white/80">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              Catalog
            </Link>
            <Link to="/login" className="rounded-2xl border bg-white px-4 py-2 text-sm font-bold">Admin login</Link>
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <ProductVisual product={product} className="min-h-[520px] rounded-[28px]" bottleClassName="left-14 top-14 h-64 w-36 rounded-[2.5rem]" />
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-100 bg-white px-3 py-1 text-xs font-bold uppercase text-amber-700">
              <Sparkles className="h-4 w-4" />
              {product.category}
            </div>
            <h1 className="mt-5 text-5xl font-bold leading-none">{product.name}</h1>
            <p className="mt-4 text-lg font-semibold text-muted-foreground">{product.notes}</p>
            <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground">{product.description}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[['Price', product.price], ['Stock', `${product.stock} left`], ['Intensity', product.intensity]].map(([label, value]) => (
                <div key={label} className="rounded-2xl border bg-white p-4">
                  <div className="text-xs font-bold uppercase text-muted-foreground">{label}</div>
                  <div className="mt-2 text-lg font-bold">{value}</div>
                </div>
              ))}
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
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={() => { addItem(product, 1); toast.success('Added to cart'); }} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-amber-500 px-5 text-sm font-bold text-[#1f2937]">
                Add to cart
                <ShoppingBag className="h-4 w-4" />
              </button>
              <Link to={`/bespoke?reference=${product.slug}`} className="inline-flex h-12 items-center gap-2 rounded-2xl border bg-white px-5 text-sm font-bold">
                Use as custom brief reference
                <MessageCircle className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default ProductDetailPage;
