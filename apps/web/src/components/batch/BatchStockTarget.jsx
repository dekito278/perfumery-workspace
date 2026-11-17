import React, { useMemo } from 'react';
import { getProductFormulaId } from '@/services/productCatalogService.js';
import { isFreeVialProduct } from '@/utils/freeVial.js';
import { matchingVariantId, restockCandidates } from '@/utils/batchRestock.js';

export const NEW_PRODUCT = 'new';
export const RESTOCK = 'restock';

const fieldClass = 'h-11 w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 text-xs font-bold outline-none focus:border-amber-300';

/**
 * Where a finished batch's bottles go (17 Nov 2026): a new draft product, as before, or the stock of a
 * product that already exists. Shared by the laptop and phone batch screens so both offer the same choice.
 * `value` is { mode, productId, variantId }.
 */
const BatchStockTarget = ({ products = [], formulaId = '', bottleMl = 0, bottles = 0, value, onChange }) => {
  const candidates = useMemo(() => restockCandidates(products, {
    formulaId,
    formulaIdOf: getProductFormulaId,
    isGift: isFreeVialProduct,
  }), [products, formulaId]);
  const product = candidates.find((item) => item.id === value.productId) || null;
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const variant = variants.find((item) => String(item.id) === String(value.variantId)) || null;

  const pickProduct = (productId) => {
    const next = candidates.find((item) => item.id === productId);
    onChange({ mode: RESTOCK, productId, variantId: matchingVariantId(next?.variants, bottleMl) });
  };
  const pickMode = (mode) => {
    if (mode === NEW_PRODUCT) return onChange({ mode, productId: '', variantId: '' });
    const first = product || candidates[0];
    return onChange({ mode, productId: first?.id || '', variantId: first ? (value.variantId || matchingVariantId(first.variants, bottleMl)) : '' });
  };

  const choices = [
    { mode: NEW_PRODUCT, title: 'Produk baru', helper: 'Draf produk baru dari batch ini' },
    { mode: RESTOCK, title: 'Tambah stok', helper: 'Ke produk yang sudah ada' },
  ];

  return (
    <div className="mt-3 grid gap-2">
      <div role="radiogroup" aria-label="Stok batch ini masuk ke" className="grid grid-cols-2 gap-2">
        {choices.map((choice) => (
          <button
            key={choice.mode}
            type="button"
            role="radio"
            aria-checked={value.mode === choice.mode}
            onClick={() => pickMode(choice.mode)}
            disabled={choice.mode === RESTOCK && !candidates.length}
            className={`rounded-2xl border px-3 py-2 text-left disabled:opacity-50 ${value.mode === choice.mode ? 'border-editorial-charcoal bg-editorial-ivory' : 'border-[#e5e7eb] bg-white'}`}
          >
            <span className="block text-xs font-bold text-editorial-charcoal">{choice.title}</span>
            <span className="mt-0.5 block text-[10px] font-semibold text-[#6b7280]">{choice.helper}</span>
          </button>
        ))}
      </div>
      {value.mode === RESTOCK ? (
        <>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-[#6b7280]">Produk tujuan</span>
            <select value={value.productId} onChange={(event) => pickProduct(event.target.value)} className={fieldClass}>
              {candidates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{formulaId && String(getProductFormulaId(item)) === String(formulaId) ? ' (formula ini)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-[#6b7280]">Ukuran yang ditambah</span>
            <select value={value.variantId} onChange={(event) => onChange({ ...value, variantId: event.target.value })} className={fieldClass}>
              <option value="">Pilih ukuran</option>
              {variants.filter((item) => item && typeof item === 'object' && item.id).map((item) => (
                <option key={item.id} value={item.id}>{item.size} — stok {Number(item.stock || 0)}</option>
              ))}
            </select>
          </label>
          <p className="rounded-2xl bg-[#f8f7f4] px-3 py-2 text-[11px] font-semibold leading-relaxed text-[#6b7280]">
            {variant
              ? `Stok ${variant.size}: ${Number(variant.stock || 0)} → ${Number(variant.stock || 0) + bottles} botol. Harga, aroma, dan foto produk tidak berubah.`
              : 'Pilih ukuran yang mendapat stok. Harga, aroma, dan foto produk tidak berubah.'}
            {variant && bottleMl && matchingVariantId([variant], bottleMl) === '' ? ` Botol batch ${bottleMl} ml, ukuran ini ${variant.size} — pastikan benar.` : ''}
          </p>
        </>
      ) : null}
    </div>
  );
};

export default BatchStockTarget;
