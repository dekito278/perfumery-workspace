import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Copy, Edit3, ExternalLink, Filter, PackagePlus, Plus, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import {
  deleteCustomProduct,
  getProductBatchDetails,
  getProductFormulaId,
  getProductPublishStatus,
  getProductStorefrontPath,
} from '@/services/productCatalogService.js';
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

const ProductListCard = ({ onCopyLink, onDelete, onEdit, onOpenBatch, onPreview, product }) => {
  const formulaId = getProductFormulaId(product);
  const batchDetails = getProductBatchDetails(product);
  const status = getProductPublishStatus(product);
  const publicPath = getProductStorefrontPath(product, { mobile: true });
  const canOpenPublic = status.key === 'live' && publicPath;

  return (
    <article className="mobile-card mobile-list-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 flex-1 grid-cols-[72px_1fr] gap-3">
          <ProductVisual product={product} className="h-20 rounded-2xl" label={false} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate text-sm font-bold text-[#1f2937]">{product.name}</h3>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${getStatusBadgeClass(status.tone)}`}>
                {status.label}
              </span>
            </div>
            <p className="mt-1 text-xs font-semibold text-[#6b7280]">{product.notes}</p>
            <div className={`mt-1 w-fit rounded-full px-2 py-1 text-[10px] font-bold uppercase ${getStatusBadgeClass(status.tone)}`}>
              {status.reason}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {product.variants.slice(0, 3).map((variant) => (
                <span key={variant.id || variant.size} className={`rounded-full px-2 py-1 text-[10px] font-bold ${variant.stock > 0 && variant.stock <= 5 ? 'bg-rose-50 text-rose-700' : 'bg-editorial-ivory text-editorial-charcoal'}`}>
                  {variant.size}: {variant.stock}
                </span>
              ))}
            </div>
            <p className="mt-1 text-[10px] font-bold uppercase text-amber-700">{product.category} / {product.price} / total {product.stock}</p>
            <p className="mt-1 break-all text-[10px] font-bold uppercase text-[#8b949e]">{publicPath || 'Slug belum tersedia'}</p>
            {formulaId ? (
              <button
                type="button"
                onClick={() => onOpenBatch(formulaId)}
                className="mobile-interactive mobile-pressable mt-2 text-[10px] font-bold uppercase text-editorial-charcoal"
              >
                View source batch
              </button>
            ) : null}
            {batchDetails.movement ? (
              <div className="mt-1 text-[10px] font-bold uppercase text-[#6b7280]">
                {batchDetails.movement} / initial {batchDetails.initialStock || 0}
              </div>
            ) : null}
            {batchDetails.sku ? (
              <div className="mt-1 break-all text-[10px] font-bold uppercase text-[#6b7280]">
                SKU {batchDetails.sku}
              </div>
            ) : null}
            {batchDetails.batchCode ? (
              <div className="mt-1 break-all text-[10px] font-bold uppercase text-[#6b7280]">
                Batch {batchDetails.batchCode}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-2xl bg-white" onClick={() => onPreview(product)} disabled={!canOpenPublic} aria-label={`Preview ${product.name}`}><ExternalLink className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-2xl bg-white" onClick={() => onCopyLink(product)} disabled={!canOpenPublic} aria-label={`Salin link ${product.name}`}><Copy className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-2xl bg-white" onClick={() => onEdit(product)} aria-label={`Edit ${product.name}`}><Edit3 className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => onDelete(product)} aria-label={`Hapus ${product.name}`}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </article>
  );
};

const MobileProductListPage = () => {
  const navigate = useNavigate();
  const products = useCatalogProducts();
  const customProducts = useMemo(() => products.filter((product) => product.source === 'custom'), [products]);
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

  const editProduct = (product) => navigate(`/mobile/studio/products/${product.id}/edit`);
  const openSourceBatch = (formulaId) => navigate(`/mobile/batches?formulaId=${encodeURIComponent(formulaId)}`);

  const copyProductLink = async (product) => {
    const path = getProductStorefrontPath(product, { mobile: true });
    const copied = await copyTextToClipboard(`${window.location.origin}${path}`);
    toast[copied ? 'success' : 'error'](copied ? 'Link produk disalin' : 'Link belum bisa disalin');
  };

  const previewProduct = (product) => {
    const path = getProductStorefrontPath(product, { mobile: true });
    if (!path) {
      toast.error('Slug produk belum tersedia');
      return;
    }
    navigate(path);
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Hapus produk "${product.name || product.id}"?`)) return;
    try {
      await deleteCustomProduct(product.id);
      toast.success('Produk dihapus');
    } catch (error) {
      toast.error(error.message || 'Gagal menghapus produk');
    }
  };

  return (
    <MobileAuthenticatedLayout taskMode>
      <Helmet>
        <title>Produk - Solivagant</title>
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title="Produk" subtitle={`${products.length} item katalog`} eyebrow="Admin Studio" action={<PackagePlus className="h-5 w-5 text-amber-700" />} />

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" className="h-11 rounded-2xl gap-2" onClick={() => navigate('/mobile/studio/products/new')}>
            <Plus className="h-4 w-4" />
            Tambah produk
          </Button>
          <Button type="button" variant="outline" className="h-11 rounded-2xl gap-2 bg-white" onClick={() => navigate('/mobile/studio/product-categories')}>
            <Tags className="h-4 w-4" />
            Kategori
          </Button>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Daftar produk</h2>
            <span className="text-xs font-bold text-amber-700">{filteredCustomProducts.length} / {customProducts.length} produk</span>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {productStatusFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setProductStatusFilter(filter.key)}
                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-2xl border px-3 text-[11px] font-bold ${productStatusFilter === filter.key ? 'border-editorial-charcoal bg-editorial-charcoal text-white' : 'border-[#e5e7eb] bg-white text-[#344054]'}`}
              >
                {filter.key === 'all' ? <Filter className="h-3.5 w-3.5" /> : null}
                {filter.label}
                <span className={productStatusFilter === filter.key ? 'text-white/75' : 'text-[#8b949e]'}>{productStatusCounts[filter.key] || 0}</span>
              </button>
            ))}
          </div>
          {filteredCustomProducts.map((product) => (
            <ProductListCard
              key={product.id}
              product={product}
              onCopyLink={copyProductLink}
              onDelete={handleDelete}
              onEdit={editProduct}
              onOpenBatch={openSourceBatch}
              onPreview={previewProduct}
            />
          ))}
          {!customProducts.length ? (
            <div className="mobile-card p-5 text-center">
              <h3 className="font-bold text-[#1f2937]">Belum ada produk custom</h3>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">Ketuk "Tambah produk" untuk menerbitkannya ke katalog.</p>
            </div>
          ) : null}
          {customProducts.length && !filteredCustomProducts.length ? (
            <div className="mobile-card p-5 text-center">
              <h3 className="font-bold text-[#1f2937]">Tidak ada produk di status ini</h3>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">Pilih filter lain untuk melihat produk custom.</p>
            </div>
          ) : null}
        </section>
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileProductListPage;
