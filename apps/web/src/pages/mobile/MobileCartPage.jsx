import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Minus, PackageCheck, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import { useCart } from '@/hooks/useCart.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;

const MobileCartPage = () => {
  const navigate = useNavigate();
  const { items, summary, updateQuantity, removeItem } = useCart();
  const decreaseQuantity = (item) => item.quantity <= 1 ? removeItem(item.slug) : updateQuantity(item.slug, item.quantity - 1);

  return (
    <MobileCommerceLayout>
      <Helmet><title>Cart - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <section className="mobile-soft-card p-4">
          <div className="text-[10px] font-bold uppercase text-amber-700">Subtotal</div>
          <div className="mt-1 text-3xl font-bold text-[#1f2937]">{formatTotal(summary.subtotal)}</div>
          {items.length ? (
            <div className="mt-3 grid gap-2">
              {items.slice(0, 3).map((item) => (
                <div key={item.slug} className="flex items-center justify-between gap-3 rounded-2xl border border-[#263d27]/10 bg-white/70 px-3 py-2">
                  <div className="min-w-0"><p className="truncate text-xs font-bold">{item.name}</p><p className="mt-0.5 text-[10px] font-bold uppercase text-[#8b949e]">{item.size} / x{item.quantity}</p></div>
                  <span className="shrink-0 text-xs font-bold text-[#263d27]">{formatTotal(Number(item.priceNumber || 0) * Number(item.quantity || 0))}</span>
                </div>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-xs font-semibold text-[#6b7280]">Review item di sini, lalu lanjutkan ke halaman checkout untuk pengiriman dan pembayaran.</p>
          {items.length ? <Button type="button" className="mt-4 h-12 w-full rounded-2xl gap-2" onClick={() => navigate('/mobile/checkout')}><PackageCheck className="h-4 w-4" />Lanjut checkout</Button> : null}
        </section>
        <section className="space-y-3">
          {items.map((item) => (
            <article key={item.slug} className="mobile-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h2 className="truncate text-sm font-bold">{item.name}</h2><p className="mt-1 text-xs font-semibold text-[#6b7280]">{item.notes}</p><p className="mt-1 text-[10px] font-bold uppercase text-amber-700">{item.price} / {item.size}</p></div>
                <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0 rounded-2xl border-rose-200 bg-rose-50 text-rose-700" onClick={() => removeItem(item.slug)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-2xl bg-white" onClick={() => decreaseQuantity(item)}><Minus className="h-4 w-4" /></Button>
                <span className="grid h-10 min-w-12 place-items-center rounded-2xl bg-[#f8f7f4] text-sm font-bold">{item.quantity}</span>
                <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-2xl bg-white" onClick={() => updateQuantity(item.slug, item.quantity + 1)}><Plus className="h-4 w-4" /></Button>
              </div>
            </article>
          ))}
          {!items.length ? <StateBlock className="mobile-card" icon={ShoppingBag} title="Keranjang kosong" description="Pilih parfum dari katalog untuk mulai checkout." action="Buka katalog" onAction={() => navigate('/mobile/catalog')} /> : null}
        </section>
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileCartPage;
