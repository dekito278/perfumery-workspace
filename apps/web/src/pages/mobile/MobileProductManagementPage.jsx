import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Copy, Edit3, ExternalLink, Filter, ImageOff, ImagePlus, PackagePlus, Plus, Save, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileAccordion from '@/components/mobile-ui/MobileAccordion.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';
import {
  deleteCustomProduct,
  formatRupiah,
  getProductBatchDetails,
  getProductFormulaId,
  getProductPublishChecklist,
  getProductPublishStatus,
  getProductSlugConflicts,
  getProductStorefrontPath,
  getVisibleProductTags,
  isProductDraft,
  normalizeProduct,
  PRODUCT_DRAFT_TAG,
  saveCustomProduct,
} from '@/services/productCatalogService.js';
import { uploadProductImage } from '@/services/productImageStorageService.js';
import { deleteStorefrontCategory, saveStorefrontCategory } from '@/services/storefrontCategoryService.js';
import { copyTextToClipboard } from '@/utils/clipboard.js';
import { formatQuantity } from '@/utils/formatting.js';

const emptyProduct = {
  name: '',
  category: '',
  priceNumber: 289000,
  compareAtPriceNumber: 0,
  stock: 10,
  size: '30 ml',
  variants: [
    { id: '10-ml', size: '10 ml', priceNumber: 129000, compareAtPriceNumber: 0, stock: 5 },
    { id: '30-ml', size: '30 ml', priceNumber: 289000, compareAtPriceNumber: 0, stock: 10 },
  ],
  notes: '',
  topNotes: '',
  heartNotes: '',
  baseNotes: '',
  tags: '',
  description: '',
  imageUrl: '',
  images: [],
  featured: true,
  catalogVisible: true,
};

const toProductForm = (product) => ({
  ...product,
  catalogVisible: !isProductDraft(product),
  topNotes: product.topNotes.join(', '),
  heartNotes: product.heartNotes.join(', '),
  baseNotes: product.baseNotes.join(', '),
  variants: product.variants,
  tags: getVisibleProductTags(product).join(', '),
  images: product.images || (product.imageUrl ? [product.imageUrl] : []),
});

const getTagsForVisibility = (tags, catalogVisible) => {
  const nextTags = String(tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => tag.toLowerCase() !== PRODUCT_DRAFT_TAG.toLowerCase());

  if (!catalogVisible) {
    nextTags.unshift(PRODUCT_DRAFT_TAG);
  }

  return [...new Set(nextTags)];
};

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

const snapshotProductForm = (product) => JSON.stringify({
  id: product.id || '',
  name: product.name || '',
  category: product.category || '',
  priceNumber: Number(product.priceNumber || 0),
  compareAtPriceNumber: Number(product.compareAtPriceNumber || 0),
  stock: Number(product.stock || 0),
  size: product.size || '',
  variants: product.variants || [],
  notes: product.notes || '',
  topNotes: product.topNotes || '',
  heartNotes: product.heartNotes || '',
  baseNotes: product.baseNotes || '',
  tags: product.tags || '',
  description: product.description || '',
  imageUrl: product.imageUrl || '',
  images: product.images || [],
  featured: Boolean(product.featured),
  catalogVisible: Boolean(product.catalogVisible),
});

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
                <span key={variant.id || variant.size} className={`rounded-full px-2 py-1 text-[10px] font-bold ${variant.stock > 0 && variant.stock <= 5 ? 'bg-rose-50 text-rose-700' : 'bg-[#f7f1e5] text-[#1b1a16]'}`}>
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
                className="mobile-interactive mobile-pressable mt-2 text-[10px] font-bold uppercase text-[#1b1a16]"
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

const ProductFormSection = ({ children, eyebrow, title, description, action, defaultOpen = false }) => (
  <MobileAccordion
    title={eyebrow ? `${title} · ${eyebrow}` : title}
    meta={description}
    defaultOpen={defaultOpen}
  >
    <div className="grid gap-3">
      {action ? <div className="flex justify-end">{action}</div> : null}
      {children}
    </div>
  </MobileAccordion>
);

const ProductInputLabel = ({ children }) => (
  <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8b949e]">{children}</label>
);

const MobileProductManagementPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeView = searchParams.get('view') || 'new';
  const products = useCatalogProducts();
  const categories = useStorefrontCategories(products);
  const customProducts = useMemo(() => products.filter((product) => product.source === 'custom'), [products]);
  const categoryUsage = useMemo(() => products.reduce((usage, product) => {
    if (!product.category) return usage;
    usage.set(product.category.toLowerCase(), (usage.get(product.category.toLowerCase()) || 0) + 1);
    return usage;
  }, new Map()), [products]);
  const [form, setForm] = useState(emptyProduct);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [productStatusFilter, setProductStatusFilter] = useState('all');
  const [savedFormSnapshot, setSavedFormSnapshot] = useState(() => snapshotProductForm(emptyProduct));
  const editProductId = searchParams.get('edit') || '';
  const linkedFormulaId = getProductFormulaId(form);
  const batchDetails = getProductBatchDetails(form);
  const totalVariantStock = (form.variants || []).reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
  const primaryVariantPrice = Number(form.variants?.[0]?.priceNumber || form.priceNumber || 0);
  const requiredReady = Boolean(form.name.trim() && form.category.trim() && form.notes.trim());
  const publishChecklist = useMemo(() => getProductPublishChecklist(form), [form]);
  const canPublish = publishChecklist.ready;
  const currentFormSnapshot = useMemo(() => snapshotProductForm(form), [form]);
  const hasUnsavedChanges = currentFormSnapshot !== savedFormSnapshot;
  const slugConflicts = useMemo(() => getProductSlugConflicts(form, products), [form, products]);
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

  useEffect(() => {
    if (!editProductId) return;
    const product = customProducts.find((item) => String(item.id) === editProductId);
    if (product && form.id !== product.id) {
      const nextForm = toProductForm(product);
      setForm(nextForm);
      setSavedFormSnapshot(snapshotProductForm(nextForm));
    }
  }, [customProducts, editProductId, form.id]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const confirmDiscardChanges = () => (
    !hasUnsavedChanges || window.confirm('Ada perubahan produk yang belum disimpan. Lanjut dan buang perubahan?')
  );

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateVariant = (index, key, value) => setForm((current) => ({
    ...current,
    variants: current.variants.map((variant, variantIndex) => (
      variantIndex === index ? { ...variant, [key]: ['priceNumber', 'compareAtPriceNumber', 'stock'].includes(key) ? Number(value) : value } : variant
    )),
  }));
  const addVariant = () => setForm((current) => ({
    ...current,
    variants: [...current.variants, { id: `variant-${Date.now()}`, size: '50 ml', priceNumber: current.priceNumber, compareAtPriceNumber: current.compareAtPriceNumber || 0, stock: 0 }],
  }));
  const removeVariant = (index) => setForm((current) => ({
    ...current,
    variants: current.variants.filter((_, variantIndex) => variantIndex !== index),
  }));
  const updateView = (view, { force = false } = {}) => {
    if (!force && activeView === 'new' && view !== 'new' && !confirmDiscardChanges()) return;
    setSearchParams(view === 'new' ? {} : { view }, { replace: true });
  };
  const resetForm = () => {
    if (!confirmDiscardChanges()) return;
    setForm(emptyProduct);
    setSavedFormSnapshot(snapshotProductForm(emptyProduct));
    updateView('new', { force: true });
  };

  const updateImagesFromText = (value) => {
    const images = value.split('\n').map((item) => item.trim()).filter(Boolean);
    setForm((current) => ({ ...current, images, imageUrl: images[0] || '' }));
  };
  const removeImage = (imageUrl) => setForm((current) => {
    const images = (current.images || []).filter((image) => image !== imageUrl);
    return { ...current, images, imageUrl: images[0] || '' };
  });

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    setUploadingImage(true);
    try {
      const uploadedImages = await Promise.all(files.map((file) => uploadProductImage(file, form.name)));
      setForm((current) => {
        const images = [...new Set([...(current.images || []), ...uploadedImages])];
        return { ...current, images, imageUrl: images[0] || '' };
      });
      toast.success(files.length > 1 ? 'Gambar produk diupload' : 'Gambar produk diupload');
    } catch (error) {
      toast.error(error.message || 'Gagal upload gambar produk');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    if (savingProduct) {
      return;
    }
    if (!form.name.trim() || !form.category.trim() || !form.notes.trim()) {
      toast.error('Nama, kategori, dan ringkasan wajib diisi');
      return;
    }
    if (form.catalogVisible && !publishChecklist.ready) {
      toast.error(`Produk belum siap publish: ${publishChecklist.blocking[0]?.message || 'lengkapi data wajib.'}`);
      return;
    }
    setSavingProduct(true);
    try {
      const primaryVariantPrice = Number(form.variants?.[0]?.priceNumber || form.priceNumber || 0);
      const product = await saveCustomProduct({
        ...form,
        priceNumber: primaryVariantPrice,
        compareAtPriceNumber: Number(form.variants?.[0]?.compareAtPriceNumber || 0),
        stock: form.variants?.reduce((sum, variant) => sum + Number(variant.stock || 0), 0) || Number(form.stock || 0),
        size: form.variants?.[0]?.size || form.size,
        price: formatRupiah(primaryVariantPrice),
        tags: getTagsForVisibility(form.tags, form.catalogVisible),
      });
      const nextForm = toProductForm(product);
      setForm(nextForm);
      setSavedFormSnapshot(snapshotProductForm(nextForm));
      toast.success(form.catalogVisible ? 'Produk tersimpan dan tampil di katalog' : 'Produk tersimpan sebagai draft');
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan produk');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleEdit = (product) => {
    if (!confirmDiscardChanges()) return;
    const nextForm = toProductForm(product);
    setForm(nextForm);
    setSavedFormSnapshot(snapshotProductForm(nextForm));
    setSearchParams({ view: 'new', edit: product.id }, { replace: true });
  };

  const openSourceBatch = (formulaId) => {
    navigate(`/mobile/batches?formulaId=${encodeURIComponent(formulaId)}`);
  };

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

  const previewCurrentProduct = () => {
    if (hasUnsavedChanges && !window.confirm('Preview akan membuka halaman produk memakai data form saat ini. Perubahan belum tersimpan tetap belum masuk katalog. Lanjut preview?')) {
      return;
    }
    const primaryVariantPrice = Number(form.variants?.[0]?.priceNumber || form.priceNumber || 0);
    const preview = normalizeProduct({
      ...form,
      priceNumber: primaryVariantPrice,
      compareAtPriceNumber: Number(form.variants?.[0]?.compareAtPriceNumber || 0),
      stock: form.variants?.reduce((sum, variant) => sum + Number(variant.stock || 0), 0) || Number(form.stock || 0),
      size: form.variants?.[0]?.size || form.size,
      price: formatRupiah(primaryVariantPrice),
      tags: getTagsForVisibility(form.tags, form.catalogVisible),
    }, products);
    navigate(getProductStorefrontPath(preview, { mobile: true }), {
      state: {
        previewProduct: preview,
        previewMode: true,
        previewBackTo: '/mobile/studio/products?view=new',
      },
    });
  };

  const handleDelete = async (product) => {
    try {
      await deleteCustomProduct(product.id);
      if (form.id === product.id) resetForm();
      toast.success('Produk dihapus');
    } catch (error) {
      toast.error(error.message || 'Gagal menghapus produk');
    }
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error('Nama kategori wajib diisi');
      return;
    }
    setSavingCategory(true);
    try {
      const category = await saveStorefrontCategory(categoryForm);
      setCategoryForm({ name: '', description: '' });
      if (!form.category) {
        updateField('category', category.name);
      }
      toast.success('Kategori tersimpan');
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan kategori');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleCategoryDelete = async (category) => {
    try {
      await deleteStorefrontCategory(category.id);
      if (form.category === category.name) {
        updateField('category', '');
      }
      toast.success('Kategori dihapus');
    } catch (error) {
      toast.error(error.message || 'Gagal menghapus kategori');
    }
  };

  return (
    <MobileAuthenticatedLayout taskMode>
      <Helmet>
        <title>Produk - Solivagant</title>
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title="Produk" subtitle={`${products.length} item katalog`} eyebrow="Admin Studio" action={<PackagePlus className="h-5 w-5 text-amber-700" />} />

        <section className="mobile-card p-2">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#fffaf0] p-1">
            {[
              ['new', 'Tambah'],
              ['list', 'Daftar'],
              ['categories', 'Kategori'],
            ].map(([view, label]) => (
              <button
                key={view}
                type="button"
                onClick={() => updateView(view)}
                className={`h-10 rounded-xl text-[11px] font-bold transition ${activeView === view ? 'bg-white text-[#1b1a16] shadow-sm' : 'text-[#7a8377]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {activeView === 'new' ? (
        <form id="mobile-product-form" onSubmit={handleSubmit} className="space-y-4">
          <section className="mobile-soft-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">{form.id ? 'Edit produk' : 'Produk baru'}</div>
                <h1 className="mt-1 text-2xl font-bold text-[#1b1a16]">{form.name || 'Buat item katalog'}</h1>
                {hasUnsavedChanges ? (
                  <div className="mt-2 w-fit rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-700">Belum disimpan</div>
                ) : null}
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">
                  Isi bagian penting dulu, lalu lengkapi visual dan cerita produk sebelum tampil di katalog.
                </p>
              </div>
              <div className="grid shrink-0 gap-2">
                <Button type="button" variant="outline" className="h-10 rounded-2xl bg-white px-3 text-xs gap-1" onClick={previewCurrentProduct}><ExternalLink className="h-3.5 w-3.5" />Preview</Button>
                <Button type="button" variant="outline" className="h-10 rounded-2xl bg-white px-3 text-xs" onClick={resetForm}>Baru</Button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Harga</div>
                <div className="mt-1 truncate text-xs font-bold text-[#1b1a16]">{formatRupiah(primaryVariantPrice)}</div>
              </div>
              <div className="rounded-2xl bg-white px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Stok</div>
                <div className="mt-1 truncate text-xs font-bold text-[#1b1a16]">{totalVariantStock || Number(form.stock || 0)}</div>
              </div>
              <div className="rounded-2xl bg-white px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Status</div>
                <div className={`mt-1 truncate text-xs font-bold ${form.catalogVisible && canPublish ? 'text-emerald-700' : 'text-amber-700'}`}>{form.catalogVisible ? (canPublish ? 'Live' : 'Belum siap') : 'Draf'}</div>
              </div>
            </div>
          </section>

          {(linkedFormulaId || batchDetails.batchKey) ? (
          <ProductFormSection
            eyebrow="Sumber"
            title="Sumber batch Studio"
            description="Produk ini berasal dari batch/formula studio. Gunakan konteks ini sebelum mengubah stok atau harga."
          >
            {linkedFormulaId ? (
              <button
                type="button"
                onClick={() => navigate(`/mobile/batches?formulaId=${encodeURIComponent(linkedFormulaId)}`)}
                className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-left text-xs font-bold text-amber-800"
              >
                <span className="block text-[10px] uppercase">Sumber batch Studio</span>
                <span className="mt-0.5 block text-[#1f2937]">Buka kalkulator batch terkait</span>
              </button>
            ) : null}
            {batchDetails.batchKey ? (
              <div className="rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#6b7280]">Sumber stok</div>
                    <h3 className="mt-1 text-sm font-bold text-[#1f2937]">{batchDetails.movement || 'Batch masuk stok'}</h3>
                  </div>
                  {batchDetails.publishedAt ? (
                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#6b7280]">
                      {new Date(batchDetails.publishedAt).toLocaleDateString('id-ID')}
                    </span>
                  ) : null}
                </div>
                {batchDetails.sku ? (
                  <div className="mt-3 rounded-xl bg-white px-3 py-2">
                    <div className="text-[10px] font-bold uppercase text-[#8b949e]">SKU</div>
                    <div className="mt-1 break-all text-xs font-bold text-[#1f2937]">{batchDetails.sku}</div>
                  </div>
                ) : null}
                {batchDetails.batchCode ? (
                  <div className="mt-2 rounded-xl bg-white px-3 py-2">
                    <div className="text-[10px] font-bold uppercase text-[#8b949e]">Batch sumber</div>
                    <div className="mt-1 break-all text-xs font-bold text-[#1f2937]">{batchDetails.batchCode}</div>
                  </div>
                ) : null}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <div className="text-[10px] font-bold uppercase text-[#8b949e]">Batch</div>
                    <div className="mt-1 text-xs font-bold text-[#1f2937]">{formatQuantity(batchDetails.targetMl, 0)} ml</div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <div className="text-[10px] font-bold uppercase text-[#8b949e]">Terpakai</div>
                    <div className="mt-1 text-xs font-bold text-[#1f2937]">{formatQuantity(batchDetails.usableMl || batchDetails.targetMl, 0)} ml</div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <div className="text-[10px] font-bold uppercase text-[#8b949e]">Botol</div>
                    <div className="mt-1 text-xs font-bold text-[#1f2937]">{formatQuantity(batchDetails.bottleMl, 0)} ml</div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <div className="text-[10px] font-bold uppercase text-[#8b949e]">Dilution</div>
                    <div className="mt-1 text-xs font-bold text-[#1f2937]">{formatQuantity(batchDetails.dilutionPercent, 1)}%</div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <div className="text-[10px] font-bold uppercase text-[#8b949e]">Susut</div>
                    <div className="mt-1 text-xs font-bold text-[#1f2937]">{formatQuantity(batchDetails.lossPercent, 1)}%</div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <div className="text-[10px] font-bold uppercase text-[#8b949e]">COGS/bottle</div>
                    <div className="mt-1 text-xs font-bold text-[#1f2937]">{formatRupiah(batchDetails.cogsPerBottle)}</div>
                  </div>
                </div>
                <div className="mt-2 text-[10px] font-bold uppercase text-[#1b1a16]">
                  Stok awal {batchDetails.initialStock || 0} botol
                </div>
              </div>
            ) : null}
          </ProductFormSection>
          ) : null}

          <ProductFormSection
            eyebrow="Utama"
            title="Identitas"
            description="Nama, kategori, dan ringkasan adalah field wajib untuk menyimpan produk."
            defaultOpen
          >
            <div className="grid gap-1.5">
              <ProductInputLabel>Nama produk</ProductInputLabel>
              <input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Nama produk" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            </div>
            <div className="grid gap-1.5">
              <ProductInputLabel>Kategori</ProductInputLabel>
              <select value={form.category} onChange={(event) => updateField('category', event.target.value)} className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300">
                <option value="">Kategori</option>
                {categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
                {form.category && !categories.some((category) => category.name === form.category) ? <option value={form.category}>{form.category}</option> : null}
              </select>
            </div>
            <div className="grid gap-1.5">
              <ProductInputLabel>Ringkasan notes</ProductInputLabel>
              <input value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Ringkasan singkat katalog" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            </div>
          </ProductFormSection>

          <ProductFormSection
            eyebrow="Commercial"
            title="Varian, harga, dan stok"
            description="Varian pertama dipakai sebagai harga utama di katalog. Total stok dihitung dari semua varian."
            action={<Button type="button" variant="outline" className="h-10 rounded-2xl bg-white gap-1 px-3 text-xs" onClick={addVariant}><Plus className="h-4 w-4" />Tambah</Button>}
          >
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3">
              <div className="grid gap-1.5">
                <ProductInputLabel>Harga dasar</ProductInputLabel>
                <input type="number" value={form.priceNumber} onChange={(event) => updateField('priceNumber', Number(event.target.value))} className="h-11 rounded-xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
              </div>
              <div className="grid gap-1.5">
                <ProductInputLabel>Harga coret</ProductInputLabel>
                <input type="number" value={form.compareAtPriceNumber || 0} onChange={(event) => updateField('compareAtPriceNumber', Number(event.target.value))} placeholder="Harga coret" className="h-11 rounded-xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
              </div>
              <div className="grid gap-1.5">
                <ProductInputLabel>Stok dasar</ProductInputLabel>
                <input type="number" value={form.stock} onChange={(event) => updateField('stock', Number(event.target.value))} className="h-11 rounded-xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
              </div>
              <div className="grid gap-1.5">
                <ProductInputLabel>Ukuran dasar</ProductInputLabel>
                <input value={form.size} onChange={(event) => updateField('size', event.target.value)} placeholder="30 ml" className="h-11 rounded-xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
              </div>
            </div>
            <div className="grid gap-2">
                {(form.variants || []).map((variant, index) => (
                  <div key={variant.id || index} className="grid grid-cols-2 gap-2 rounded-2xl border bg-white p-2">
                    <input value={variant.size} onChange={(event) => updateVariant(index, 'size', event.target.value)} placeholder="30 ml" className="h-10 rounded-xl border px-2 text-xs font-semibold outline-none focus:border-amber-300" />
                    <input type="number" value={variant.priceNumber} onChange={(event) => updateVariant(index, 'priceNumber', event.target.value)} placeholder="Harga" className="h-10 rounded-xl border px-2 text-xs font-semibold outline-none focus:border-amber-300" />
                    <input type="number" value={variant.compareAtPriceNumber || 0} onChange={(event) => updateVariant(index, 'compareAtPriceNumber', event.target.value)} placeholder="Harga coret" className="h-10 rounded-xl border px-2 text-xs font-semibold outline-none focus:border-amber-300" />
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <input type="number" value={variant.stock} onChange={(event) => updateVariant(index, 'stock', event.target.value)} placeholder="Stok" className="h-10 rounded-xl border px-2 text-xs font-semibold outline-none focus:border-amber-300" />
                      <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => removeVariant(index)} disabled={(form.variants || []).length <= 1}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
            </div>
          </ProductFormSection>

          <ProductFormSection
            eyebrow="Media"
            title="Visual produk"
            description="Preview gambar utama, upload WebP ringan, atau paste URL gambar satu per baris."
          >
            <div className="rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] p-3">
              <ProductVisual product={{ ...form, category: form.category, size: form.size }} className="h-40" />
              <textarea value={(form.images || []).join('\n')} onChange={(event) => updateImagesFromText(event.target.value)} placeholder="URL gambar produk, satu per baris" rows={4} className="mt-3 w-full rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
              <label className="mt-2 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border bg-white px-3 text-xs font-bold">
                <ImagePlus className="h-4 w-4" />
                {uploadingImage ? 'Mengupload...' : 'Upload gambar'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={handleImageUpload} disabled={uploadingImage} />
              </label>
              {(form.images || []).length ? (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {form.images.map((image) => (
                    <div key={image} className="relative overflow-hidden rounded-2xl border bg-white">
                      <img src={image} alt="" className="h-14 w-full object-cover" loading="lazy" decoding="async" width="120" height="56" />
                      <button type="button" onClick={() => removeImage(image)} className="absolute right-1 top-1 grid h-7 w-7 min-h-0 place-items-center rounded-full bg-white/90 text-rose-700" aria-label="Hapus gambar">
                        <ImageOff className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-[#6b7280]">
                Upload otomatis dikompres ke WebP ringan sekitar 250 KB per gambar.
              </p>
            </div>
          </ProductFormSection>

          <ProductFormSection
            eyebrow="Story"
            title="Profil aroma dan deskripsi"
            description="Gunakan koma untuk memisahkan notes. Deskripsi dipakai sebagai copy katalog."
          >
            <input value={form.topNotes || ''} onChange={(event) => updateField('topNotes', event.target.value)} placeholder="Top notes, pisahkan dengan koma" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <input value={form.heartNotes || ''} onChange={(event) => updateField('heartNotes', event.target.value)} placeholder="Heart notes, pisahkan dengan koma" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <input value={form.baseNotes || ''} onChange={(event) => updateField('baseNotes', event.target.value)} placeholder="Base notes, pisahkan dengan koma" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Deskripsi" rows={3} className="rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
          </ProductFormSection>

          <ProductFormSection
            eyebrow="Publishing"
            title="Visibilitas katalog"
            description="Draft tetap tersimpan di studio tetapi tidak muncul di shop customer."
          >
            <div className={`rounded-2xl border p-3 ${canPublish ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <div className="flex items-start gap-2">
                {canPublish ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                <div className="min-w-0">
                  <div className="text-xs font-bold">{canPublish ? 'Siap publish ke katalog' : 'Belum siap tampil di katalog'}</div>
                  <p className="mt-1 text-[11px] font-semibold leading-relaxed opacity-80">
                    {canPublish
                      ? `Slug publik: /mobile/products/${publishChecklist.slug}`
                      : publishChecklist.blocking.map((item) => item.label).join(', ')}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {publishChecklist.items.map((item) => (
                  <div key={item.key} className={`rounded-xl px-2 py-1.5 text-[10px] font-bold ${item.ok ? 'bg-white/75 text-emerald-800' : item.required ? 'bg-white/75 text-amber-800' : 'bg-white/60 text-[#6b7280]'}`}>
                    {item.ok ? 'OK' : item.required ? 'Wajib' : 'Opsional'} · {item.label}
                  </div>
                ))}
              </div>
            </div>
            {slugConflicts.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">Slug sudah dipakai</div>
                    <p className="mt-1 text-[11px] font-semibold leading-relaxed opacity-80">
                      Bentrok dengan {slugConflicts.map((product) => product.name).join(', ')}. Saat disimpan, slug akan dibuat unik otomatis.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            <label className="flex items-center gap-3 rounded-2xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-800">
              <input type="checkbox" checked={Boolean(form.featured)} onChange={(event) => updateField('featured', event.target.checked)} />
              Featured di home
            </label>
            <label className={`flex items-start gap-3 rounded-2xl px-3 py-3 text-xs font-bold ${canPublish ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
              <input
                type="checkbox"
                checked={Boolean(form.catalogVisible)}
                onChange={(event) => {
                  if (event.target.checked && !canPublish) {
                    toast.error(`Belum bisa publish: ${publishChecklist.blocking[0]?.message || 'lengkapi data wajib.'}`);
                    updateField('catalogVisible', false);
                    return;
                  }
                  updateField('catalogVisible', event.target.checked);
                }}
                className="mt-0.5"
              />
              <span>
                <span className="block">Tampilkan di katalog customer</span>
                <span className="mt-0.5 block text-[10px] font-semibold opacity-75">{canPublish ? 'Produk akan langsung muncul di shop setelah disimpan.' : 'Lengkapi checklist dulu sebelum produk bisa dipublish.'}</span>
              </span>
            </label>
          </ProductFormSection>

          <StickyBottomActionBar fixed reserveSpace keyboardBehavior="stay" aria-label="Aksi form produk">
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={resetForm}>Baru</Button>
              <Button type="button" className="h-12 rounded-2xl gap-2" onClick={handleSubmit} disabled={savingProduct || !requiredReady}>
                <Save className="h-4 w-4" />
                {savingProduct ? 'Menyimpan...' : requiredReady ? 'Simpan produk' : 'Lengkapi wajib'}
              </Button>
            </div>
            <Button type="button" variant="outline" className="mt-2 h-11 w-full rounded-2xl bg-white gap-2 text-xs font-bold" onClick={previewCurrentProduct}>
              <ExternalLink className="h-4 w-4" />
              Preview draft
            </Button>
          </StickyBottomActionBar>
        </form>
        ) : null}

        {activeView === 'categories' ? (
        <section className="mobile-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#1f2937]">Kategori produk</h2>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">Buat kategori sendiri, lalu pilih di produk.</p>
            </div>
            <Tags className="h-5 w-5 text-amber-700" />
          </div>
          <form onSubmit={handleCategorySubmit} className="mt-3 grid gap-2">
            <input value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} placeholder="Limited, Regular, Gift set..." className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <input value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} placeholder="Deskripsi opsional" className="h-12 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300" />
            <Button type="submit" className="h-11 rounded-2xl" disabled={savingCategory}>{savingCategory ? 'Menyimpan...' : 'Tambah kategori'}</Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((category) => {
              const usageCount = categoryUsage.get(category.name.toLowerCase()) || 0;
              const canDelete = category.source !== 'product' && usageCount === 0;
              return (
                <span key={category.name} className="inline-flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-[#fbfaf7] px-3 py-2 text-[11px] font-bold text-[#344054]">
                  {category.name}
                  <span className="text-[10px] text-[#8b949e]">{usageCount}</span>
                  {canDelete ? (
                    <button type="button" onClick={() => handleCategoryDelete(category)} className="text-rose-600" aria-label={`Hapus ${category.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </span>
              );
            })}
          </div>
        </section>
        ) : null}

        {activeView === 'list' ? (
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
                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-2xl border px-3 text-[11px] font-bold ${productStatusFilter === filter.key ? 'border-[#1b1a16] bg-[#1b1a16] text-white' : 'border-[#e5e7eb] bg-white text-[#344054]'}`}
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
              onEdit={handleEdit}
              onOpenBatch={openSourceBatch}
              onPreview={previewProduct}
            />
          ))}
          {!customProducts.length ? (
            <div className="mobile-card p-5 text-center">
              <h3 className="font-bold text-[#1f2937]">Belum ada produk custom</h3>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">Simpan satu produk di atas untuk menerbitkannya ke katalog.</p>
            </div>
          ) : null}
          {customProducts.length && !filteredCustomProducts.length ? (
            <div className="mobile-card p-5 text-center">
              <h3 className="font-bold text-[#1f2937]">Tidak ada produk di status ini</h3>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">Pilih filter lain untuk melihat produk custom.</p>
            </div>
          ) : null}
        </section>
        ) : null}
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileProductManagementPage;

