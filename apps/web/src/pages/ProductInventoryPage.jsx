import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Clock3 } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { getProductRestockThreshold, getProductStockCorrections } from '@/services/productCatalogService.js';

const ProductInventoryPage = () => {
  const navigate = useNavigate();
  const products = useCatalogProducts();
  const customProducts = useMemo(() => products.filter((product) => product.source === 'custom'), [products]);
  const lowStockProducts = useMemo(() => customProducts.filter((product) => product.stock > 0 && product.stock <= getProductRestockThreshold(product)), [customProducts]);
  const stockCorrectionHistory = useMemo(() => customProducts.flatMap((product) => (
    getProductStockCorrections(product).map((event) => ({
      ...event,
      productId: product.id,
      productName: product.name,
      threshold: getProductRestockThreshold(product),
    }))
  )).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), [customProducts]);

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Inventory ops - Solivagant</title>
        <meta name="description" content="Monitor low stock dan riwayat koreksi stok produk custom." />
      </Helmet>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" className="h-10 gap-2" onClick={() => navigate('/studio/products')}>
            <ArrowLeft className="h-4 w-4" />
            Daftar produk
          </Button>
        </div>
        <div className="mb-6 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-rose-700" />
          <h1 className="text-3xl font-bold sm:text-4xl">Inventory ops</h1>
        </div>

        <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
          <p className="text-sm font-semibold text-muted-foreground">Threshold restock, notifikasi low stock, dan riwayat koreksi stok.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-rose-50 px-4 py-3">
              <div className="text-xs font-bold uppercase text-rose-700">Low stock</div>
              <div className="mt-1 text-2xl font-bold text-rose-800">{lowStockProducts.length}</div>
            </div>
            <div className="rounded-2xl bg-amber-50 px-4 py-3">
              <div className="text-xs font-bold uppercase text-amber-700">Corrections</div>
              <div className="mt-1 text-2xl font-bold text-amber-800">{stockCorrectionHistory.length}</div>
            </div>
            <div className="rounded-2xl bg-editorial-ivory px-4 py-3">
              <div className="text-xs font-bold uppercase text-editorial-charcoal">Avg threshold</div>
              <div className="mt-1 text-2xl font-bold text-editorial-charcoal">
                {customProducts.length ? Math.round(customProducts.reduce((sum, product) => sum + getProductRestockThreshold(product), 0) / customProducts.length) : 0}
              </div>
            </div>
          </div>
          {lowStockProducts.length ? (
            <div className="mt-4 grid gap-2">
              {lowStockProducts.map((product) => (
                <button key={product.id} type="button" onClick={() => navigate(`/studio/products/${product.id}/edit`)} className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-[#1f2937]">{product.name}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-rose-700">{product.stock} / min {getProductRestockThreshold(product)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-[#fbfaf7] px-4 py-3 text-sm font-semibold text-muted-foreground">Semua custom product masih di atas restock threshold.</p>
          )}
          <div className="mt-5 border-t pt-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-editorial-charcoal">
              <Clock3 className="h-4 w-4" />
              Riwayat koreksi stok
            </div>
            <div className="grid gap-2">
              {stockCorrectionHistory.map((event) => (
                <div key={`${event.productId}-${event.id}`} className="rounded-2xl bg-[#fbfaf7] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#1f2937]">{event.productName}</div>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">{event.note || 'Manual stock correction'}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-editorial-charcoal">{event.previousStock} -&gt; {event.nextStock}</span>
                  </div>
                </div>
              ))}
              {!stockCorrectionHistory.length ? <p className="text-sm font-semibold text-muted-foreground">Belum ada koreksi stok manual yang tercatat.</p> : null}
            </div>
          </div>
        </section>
      </div>
    </AuthenticatedLayout>
  );
};

export default ProductInventoryPage;
