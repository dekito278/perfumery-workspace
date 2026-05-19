import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, ChevronLeft, ChevronRight, PackagePlus, Search, SlidersHorizontal, Sparkles, WandSparkles } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import { catalogSortOptions } from '@/data/storefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useMobileRenderSectionMonitor } from '@/hooks/useMobileRenderSectionMonitor.js';
import { useStorefrontCategories } from '@/hooks/useStorefrontCategories.js';
import { cn } from '@/lib/utils.js';
import {
  formatRupiah,
  getProductLowStock,
  getVisibleProductTags,
  isProductVisibleInStorefront,
} from '@/services/productCatalogService.js';
import { getOptimizedProductImageUrl } from '@/services/productImageStorageService.js';
import { logMobileRenderIssue } from '@/utils/mobileRenderMonitoring.js';
import { getMobileFromState } from '@/hooks/useMobileBackNavigation.js';

const MOBILE_CATALOG_COLUMNS = 2;
const MOBILE_CATALOG_ESTIMATED_ROW_HEIGHT = 338;
const MOBILE_CATALOG_OVERSCAN_ROWS = 3;
const MOBILE_CATALOG_VIRTUALIZE_AFTER = 40;
const MOBILE_CATALOG_PAGE_SIZE = 6;
const commerceCategoryNames = new Set(['limited', 'regular', 'limited perfume', 'regular perfume', 'all']);
const shopTypeOptions = [
  { name: 'Semua', filter: 'all' },
  { name: 'Reguler', filter: 'regular' },
  { name: 'Terbatas', filter: 'limited' },
];

const catalogSkeletonItems = Array.from({ length: 6 }, (_, index) => `catalog-skeleton-${index}`);
const getProductCategoryLabel = (product) => product?.category || 'Solivagant';
const getProductStockLabel = (product) => (Number(product?.stock || 0) > 0 ? `${Number(product.stock)} pcs` : 'Habis');
const getProductSizeLabels = (product) => {
  const variantSizes = (product?.variants || []).map((variant) => variant?.size).filter(Boolean);
  return (variantSizes.length ? variantSizes : [product?.size || '30 ml']).slice(0, 2);
};
const getProductPrimaryTag = (product) => getVisibleProductTags(product).find(Boolean) || (product?.featured ? 'Pilihan' : 'Aroma khas');

const MobileCatalogCardSkeleton = () => (
  <article className="mobile-card mobile-catalog-card mobile-commerce-product-card min-w-0 overflow-hidden p-2" aria-hidden="true">
    <div className="mobile-catalog-skeleton aspect-[4/5] rounded-2xl" />
    <div className="mt-2 flex h-[148px] flex-col">
      <div className="mobile-catalog-skeleton h-[13px] w-11/12 rounded-full" />
      <div className="mobile-catalog-skeleton mt-2 h-[13px] w-4/5 rounded-full" />
      <div className="mobile-catalog-skeleton mt-2 h-[11px] w-3/4 rounded-full" />
      <div className="mt-3 grid h-8 grid-cols-[minmax(0,1fr)_52px] items-start gap-1.5">
        <div className="mobile-catalog-skeleton h-4 rounded-full" />
        <div className="mobile-catalog-skeleton h-6 rounded-full" />
      </div>
      <div className="mt-auto flex gap-1 pt-2">
        <div className="mobile-catalog-skeleton h-[22px] w-12 rounded-full" />
        <div className="mobile-catalog-skeleton h-[22px] w-10 rounded-full" />
      </div>
      <div className="mobile-catalog-skeleton mt-1.5 h-3 w-14 rounded-full" />
      <div className="mobile-catalog-skeleton mt-1.5 h-[21px] w-16 rounded-full" />
    </div>
  </article>
);

const sortProducts = (products, sort) => {
  const nextProducts = [...products];

  if (sort === 'price-low') return nextProducts.sort((a, b) => a.priceNumber - b.priceNumber);
  if (sort === 'price-high') return nextProducts.sort((a, b) => b.priceNumber - a.priceNumber);
  if (sort === 'name') return nextProducts.sort((a, b) => a.name.localeCompare(b.name));

  return nextProducts.sort((a, b) => Number(b.featured) - Number(a.featured) || b.popularity - a.popularity);
};

const getScrollParent = (element) => {
  if (typeof window === 'undefined' || !element) return null;

  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    const overflowY = window.getComputedStyle(parent).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent;
    }
    parent = parent.parentElement;
  }

  return window;
};

export const MobileCatalogContent = ({ active = true }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const deferredQuery = useDeferredValue(query);
  const [segment, setSegment] = useState(searchParams.get('segment') || 'all');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [sort, setSort] = useState(searchParams.get('sort') || 'featured');
  const [currentPage, setCurrentPage] = useState(1);
  const virtualListRef = useRef(null);
  const [virtualRowHeight, setVirtualRowHeight] = useState(MOBILE_CATALOG_ESTIMATED_ROW_HEIGHT);
  const [virtualRows, setVirtualRows] = useState({ start: 0, end: 8 });
  const catalogProducts = useCatalogProducts();
  const products = useMemo(() => catalogProducts.filter(isProductVisibleInStorefront), [catalogProducts]);
  const categories = useStorefrontCategories(products);
  const scentFamilies = useMemo(() => (
    categories.filter((item) => !commerceCategoryNames.has(String(item.name || '').toLowerCase()))
  ), [categories]);
  const catalogLoading = Boolean(catalogProducts.loading);
  const hasCatalogProducts = products.length > 0;
  const showCatalogSkeleton = catalogLoading && !hasCatalogProducts;

  useEffect(() => {
    if (!active || !searchParams.toString()) return;

    setQuery(searchParams.get('q') || '');
    setSegment(searchParams.get('segment') || 'all');
    setCategory(searchParams.get('category') || 'All');
    setSort(searchParams.get('sort') || 'featured');
  }, [active, searchParams]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const matchingProducts = products.filter((product) => {
      const matchesSegment = segment === 'all'
        || (segment === 'limited' && (product.featured || product.stock <= 8))
        || (segment === 'regular' && !product.featured && product.stock > 0);
      const matchesCategory = category === 'All' || product.category === category;
      const searchableText = [
        product.name,
        product.category,
        product.notes,
        product.mood,
        product.description,
        ...getVisibleProductTags(product),
      ].join(' ').toLowerCase();
      return matchesSegment && matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });

    return sortProducts(matchingProducts, sort);
  }, [category, deferredQuery, products, segment, sort]);
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / MOBILE_CATALOG_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProducts = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * MOBILE_CATALOG_PAGE_SIZE;
    return filteredProducts.slice(startIndex, startIndex + MOBILE_CATALOG_PAGE_SIZE);
  }, [filteredProducts, safeCurrentPage]);
  const shouldVirtualizeCatalog = paginatedProducts.length > MOBILE_CATALOG_VIRTUALIZE_AFTER;
  const totalVirtualRows = Math.ceil(paginatedProducts.length / MOBILE_CATALOG_COLUMNS);
  const virtualStartRow = shouldVirtualizeCatalog ? Math.min(virtualRows.start, Math.max(totalVirtualRows - 1, 0)) : 0;
  const virtualEndRow = shouldVirtualizeCatalog ? Math.min(Math.max(virtualRows.end, virtualStartRow + 1), totalVirtualRows) : totalVirtualRows;
  const virtualStartIndex = virtualStartRow * MOBILE_CATALOG_COLUMNS;
  const virtualEndIndex = virtualEndRow * MOBILE_CATALOG_COLUMNS;
  const virtualProducts = useMemo(() => (
    shouldVirtualizeCatalog ? paginatedProducts.slice(virtualStartIndex, virtualEndIndex) : paginatedProducts
  ), [paginatedProducts, shouldVirtualizeCatalog, virtualEndIndex, virtualStartIndex]);
  const activeSortLabel = catalogSortOptions.find((option) => option.value === sort)?.label || 'Rekomendasi';
  const activeFilterCount = [segment !== 'all', category !== 'All', Boolean(deferredQuery.trim())].filter(Boolean).length;
  const activeSegmentLabel = shopTypeOptions.find((option) => option.filter === segment)?.name || 'Semua';
  const firstVisibleProductImage = String(paginatedProducts[0]?.images?.[0] || filteredProducts[0]?.images?.[0] || paginatedProducts[0]?.imageUrl || filteredProducts[0]?.imageUrl || '').trim();
  const firstVisibleProductPreload = getOptimizedProductImageUrl(firstVisibleProductImage, 720);
  const virtualPaddingTop = shouldVirtualizeCatalog ? virtualStartRow * virtualRowHeight : 0;
  const virtualPaddingBottom = shouldVirtualizeCatalog ? Math.max(totalVirtualRows - virtualEndRow, 0) * virtualRowHeight : 0;

  useMobileRenderSectionMonitor({
    active,
    loading: catalogLoading,
    section: 'mobile-catalog-products',
    visibleCount: filteredProducts.length,
    expectedCount: products.length,
    reason: products.length ? 'filters-empty' : 'no-products',
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [category, deferredQuery, segment, sort]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const syncVirtualRows = useCallback(() => {
    if (!active) return;
    if (!shouldVirtualizeCatalog) {
      setVirtualRows((current) => (
        current.start === 0 && current.end === totalVirtualRows
          ? current
          : { start: 0, end: totalVirtualRows }
      ));
      return;
    }

    const list = virtualListRef.current;
    if (!list || !filteredProducts.length) {
      setVirtualRows({ start: 0, end: 8 });
      return;
    }

    const rect = list.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height || window.innerHeight || 844;
    const beforeViewport = Math.max(0, -rect.top);
    const afterTop = Math.max(0, viewportHeight - rect.top);
    const firstRow = Math.max(0, Math.floor(beforeViewport / virtualRowHeight) - MOBILE_CATALOG_OVERSCAN_ROWS);
    const lastRow = Math.min(
      totalVirtualRows,
      Math.ceil(afterTop / virtualRowHeight) + MOBILE_CATALOG_OVERSCAN_ROWS
    );

    setVirtualRows((current) => (
      current.start === firstRow && current.end === lastRow
        ? current
        : { start: firstRow, end: Math.max(lastRow, firstRow + 1) }
    ));
  }, [active, filteredProducts.length, shouldVirtualizeCatalog, totalVirtualRows, virtualRowHeight]);

  useEffect(() => {
    if (!active) return undefined;

    setVirtualRows({ start: 0, end: 8 });
    requestAnimationFrame(syncVirtualRows);
    return undefined;
  }, [active, category, deferredQuery, segment, shouldVirtualizeCatalog, sort, syncVirtualRows]);

  useEffect(() => {
    if (!active) return undefined;

    const list = virtualListRef.current;
    if (!list) return undefined;

    const measureCard = () => {
      const card = list.querySelector('.mobile-catalog-card');
      if (!card) return;
      const nextHeight = Math.ceil(card.getBoundingClientRect().height + 10);
      if (nextHeight > 0) {
        setVirtualRowHeight((current) => (Math.abs(current - nextHeight) > 4 ? nextHeight : current));
      }
    };

    measureCard();
    const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(measureCard) : null;
    const firstCard = list.querySelector('.mobile-catalog-card');
    if (resizeObserver && firstCard) {
      resizeObserver.observe(firstCard);
    }

    return () => resizeObserver?.disconnect();
  }, [active, shouldVirtualizeCatalog, virtualProducts.length]);

  useEffect(() => {
    if (!active) return undefined;

    syncVirtualRows();

    const list = virtualListRef.current;
    const scrollParent = getScrollParent(list);
    const handleScroll = () => requestAnimationFrame(syncVirtualRows);

    window.addEventListener('resize', handleScroll);
    window.visualViewport?.addEventListener('resize', handleScroll);
    scrollParent?.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('resize', handleScroll);
      window.visualViewport?.removeEventListener('resize', handleScroll);
      scrollParent?.removeEventListener('scroll', handleScroll);
    };
  }, [active, syncVirtualRows]);

  const updateFilters = (next) => {
    const updated = {
      q: next.query ?? query,
      segment: next.segment ?? segment,
      category: next.category ?? category,
      sort: next.sort ?? sort,
    };
    setQuery(updated.q);
    setSegment(updated.segment);
    setCategory(updated.category);
    setSort(updated.sort);
    setCurrentPage(1);

    const params = new URLSearchParams();
    if (updated.q.trim()) params.set('q', updated.q.trim());
    if (updated.segment !== 'all') params.set('segment', updated.segment);
    if (updated.category !== 'All') params.set('category', updated.category);
    if (updated.sort !== 'featured') params.set('sort', updated.sort);
    setSearchParams(params, { replace: true });
  };

  return (
    <>
      {active ? (
      <Helmet>
        <title>Katalog - Solivagant</title>
        <meta name="description" content="Browse Solivagant products by category, price, and scent profile." />
        {firstVisibleProductPreload ? <link rel="preload" as="image" href={firstVisibleProductPreload} /> : null}
      </Helmet>
      ) : null}
      <main className="mobile-page">
        <section className="mobile-sticky-search">
          <div className="mobile-card overflow-hidden p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-amber-700">
                <Sparkles className="h-3.5 w-3.5" />
                Belanja
              </div>
              <h1 className="mt-0.5 text-lg font-bold leading-tight text-[#0b130c]">Cari parfum</h1>
            </div>
            <span className="mobile-commerce-chip shrink-0 px-2.5 py-1 text-[10px] uppercase">
              {filteredProducts.length} item
            </span>
          </div>
          <label className="mobile-commerce-control mt-3 flex h-12 items-center gap-2 bg-[#f7f8f2] px-3">
            <Search className="h-4 w-4 text-[#8b949e]" />
            <input
              type="search"
              value={query}
              onChange={(event) => updateFilters({ query: event.target.value })}
              placeholder="Cari notes, mood, produk"
              className="min-h-0 flex-1 bg-transparent text-sm font-semibold text-[#0b130c] outline-none placeholder:text-[#9ca3af]"
            />
          </label>
          {hasCatalogProducts ? (
            <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-[14px] bg-[#f7f8f2] p-1">
              {shopTypeOptions.map((item) => (
                <button
                  key={item.filter}
                  type="button"
                  onClick={() => updateFilters({ segment: item.filter })}
                  style={{ minHeight: 38 }}
                  className={cn(
                    'h-[38px] rounded-[12px] px-2 py-1 text-[11px] font-bold leading-tight transition',
                    segment === item.filter
                      ? 'bg-[#263d27] text-white shadow-sm'
                      : 'text-[#7a8377]'
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          ) : showCatalogSkeleton ? (
            <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-[14px] bg-[#f7f8f2] p-1" aria-hidden="true">
              <div className="mobile-catalog-skeleton h-[38px] rounded-[12px]" />
              <div className="mobile-catalog-skeleton h-[38px] rounded-[12px]" />
              <div className="mobile-catalog-skeleton h-[38px] rounded-[12px]" />
            </div>
          ) : null}
          </div>
        </section>

        {hasCatalogProducts && scentFamilies.length ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="text-[10px] font-bold uppercase text-[#6b7280]">Aroma</div>
            <div className="text-[10px] font-bold uppercase text-amber-700">Geser</div>
          </div>
          <div className="mobile-shop-filter-frame">
          <div className="mobile-shop-filter-rail mobile-segment-scroll flex gap-2 overflow-x-auto" aria-label="Filter aroma katalog">
            {['All', ...scentFamilies.map((item) => item.name)].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => updateFilters({ category: item })}
                className={cn(
                  'mobile-shop-filter-chip shrink-0 rounded-full border px-3 text-xs font-bold transition',
                  category === item
                    ? 'border-[#263d27] bg-[#263d27] text-white shadow-sm'
                    : 'border-[#263d27]/10 bg-white text-[#667264]'
                )}
              >
                  {item === 'All' ? 'Semua' : item}
              </button>
            ))}
          </div>
          </div>
        </section>
        ) : showCatalogSkeleton ? (
        <section className="space-y-2" aria-hidden="true">
          <div className="flex items-center justify-between px-1">
            <div className="mobile-catalog-skeleton h-3 w-24 rounded-full" />
            <div className="mobile-catalog-skeleton h-3 w-14 rounded-full" />
          </div>
          <div className="flex h-14 gap-5 overflow-hidden pb-2 pl-1 pr-4">
            <div className="mobile-catalog-skeleton h-8 w-16 shrink-0 rounded-full" />
            <div className="mobile-catalog-skeleton h-8 w-20 shrink-0 rounded-full" />
            <div className="mobile-catalog-skeleton h-8 w-14 shrink-0 rounded-full" />
            <div className="mobile-catalog-skeleton h-8 w-16 shrink-0 rounded-full" />
          </div>
        </section>
        ) : null}

        {hasCatalogProducts ? (
        <section className="mobile-card p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-[#6b7280]">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filter & urutkan
              </div>
              <div className="mt-1 truncate text-xs font-bold text-[#0b130c]">{activeSegmentLabel} {category !== 'All' ? `/ ${category}` : ''} / {activeSortLabel}</div>
            </div>
            <div className="shrink-0 text-[10px] font-bold uppercase text-amber-700">Geser</div>
            {activeFilterCount ? (
              <Button type="button" variant="outline" onClick={() => updateFilters({ query: '', segment: 'all', category: 'All', sort: 'featured' })} className="h-9 shrink-0 rounded-xl bg-white px-3 text-[11px] font-bold">
                Reset
              </Button>
            ) : null}
          </div>
          <div className="mt-3 mobile-shop-filter-frame">
          <div className="mobile-shop-filter-rail mobile-segment-scroll flex items-center gap-2 overflow-x-auto" aria-label="Urutkan katalog">
            <span className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#f7f8f2] px-3 text-[10px] font-bold uppercase text-[#6b7280]">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Urutkan
            </span>
            {catalogSortOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateFilters({ sort: option.value })}
                className={cn(
                  'mobile-shop-filter-chip shrink-0 rounded-[12px] border px-3 text-[11px] font-bold transition',
                  sort === option.value
                    ? 'border-[#263d27] bg-[#263d27] text-white shadow-sm'
                    : 'border-[#e5e7eb] bg-white text-[#6b7280]'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          </div>
        </section>
        ) : showCatalogSkeleton ? (
        <section className="mobile-card p-3" aria-hidden="true">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mobile-catalog-skeleton h-3 w-24 rounded-full" />
              <div className="mobile-catalog-skeleton mt-2 h-4 w-32 rounded-full" />
              <div className="mobile-catalog-skeleton mt-2 h-3 w-44 rounded-full" />
            </div>
            <div className="mobile-catalog-skeleton h-9 w-16 rounded-xl" />
          </div>
          <div className="mt-3 flex gap-2 overflow-hidden pb-1">
            <div className="mobile-catalog-skeleton h-9 w-16 shrink-0 rounded-xl" />
            <div className="mobile-catalog-skeleton h-9 w-20 shrink-0 rounded-xl" />
            <div className="mobile-catalog-skeleton h-9 w-24 shrink-0 rounded-xl" />
            <div className="mobile-catalog-skeleton h-9 w-20 shrink-0 rounded-xl" />
          </div>
        </section>
        ) : null}

        <section ref={virtualListRef} aria-busy={showCatalogSkeleton ? 'true' : undefined}>
          {showCatalogSkeleton ? (
            <div className="grid grid-cols-2 gap-2.5">
              {catalogSkeletonItems.map((item) => <MobileCatalogCardSkeleton key={item} />)}
            </div>
          ) : null}
          {!showCatalogSkeleton && filteredProducts.length ? (
            <>
              <div aria-hidden="true" style={{ height: virtualPaddingTop }} />
              <div className="grid grid-cols-2 gap-3">
                {virtualProducts.map((product, index) => {
                  const absoluteIndex = virtualStartIndex + index;

                  return (
                    <article key={product.id} className="mobile-card mobile-catalog-card mobile-commerce-product-card min-w-0 overflow-hidden p-2">
                      <button type="button" onClick={() => navigate(`/mobile/products/${product.slug}`, { state: getMobileFromState(location) })} className="block w-full text-left">
                        <div className="relative">
                          <ProductVisual
                            product={product}
                            className="aspect-[4/5] rounded-2xl mobile-catalog-visual"
                            bottleClassName="left-4 top-4 h-16 w-8 rounded-[1rem]"
                            label={false}
                            priority={absoluteIndex === 0}
                            sizes="(max-width: 448px) 44vw, 198px"
                            imageFit="cover"
                          />
                          <div className="mobile-commerce-chip absolute left-2 top-2 max-w-[calc(100%-16px)] truncate bg-white/90 px-2 py-1 text-[9px] uppercase shadow-sm">
                            {getProductCategoryLabel(product)}
                          </div>
                          <div className="absolute bottom-2 left-2 max-w-[calc(100%-16px)] truncate rounded-full bg-[#263d27] px-2 py-1 text-[9px] font-bold uppercase text-white shadow-sm">
                            {product.featured ? 'Pilihan' : getProductPrimaryTag(product)}
                          </div>
                        </div>
                        <div className="mt-2 flex h-[148px] flex-col">
                          <div className="h-[58px] min-w-0">
                            <h3 className="mobile-line-clamp-2 min-h-[32px] text-[13px] font-bold leading-tight text-[#0b130c]">{product.name}</h3>
                            <p className="mobile-line-clamp-2 mt-1 min-h-[24px] text-[11px] font-semibold leading-snug text-[#6b7280]">{product.notes || product.mood || getProductCategoryLabel(product)}</p>
                          </div>
                          <div className="mt-2 grid h-8 grid-cols-[minmax(0,1fr)_58px] items-start gap-1.5">
                            <div className="min-w-0">
                              <div className={cn('h-3 text-[10px] font-bold leading-3 text-[#9ca3af] line-through', product.compareAtPriceNumber > product.priceNumber ? '' : 'invisible')}>
                                {product.compareAtPriceNumber > product.priceNumber ? formatRupiah(product.compareAtPriceNumber) : 'Rp 0'}
                              </div>
                              <div className="truncate text-sm font-bold text-[#0b130c]">{product.price}</div>
                            </div>
                            <div className={cn('grid h-6 w-[58px] place-items-center rounded-full px-1.5 text-center text-[9px] font-bold leading-tight', getProductLowStock(product) ? 'bg-rose-50 text-rose-700' : 'bg-[#f7f8f2] text-[#6b7280]')}>
                              {getProductStockLabel(product)}
                            </div>
                          </div>
                          <div className="mt-auto pt-2">
                            <div className="flex h-[24px] flex-wrap gap-1 overflow-hidden">
                              {getProductSizeLabels(product).map((size) => (
                                <span key={size} className="mobile-commerce-chip max-w-full truncate px-2 py-1 text-[9px]">{size}</span>
                              ))}
                            </div>
                            <div className="mt-1.5 flex h-[21px] flex-wrap gap-1 overflow-hidden">
                              <span className="mobile-commerce-muted-chip max-w-full truncate px-2 py-1 text-[9px] uppercase">
                                {getProductPrimaryTag(product)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    </article>
                  );
                })}
              </div>
              <div aria-hidden="true" style={{ height: virtualPaddingBottom }} />
              {filteredProducts.length > MOBILE_CATALOG_PAGE_SIZE ? (
                <div className="mobile-card mt-3 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                      disabled={safeCurrentPage === 1}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#263d27]/12 bg-white text-[#263d27] disabled:opacity-40"
                      aria-label="Produk sebelumnya"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="min-w-0 text-center">
                      <div className="text-[10px] font-bold uppercase text-[#6b7280]">
                        {((safeCurrentPage - 1) * MOBILE_CATALOG_PAGE_SIZE) + 1}-{Math.min(safeCurrentPage * MOBILE_CATALOG_PAGE_SIZE, filteredProducts.length)} dari {filteredProducts.length}
                      </div>
                      <div className="mt-0.5 text-xs font-bold text-[#0b130c]">Halaman {safeCurrentPage} / {totalPages}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                      disabled={safeCurrentPage === totalPages}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#263d27]/12 bg-white text-[#263d27] disabled:opacity-40"
                      aria-label="Produk berikutnya"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {!showCatalogSkeleton && !filteredProducts.length ? (
            <div className="mobile-card col-span-2 overflow-hidden text-center">
              <div className="bg-[#050705] p-5 text-[#eef2e8]">
                <img
                  src="/brand/solivagant-logo.png"
                  alt="Solivagant"
                  className="mx-auto h-14 w-40 rounded-2xl object-contain"
                  loading="lazy"
                  decoding="async"
                  width="160"
                  height="56"
                  onError={() => logMobileRenderIssue('image-load-failed', { source: 'catalog-empty-logo' })}
                />
                <h3 className="mt-5 text-lg font-bold">
                  {catalogLoading ? 'Memuat koleksi parfum' : hasCatalogProducts ? 'Produk tidak ditemukan' : 'Belum ada parfum tersedia'}
                </h3>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#cbd6c5]">
                  {catalogLoading
                    ? 'Sebentar, kami sedang mengambil daftar parfum terbaru.'
                    : hasCatalogProducts
                    ? 'Coba kategori atau kata kunci aroma lain.'
                    : 'Produk publik akan tampil setelah ditambahkan dari Studio. Pembeli tetap bisa mulai dari request custom.'}
                </p>
              </div>
              {!catalogLoading ? (
              <div className="grid grid-cols-2 gap-2 p-3">
                {hasCatalogProducts ? (
                  <Button className="rounded-2xl" onClick={() => updateFilters({ query: '', segment: 'all', category: 'All', sort: 'featured' })}>
                    Reset filter
                  </Button>
                ) : (
                  <Button className="rounded-2xl gap-2" onClick={() => navigate('/mobile/login')}>
                    Tambah produk
                    <PackagePlus className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => navigate('/mobile/bespoke')}>
                  Custom
                  <WandSparkles className="h-4 w-4" />
                </Button>
              </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
};

const MobileCatalogPage = () => {
  return (
    <MobileCommerceLayout>
      <MobileCatalogContent />
    </MobileCommerceLayout>
  );
};

export default MobileCatalogPage;
