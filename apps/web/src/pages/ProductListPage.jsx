import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock3, Copy, Edit3, ExternalLink, Filter, PackagePlus, Plus, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { featuredProducts } from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';
import {
  deleteCustomProduct,
  getProductPublishStatus,
  getProductRestockThreshold,
  getProductStockCorrections,
  getProductStorefrontPath,
  resetCustomProducts,
} from '@/services/productCatalogService.js';
import { deleteProductImages } from '@/services/productImageStorageService.js';
import { copyTextToClipboard } from '@/utils/clipboard.js';

const productStatusFilters = [
  { key: 'all', label: 'Semua' },
  { key: 'live', label: 'Live' },
  { key: 'draft', label: 'Draft' },
  { key: 'blocked', label: 'Belum siap' },
  { key: 'stockout', label: 'Stok habis' },
];

const getStatusBadgeClass = (tone) => {
  if (tone === 'emerald') return 'bg-emerald-50 text-emerald-700';
  if (tone === 'rose') return 'bg-rose-50 text-rose-700';
  return 'bg-amber-50 text-amber-700';
};

const ProductListPage = () => {
  const navigate = useNavigate();
  const products = useCatalogProducts();
  const categories = useStorefrontCategories(products);
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
  const categoryUsage = useMemo(() => products.reduce((usage, product) => {
    if (!product.category) return usage;
    usage.set(product.category.toLowerCase(), (usage.get(product.category.toLowerCase()) || 0) + 1);
    return usage;
  }, new Map()), [products]);
  const [productStatusFilter, setProductStatusFilter] = useState('all');
  const productStatusCounts = useMemo(() => customProducts.reduce((counts, product) => {
    const status = getProductPublishStatus(product).key;
    counts.all += 1;
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, { all: 0, live: 0, draft: 0, blocked: 0, stockout: 0 }), [customProducts]);
  const filteredCustomProducts = useMemo(() => (
    productStatusFilter === 'all'
      ? customProducts
      : customProducts.filter((product) => getProductPublishStatus(product).key === productStatusFilter)
  ), [customProducts, productStatusFilter]);

  const editProduct = (product) => navigate(`/studio/products/${product.id}/edit`);

  const copyProductLink = async (product) => {
    const path = getProductStorefrontPath(product);
    const copied = await copyTextToClipboard(`${window.location.origin}${path}`);
    toast[copied ? 'success' : 'error'](copied ? 'Link produk disalin' : 'Link belum bisa disalin');
  };

  const previewProduct = (product) => {
    const path = getProductStorefrontPath(product);
    if (!path) {
      toast.error('Slug produk belum tersedia');
      return;
    }
    navigate(path);
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Hapus produk "${product.name || product.id}" dari katalog? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await deleteCustomProduct(product.id);
      // The product is gone, so its images are orphaned — remove them from storage (best-effort).
      if (product.images?.length) {
        deleteProductImages(product.images).catch((cleanupError) => console.warn('Product image cleanup skipped:', cleanupError.message || cleanupError));
      }
      toast.success('Produk dihapus dari katalog custom');
    } catch (error) {
      toast.error(error.message || 'Gagal menghapus produk');
    }
  };

  const handleResetAll = async () => {
    if (!window.confirm('Reset semua produk custom ke default? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      await resetCustomProducts();
      toast.success('Produk custom direset');
    } catch (error) {
      toast.error(error.message || 'Gagal mereset produk');
    }
  };

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Daftar produk - Solivagant</title>
        <meta name="description" content="Kelola produk custom storefront Solivagant." />
      </Helmet>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <div className="dashboard-hero-eyebrow">
              <PackagePlus className="h-4 w-4 text-primary" />
              E-commerce
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Daftar produk</h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Lihat, edit, dan kelola produk custom katalog. Buat produk baru atau atur kategori dari sini.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button className="h-11 rounded-2xl gap-2 px-5" onClick={() => navigate('/studio/products/new')}>
                <Plus className="h-4 w-4" />
                Tambah produk
              </Button>
              <Button variant="outline" className="h-11 rounded-2xl gap-2 border-white/70 bg-white/80 px-5" onClick={() => navigate('/studio/product-categories')}>
                <Tags className="h-4 w-4" />
                Kelola kategori produk
              </Button>
            </div>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">All catalog products</span><strong>{products.length}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Produk seed</span><strong>{featuredProducts.length}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Produk custom</span><strong>{customProducts.length}</strong></div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="grid gap-6">
            <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Inventory ops</h2>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">Threshold restock, notifikasi low stock, dan riwayat koreksi stok.</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-rose-700" />
              </div>
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
                  {lowStockProducts.slice(0, 4).map((product) => (
                    <button key={product.id} type="button" onClick={() => editProduct(product)} className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-left">
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
                  {stockCorrectionHistory.slice(0, 5).map((event) => (
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

            <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Product categories</h2>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">Kategori tampil di sini sebagai reference. Kelola detailnya di halaman kategori.</p>
                </div>
                <Tags className="h-5 w-5 text-amber-700" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {categories.map((category) => {
                  const usageCount = categoryUsage.get(category.name.toLowerCase()) || 0;
                  return (
                    <span key={category.name} className="inline-flex items-center gap-2 rounded-2xl border bg-[#fbfaf7] px-3 py-2 text-xs font-bold text-[#344054]">
                      {category.name}
                      <span className="text-[10px] uppercase text-muted-foreground">{usageCount} product</span>
                    </span>
                  );
                })}
              </div>
              <Button type="button" variant="outline" className="mt-5 h-11 rounded-2xl gap-2 bg-white" onClick={() => navigate('/studio/product-categories')}>
                <Tags className="h-4 w-4" />
                Open product categories
              </Button>
            </section>
          </div>

          <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Daftar produk</h2>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">Cek status publish, alasan tidak muncul, dan link publik produk.</p>
              </div>
              {customProducts.length ? <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={handleResetAll}>Reset semua</Button> : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {productStatusFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setProductStatusFilter(filter.key)}
                  className={`inline-flex h-9 items-center gap-2 rounded-2xl border px-3 text-xs font-bold transition ${productStatusFilter === filter.key ? 'border-editorial-charcoal bg-editorial-charcoal text-white' : 'bg-white text-[#344054]'}`}
                >
                  {filter.key === 'all' ? <Filter className="h-3.5 w-3.5" /> : null}
                  {filter.label}
                  <span className={productStatusFilter === filter.key ? 'text-white/75' : 'text-muted-foreground'}>{productStatusCounts[filter.key] || 0}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-3">
              {filteredCustomProducts.map((product) => {
                const status = getProductPublishStatus(product);
                const publicPath = getProductStorefrontPath(product);
                const canOpenPublic = status.key === 'live' && publicPath;

                return (
                  <article key={product.id} className="rounded-2xl border bg-[#fbfaf7] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid min-w-0 flex-1 grid-cols-[84px_1fr] gap-3">
                        <ProductVisual product={product} className="h-24 rounded-2xl" label={false} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-bold">{product.name}</h3>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${getStatusBadgeClass(status.tone)}`}>
                              {status.label}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-muted-foreground">{product.notes}</p>
                          <p className={`mt-2 w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${getStatusBadgeClass(status.tone)}`}>
                            {status.reason}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {product.variants.slice(0, 4).map((variant) => (
                              <span key={variant.id || variant.size} className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${variant.stock > 0 && variant.stock <= 5 ? 'bg-rose-50 text-rose-700' : 'bg-editorial-ivory text-editorial-charcoal'}`}>
                                {variant.size}: {variant.stock}
                              </span>
                            ))}
                          </div>
                          <p className="mt-2 text-xs font-bold uppercase text-amber-700">{product.category} / {product.price} / total {product.stock} left / min {getProductRestockThreshold(product)}</p>
                          <p className="mt-1 break-all text-[10px] font-bold uppercase text-muted-foreground">{publicPath || 'Slug belum tersedia'}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        <Button type="button" size="icon" variant="outline" className="rounded-2xl bg-white" onClick={() => previewProduct(product)} disabled={!canOpenPublic} aria-label={`Preview ${product.name}`}><ExternalLink className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="outline" className="rounded-2xl bg-white" onClick={() => copyProductLink(product)} disabled={!canOpenPublic} aria-label={`Salin link ${product.name}`}><Copy className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="outline" className="rounded-2xl bg-white" onClick={() => editProduct(product)} aria-label={`Edit ${product.name}`}><Edit3 className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="outline" className="rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => handleDelete(product)} aria-label={`Hapus ${product.name}`}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {!customProducts.length ? (
                <div className="rounded-2xl border border-dashed bg-[#fbfaf7] p-6 text-center">
                  <h3 className="font-bold">Belum ada produk custom</h3>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">Klik "Tambah produk" untuk mempublish produk ke katalog.</p>
                </div>
              ) : null}
              {customProducts.length && !filteredCustomProducts.length ? (
                <div className="rounded-2xl border border-dashed bg-[#fbfaf7] p-6 text-center">
                  <h3 className="font-bold">Tidak ada produk di status ini</h3>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">Pilih filter lain untuk melihat produk custom.</p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default ProductListPage;
