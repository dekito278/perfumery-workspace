import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import WearPicker from '@/components/product/WearPicker.jsx';
import { saveProductWear } from '@/services/productCatalogService.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { describeWear, isWearTagged, normalizeWear } from '@/utils/productWear.js';

const sameWear = (a, b) => JSON.stringify(normalizeWear(a)) === JSON.stringify(normalizeWear(b));

// One page for the whole catalogue. Tagging eighteen bottles through eighteen edit pages is a chore that
// does not get done, and an untagged catalogue makes the wardrobe filter invisible — so the feature would
// have shipped and stayed dead. editableOnly keeps out the static seed products, which have no row to
// write to.
const ProductWearTagger = ({ compact = false }) => {
  const products = useCatalogProducts({ editableOnly: true });
  const loading = Boolean(products.loading) && !products.length;
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Seed from the server every time the catalogue reloads, but never overwrite a row the owner has
    // already touched — a background refresh must not silently undo tags they are in the middle of.
    setDraft((current) => {
      const next = { ...current };
      products.forEach((product) => {
        if (!(product.id in next)) next[product.id] = normalizeWear(product.wear);
      });
      return next;
    });
  }, [products]);

  const dirty = useMemo(() => products.filter((product) => (
    draft[product.id] && !sameWear(draft[product.id], product.wear)
  )), [draft, products]);

  const untagged = products.filter((product) => !isWearTagged(draft[product.id] ?? product.wear)).length;

  const saveAll = async () => {
    setSaving(true);
    const failures = [];
    // Sequential on purpose: a failure here is almost always the session, and firing eighteen requests at
    // a refused session just produces eighteen identical toasts.
    for (const product of dirty) {
      try {
        await saveProductWear(product.id, draft[product.id]);
      } catch (error) {
        failures.push(`${product.name}: ${error.message}`);
        break;
      }
    }
    setSaving(false);

    if (failures.length) {
      toast.error(failures[0]);
      return;
    }
    toast.success(`${dirty.length} produk ditandai`);
    window.dispatchEvent(new CustomEvent('dekito:products-updated'));
  };

  if (loading) {
    return <p className="text-sm font-semibold text-muted-foreground">Memuat produk...</p>;
  }

  if (!products.length) {
    return (
      <p className="text-sm font-semibold text-muted-foreground">
        Belum ada produk yang bisa ditandai. Kalau daftar produk biasanya terisi, sesi admin mungkin belum
        terverifikasi authenticator.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm font-semibold text-muted-foreground">
        {untagged
          ? `${untagged} dari ${products.length} produk belum ditandai. Produk tanpa tanda tidak pernah muncul di filter "pakai untuk momen apa" — bukan sebagai jawaban yang salah, tapi tidak muncul sama sekali.`
          : `Semua ${products.length} produk sudah ditandai.`}
      </p>

      <div className="grid gap-3">
        {products.map((product) => {
          const wear = draft[product.id] ?? normalizeWear(product.wear);
          const labels = describeWear(wear);
          const changed = draft[product.id] && !sameWear(draft[product.id], product.wear);
          return (
            <div
              key={product.id}
              className={`rounded-2xl border bg-white p-4 ${changed ? 'border-amber-300' : 'border-[#e5e7eb]'}`}
            >
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold text-editorial-charcoal">{product.name}</h2>
                <span className="text-xs font-semibold text-muted-foreground">
                  {labels.length ? labels.join(' · ') : 'Belum ditandai'}
                </span>
              </div>
              <WearPicker
                compact={compact}
                value={wear}
                onChange={(next) => setDraft((current) => ({ ...current, [product.id]: next }))}
              />
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 -mx-1 flex items-center gap-3 bg-editorial-paper/95 px-1 py-3 backdrop-blur">
        <Button type="button" disabled={!dirty.length || saving} onClick={saveAll}>
          {saving ? 'Menyimpan...' : dirty.length ? `Simpan ${dirty.length} perubahan` : 'Tidak ada perubahan'}
        </Button>
      </div>
    </div>
  );
};

export default ProductWearTagger;
