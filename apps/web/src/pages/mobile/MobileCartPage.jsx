import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgePercent, Minus, PackageCheck, Plus, ShoppingBag, Sparkles, Trash2, X } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCart } from '@/hooks/useCart.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import { getDiscountedVoucherCartLineMap } from '@/utils/cartVoucherPricing.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;

const MobileCartPage = () => {
  const navigate = useNavigate();
  const { items, summary, updateQuantity, removeItem } = useCart();
  const voucher = useAppliedVoucher(summary.subtotal, items);
  const discountedLineMap = getDiscountedVoucherCartLineMap(items, voucher.appliedVoucher || {}, voucher.discountAmount);
  const products = useCatalogProducts();
  const decreaseQuantity = (item) => item.quantity <= 1 ? removeItem(item.slug) : updateQuantity(item.slug, item.quantity - 1);
  // Lines whose product left the catalog or ran out of stock — checkout refuses them, so say so here
  // rather than at the end of the form (audit round 9).
  const unavailableItems = items.filter((item) => item.unavailable || item.outOfStock);
  const getCartItemProduct = (item) => {
    const product = products.find((entry) => entry.slug === item.productSlug || entry.slug === item.slug || entry.id === item.productId);
    return {
      ...(product || {}),
      ...item,
      id: product?.id || item.productId,
      slug: product?.slug || item.productSlug || item.slug,
      category: product?.category || item.category,
      images: product?.images,
      imageUrl: product?.imageUrl,
    };
  };
  const featuredCartItems = items.slice(0, 3).map((item) => ({ item, product: getCartItemProduct(item) }));
  const recommendedProducts = !items.length
    ? products.filter(isProductVisibleInStorefront).slice(0, 4)
    : [];

  return (
    <MobileCommerceLayout>
      <Helmet><title>Keranjang - Solivagant</title></Helmet>
      <main className="mobile-page mobile-cart-page" style={{ background: 'var(--editorial-paper)' }}>
        <section style={{ padding: '20px 16px', borderBottom: '1px solid var(--editorial-stone)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 86px', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--editorial-brass)' }}>
                {items.length ? 'Subtotal' : 'Keranjang'}
              </div>
              <div style={{ marginTop: 4, fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.15, color: 'var(--editorial-charcoal)', fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {items.length ? formatTotal(voucher.subtotalAfterDiscount) : 'Mulai belanja'}
              </div>
              {items.length && voucher.discountAmount ? (
                <div style={{ marginTop: 4, fontSize: '0.72rem', fontWeight: 600, color: 'var(--editorial-charcoal)' }}>Hemat {formatTotal(voucher.discountAmount)}</div>
              ) : null}
              <p style={{ marginTop: 8, fontSize: '0.78rem', lineHeight: 1.6, color: 'var(--editorial-muted)' }}>
                {items.length ? 'Cek item di sini, lalu lanjutkan untuk isi pengiriman dan pembayaran.' : 'Pilih parfum ready stock atau mulai request aroma custom.'}
              </p>
            </div>
            {featuredCartItems[0] ? (
              <ProductVisual
                product={featuredCartItems[0].product}
                className="h-[86px] rounded-[12px]"
                label={false}
                priority
                sizes="86px"
              />
            ) : (
              <div style={{ height: 86, display: 'grid', placeItems: 'center', borderRadius: 12, border: '1px solid var(--editorial-stone)', background: 'var(--editorial-ivory)', color: 'var(--editorial-muted)' }}>
                <ShoppingBag style={{ width: 24, height: 24 }} />
              </div>
            )}
          </div>
          {items.length ? (
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              {featuredCartItems.map(({ item, product }) => (
                <div key={item.slug} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--editorial-ivory)', borderRadius: 10, padding: '8px 12px' }}>
                  <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8 }}>
                    <ProductVisual product={product} className="h-10 w-10 shrink-0 rounded-[8px]" label={false} sizes="40px" />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--editorial-charcoal)' }}>{item.name}</p>
                      <p style={{ marginTop: 2, fontSize: '0.65rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--editorial-muted)' }}>{item.size} / x{item.quantity}</p>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    {discountedLineMap.get(item.slug)?.discount ? (
                      <div style={{ fontSize: '0.65rem', fontWeight: 500, color: '#9ca3af', textDecoration: 'line-through' }}>{formatTotal(discountedLineMap.get(item.slug).originalTotal)}</div>
                    ) : null}
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--editorial-charcoal)' }}>{formatTotal(discountedLineMap.get(item.slug)?.discountedTotal ?? Number(item.priceNumber || 0) * Number(item.quantity || 0))}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {items.length ? (
            <Button type="button" className="mt-4 h-12 w-full rounded-xl gap-2" style={{ background: 'var(--editorial-charcoal)', color: 'var(--editorial-paper)' }} onClick={() => navigate('/mobile/checkout')}><PackageCheck className="h-4 w-4" />Lanjut bayar</Button>
          ) : (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Button type="button" className="h-11 rounded-xl gap-2" style={{ background: 'var(--editorial-charcoal)', color: 'var(--editorial-paper)' }} onClick={() => navigate('/mobile/catalog')}>
                <ShoppingBag className="h-4 w-4" />
                Belanja
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-xl gap-2" style={{ borderColor: 'var(--editorial-stone)', background: 'var(--editorial-paper)', color: 'var(--editorial-charcoal)' }} onClick={() => navigate('/mobile/bespoke')}>
                Custom
              </Button>
            </div>
          )}
        </section>
        {items.length ? (
          <section style={{ padding: '16px', borderBottom: '1px solid var(--editorial-stone)' }}>
            <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
              <span style={{ display: 'grid', height: 36, width: 36, flexShrink: 0, placeItems: 'center', borderRadius: 10, background: 'var(--editorial-ivory)', color: 'var(--editorial-brass)' }}>
                <BadgePercent style={{ width: 16, height: 16 }} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--editorial-charcoal)' }}>Voucher</h2>
                <p style={{ marginTop: 4, fontSize: '0.72rem', lineHeight: 1.5, color: 'var(--editorial-muted)' }}>Masukkan kode promo sebelum lanjut checkout.</p>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8 }}>
              <input
                value={voucher.inputCode}
                onChange={(event) => voucher.setInputCode(event.target.value.toUpperCase())}
                placeholder="Kode voucher"
                style={{ height: 48, padding: '0 12px', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', border: '1px solid var(--editorial-stone)', borderRadius: 10, background: 'var(--editorial-ivory)', color: 'var(--editorial-charcoal)', outline: 'none' }}
              />
              <Button type="button" variant="outline" className="h-12 rounded-xl px-4 text-xs font-bold" style={{ borderColor: 'var(--editorial-stone)', color: 'var(--editorial-charcoal)' }} onClick={voucher.applyVoucher}>Pakai</Button>
            </div>
            {voucher.appliedVoucher ? (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 10, border: '1px solid var(--editorial-stone)', background: 'var(--editorial-ivory)', padding: '8px 12px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--editorial-charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{voucher.appliedVoucher.code} diterapkan</div>
                  <div style={{ marginTop: 2, fontSize: '0.72rem', fontWeight: 500, color: 'var(--editorial-charcoal)' }}>Hemat {formatTotal(voucher.discountAmount)}</div>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-lg" style={{ color: 'var(--editorial-muted)' }} onClick={voucher.removeVoucher} aria-label="Hapus voucher">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : voucher.message ? (
              <p style={{ marginTop: 8, borderRadius: 10, background: 'var(--editorial-ivory)', padding: '8px 12px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--editorial-brass)' }}>{voucher.message}</p>
            ) : null}
          </section>
        ) : null}
        {unavailableItems.length ? (
          <p role="alert" style={{ margin: '0 16px 8px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', padding: '8px 12px', fontSize: '0.72rem', fontWeight: 700, color: '#b91c1c' }}>
            {unavailableItems.map((item) => item.name).join(', ')} sudah tidak tersedia. Hapus dari keranjang untuk lanjut checkout.
          </p>
        ) : null}
        <section style={{ display: 'grid', gap: 0 }}>
          {items.map((item) => {
            const discountedLine = discountedLineMap.get(item.slug);
            const hasLineDiscount = Boolean(discountedLine?.discount);

            return (
            <article key={item.slug} style={{ padding: '16px', borderBottom: '1px solid var(--editorial-stone)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '76px minmax(0,1fr) 42px', alignItems: 'start', gap: 12 }}>
                <ProductVisual product={getCartItemProduct(item)} className="h-[76px] rounded-[10px]" label={false} sizes="76px" />
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.3, color: 'var(--editorial-charcoal)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.name}</h2>
                  <p style={{ marginTop: 4, fontSize: '0.78rem', lineHeight: 1.4, color: 'var(--editorial-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.notes}</p>
                  <p style={{ marginTop: 4, fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--editorial-brass)' }}>{item.price} / {item.size}</p>
                  {hasLineDiscount ? (
                    <p style={{ marginTop: 4, fontSize: '0.72rem', fontWeight: 600, color: 'var(--editorial-charcoal)' }}>
                      Setelah voucher: {formatTotal(discountedLine.discountedUnitPrice)} / item
                    </p>
                  ) : null}
                </div>
                <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0 rounded-[10px]" style={{ borderColor: 'var(--editorial-stone)', background: 'var(--editorial-paper)', color: 'var(--editorial-muted)' }} onClick={() => removeItem(item.slug)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 10, border: '1px solid var(--editorial-stone)', background: 'var(--editorial-paper)', padding: 4 }}>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => decreaseQuantity(item)}><Minus className="h-4 w-4" /></Button>
                  <span style={{ display: 'grid', height: 32, minWidth: 40, placeItems: 'center', fontSize: '0.875rem', fontWeight: 600 }}>{item.quantity}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => updateQuantity(item.slug, item.quantity + 1)}><Plus className="h-4 w-4" /></Button>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {hasLineDiscount ? (
                    <div style={{ fontSize: '0.72rem', fontWeight: 500, color: '#9ca3af', textDecoration: 'line-through' }}>{formatTotal(discountedLine.originalTotal)}</div>
                  ) : null}
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--editorial-charcoal)' }}>{formatTotal(discountedLine?.discountedTotal ?? Number(item.priceNumber || 0) * Number(item.quantity || 0))}</div>
                  {hasLineDiscount ? (
                    <div style={{ marginTop: 2, fontSize: '0.65rem', fontWeight: 600, color: 'var(--editorial-charcoal)' }}>-{formatTotal(discountedLine.discount)}</div>
                  ) : null}
                </div>
              </div>
            </article>
            );
          })}
          {!items.length ? (
            <section style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ display: 'grid', placeItems: 'center', padding: '24px 0' }}>
                <ShoppingBag style={{ width: 32, height: 32, color: 'var(--editorial-stone)', marginBottom: 12 }} />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--editorial-charcoal)', fontFamily: 'Georgia, "Times New Roman", serif' }}>Keranjang kosong</h2>
                <p style={{ marginTop: 6, fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--editorial-muted)', maxWidth: 260 }}>
                  Pilih parfum ready stock, mulai custom, atau lihat rekomendasi di bawah.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                <Button type="button" variant="outline" className="h-11 rounded-xl gap-2" style={{ borderColor: 'var(--editorial-stone)', color: 'var(--editorial-charcoal)' }} onClick={() => navigate('/mobile/bespoke')}>
                  <Sparkles className="h-4 w-4" />
                  Mulai custom
                </Button>
                <Button type="button" className="h-11 rounded-xl gap-2" style={{ background: 'var(--editorial-charcoal)', color: 'var(--editorial-paper)' }} onClick={() => navigate('/mobile/catalog')}>
                  <ShoppingBag className="h-4 w-4" />
                  Buka katalog
                </Button>
              </div>
              {recommendedProducts.length ? (
                <div style={{ marginTop: 24, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--editorial-charcoal)' }}>Rekomendasi</h2>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--editorial-brass)' }}>Ready stock</span>
                  </div>
                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {recommendedProducts.map((product) => (
                      <button
                        key={product.id || product.slug}
                        type="button"
                        onClick={() => navigate(`/mobile/products/${product.slug}`)}
                        style={{ minWidth: 0, padding: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <ProductVisual product={product} className="h-28 rounded-[10px]" label={false} sizes="44vw" />
                        <div style={{ marginTop: 8, minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.3, color: 'var(--editorial-charcoal)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{product.name}</div>
                          <div style={{ marginTop: 4, fontSize: '0.72rem', fontWeight: 500, color: 'var(--editorial-muted)' }}>{product.price}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </section>
        {items.length ? (
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px' }}>
            <button type="button" onClick={() => navigate('/mobile/catalog')} style={{ display: 'flex', minHeight: 78, flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--editorial-stone)', borderRadius: 12, padding: 14, background: 'var(--editorial-ivory)', cursor: 'pointer', textAlign: 'left' }}>
              <ShoppingBag style={{ width: 16, height: 16, color: 'var(--editorial-muted)' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.3, color: 'var(--editorial-charcoal)' }}>Tambah aroma</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--editorial-brass)' }}>Katalog <ArrowRight style={{ width: 12, height: 12 }} /></span>
            </button>
            <button type="button" onClick={() => navigate('/mobile/bespoke')} style={{ display: 'flex', minHeight: 78, flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--editorial-stone)', borderRadius: 12, padding: 14, background: 'var(--editorial-ivory)', cursor: 'pointer', textAlign: 'left' }}>
              <Sparkles style={{ width: 16, height: 16, color: 'var(--editorial-muted)' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.3, color: 'var(--editorial-charcoal)' }}>Custom aroma</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--editorial-brass)' }}>Brief <ArrowRight style={{ width: 12, height: 12 }} /></span>
            </button>
          </section>
        ) : null}
        {items.length ? (
          <StickyBottomActionBar
            fixed
            reserveSpace
            aria-label="Aksi keranjang"
            className="mobile-cart-action-bar"
            contentClassName="rounded-xl"
            style={{ borderColor: 'var(--editorial-stone)' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 12, background: 'rgba(255,250,240,0.97)', borderRadius: 12, padding: '4px 4px 4px 12px' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--editorial-muted)' }}>{summary.quantity} item</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.2, color: 'var(--editorial-charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatTotal(voucher.subtotalAfterDiscount)}</p>
                {voucher.discountAmount ? <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--editorial-charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Hemat {formatTotal(voucher.discountAmount)}</p> : null}
              </div>
              <Button type="button" className="h-12 rounded-xl gap-2 px-4" style={{ background: 'var(--editorial-charcoal)', color: 'var(--editorial-paper)' }} onClick={() => navigate('/mobile/checkout')}>
                <PackageCheck className="h-4 w-4" />
                Lanjut bayar
              </Button>
            </div>
          </StickyBottomActionBar>
        ) : null}
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileCartPage;
