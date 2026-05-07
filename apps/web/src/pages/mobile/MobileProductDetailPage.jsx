import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, MessageCircle, ShoppingBag, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { useCatalogProduct } from '@/hooks/useCatalogProducts.js';
import { useCart } from '@/hooks/useCart.js';

const NoteColumn = ({ title, notes }) => (
  <div className="rounded-2xl bg-[#f8f7f4] p-3">
    <div className="text-[10px] font-bold uppercase text-[#8b949e]">{title}</div>
    <div className="mt-2 space-y-1">
      {notes.map((note) => (
        <div key={note} className="text-xs font-bold text-[#1f2937]">{note}</div>
      ))}
    </div>
  </div>
);

const MobileProductDetailPage = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const product = useCatalogProduct(slug);
  const { addItem } = useCart();

  if (!product) {
    return <Navigate to="/mobile/catalog" replace />;
  }

  return (
    <MobileCommerceLayout>
      <Helmet>
        <title>{product.name} - Dekito Perfumery</title>
        <meta name="description" content={`${product.name}: ${product.notes}. ${product.description}`} />
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title={product.name}
          subtitle={product.category}
          eyebrow="Product"
          onBack={() => navigate('/mobile/catalog')}
          action={<button type="button" onClick={() => navigate('/mobile/cart')} aria-label="Open cart"><ShoppingBag className="h-5 w-5 text-amber-700" /></button>}
        />

        <ProductVisual product={product} className="min-h-[320px] rounded-[24px]" bottleClassName="left-10 top-10 h-44 w-24 rounded-[2rem]" />

        <section className="mobile-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold leading-tight text-[#1f2937]">{product.name}</h2>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">{product.description}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-base font-bold text-[#1f2937]">{product.price}</div>
              <div className="text-[10px] font-bold uppercase text-[#8b949e]">{product.size}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-amber-50 p-3 text-center">
              <div className="text-sm font-bold text-amber-800">{product.stock}</div>
              <div className="text-[10px] font-bold uppercase text-amber-700">Stock</div>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3 text-center">
              <div className="text-sm font-bold text-blue-800">{product.intensity}</div>
              <div className="text-[10px] font-bold uppercase text-blue-700">Intensity</div>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-center">
              <div className="text-sm font-bold text-emerald-800">{product.variants.length}</div>
              <div className="text-[10px] font-bold uppercase text-emerald-700">Sizes</div>
            </div>
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-700" />
            <h2 className="text-base font-bold text-[#1f2937]">Scent notes</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NoteColumn title="Top" notes={product.topNotes} />
            <NoteColumn title="Heart" notes={product.heartNotes} />
            <NoteColumn title="Base" notes={product.baseNotes} />
          </div>
        </section>

        <section className="mobile-card p-4">
          <h2 className="text-base font-bold text-[#1f2937]">Available sizes</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {product.variants.map((variant) => (
              <button key={variant} type="button" className="h-11 rounded-2xl border border-[#e5e7eb] bg-white text-xs font-bold text-[#1f2937]">
                {variant}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {['Ready for catalog checkout in next phase', 'Can be connected to cart and stock management', 'Bespoke request can reuse this scent profile'].map((item) => (
              <div key={item} className="flex items-start gap-2 text-xs font-semibold text-[#6b7280]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <div className="mobile-card sticky bottom-20 z-20 grid grid-cols-[1fr_auto] gap-2 p-2 shadow-lg">
          <Button className="h-12 rounded-2xl gap-2" onClick={() => { addItem(product, 1); toast.success('Added to cart'); }}>
            Add to cart
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-2xl bg-white"
            aria-label="Use as custom perfume reference"
            onClick={() => navigate(`/mobile/bespoke?reference=${product.slug}`)}
          >
            <MessageCircle className="h-5 w-5" />
          </Button>
        </div>

        <Link to="/mobile/catalog" className="mobile-card flex items-center justify-between p-3 text-sm font-bold text-[#1f2937]">
          Back to catalog
          <ShoppingBag className="h-4 w-4 text-amber-700" />
        </Link>
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileProductDetailPage;
