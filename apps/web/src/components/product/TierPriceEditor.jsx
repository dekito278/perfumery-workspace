import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Save } from 'lucide-react';
import LocalizedNumberInput from '@/components/LocalizedNumberInput.jsx';
import { Button } from '@/components/ui/button.jsx';
import { listTierPricesForProduct, saveTierPrice } from '@/services/tierPricingService.js';
import { formatRupiah } from '@/services/productCatalogService.js';

// Retail is deliberately absent: it stays on the product itself, so there is never a second copy of it
// to drift. Empty here means "no tier price", which falls back to retail — see src/utils/tierPrice.js.
const EDITABLE_TIERS = [
  { key: 'member', label: 'Member' },
  { key: 'reseller', label: 'Reseller' },
  { key: 'overseas', label: 'Luar negeri' },
];

const cellKey = (variantId, tier) => `${variantId}|${tier}`;
const asCellValue = (price) => (Number(price) > 0 ? Number(price) : '');

const buildCells = (rows) => {
  const cells = {};
  for (const row of rows) {
    cells[cellKey(String(row.variant_id ?? ''), String(row.tier || ''))] = asCellValue(row.price_number);
  }
  return cells;
};

/**
 * Tier prices for one product. Saved straight to the tier table, not through the product form's own
 * submit — the product row does not carry these, and a value that looks saved but is not is the exact
 * trap this repo keeps hitting.
 *
 * The schema is applied by hand, so it may not exist yet. On the storefront that has to be silent
 * (retail is a correct answer); here it has to be loud, or the owner fills in member prices that do
 * nothing at all.
 */
const TierPriceEditor = ({ productId = '', variants = [], compact = false }) => {
  const [saved, setSaved] = useState({});
  const [draft, setDraft] = useState({});
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!productId) {
      setSaved({});
      setDraft({});
      return undefined;
    }
    let mounted = true;
    setLoading(true);
    listTierPricesForProduct(productId)
      .then(({ rows, schemaReady: ready }) => {
        if (!mounted) return;
        const cells = buildCells(rows);
        setSaved(cells);
        setDraft(cells);
        setSchemaReady(ready);
        setLoadError('');
      })
      .catch((error) => {
        if (mounted) setLoadError(error.message || 'Harga bertingkat gagal dimuat');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [productId]);

  // Row '' applies to every size; a row with a variant id overrides it for that size only. Same merge
  // the order endpoint does, so what is shown here is what a buyer is charged.
  //
  // With a single size those two rows mean the same bottle, so only one is drawn — and it is the '' row,
  // labelled with the size. That keeps anything already saved visible instead of hiding a price that is
  // still being applied, and it stops the form asking the same question twice.
  const rows = useMemo(() => {
    const sizes = variants.map((variant) => ({
      id: String(variant.id || ''),
      label: variant.size || variant.id || 'Varian',
      retail: Number(variant.priceNumber || 0),
    })).filter((row) => row.id);

    if (sizes.length <= 1) {
      return [{ id: '', label: sizes[0]?.label || 'Semua ukuran', retail: sizes[0]?.retail || 0 }];
    }
    return [{ id: '', label: 'Semua ukuran', retail: 0 }, ...sizes];
  }, [variants]);

  const dirtyKeys = useMemo(
    () => Object.keys({ ...saved, ...draft }).filter((key) => (draft[key] ?? '') !== (saved[key] ?? '')),
    [saved, draft],
  );

  const setCell = (variantId, tier, value) => setDraft((current) => ({
    ...current,
    [cellKey(variantId, tier)]: value === '' ? '' : Number(value),
  }));

  const handleSave = async () => {
    setSaving(true);
    const failures = [];
    for (const key of dirtyKeys) {
      const [variantId, tier] = key.split('|');
      try {
        await saveTierPrice({ productId, variantId, tier, priceNumber: draft[key] === '' ? 0 : draft[key] });
      } catch (error) {
        failures.push(`${tier}: ${error.message || 'gagal'}`);
      }
    }
    try {
      const { rows: freshRows, schemaReady: ready } = await listTierPricesForProduct(productId);
      const cells = buildCells(freshRows);
      setSaved(cells);
      setDraft(cells);
      setSchemaReady(ready);
    } catch (error) {
      // Reading back is how we know what actually landed. If that read fails we cannot claim anything.
      failures.push(error.message || 'gagal membaca ulang harga bertingkat');
    }
    setSaving(false);

    if (failures.length) toast.error(`Sebagian harga bertingkat tidak tersimpan — ${failures[0]}`);
    else toast.success('Harga bertingkat tersimpan');
  };

  if (!productId) {
    return (
      <p className="rounded-2xl border border-dashed bg-[#fbfaf7] p-3 text-xs font-semibold text-muted-foreground">
        Simpan produknya dulu, lalu harga member, reseller, dan luar negeri bisa diisi di sini.
      </p>
    );
  }

  const disabled = !schemaReady || loading || saving;
  const inputClass = compact
    ? 'h-10 w-full rounded-xl border px-2 text-xs font-semibold outline-none focus:border-amber-300 disabled:bg-[#f3f1ec]'
    : 'h-10 w-full rounded-xl border px-3 text-sm font-semibold outline-none focus:border-amber-300 disabled:bg-[#f3f1ec]';

  return (
    <div className="grid gap-3">
      {!schemaReady ? (
        <div role="alert" className="flex gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="text-xs font-semibold text-amber-900">
            Tabel harga bertingkat belum ada di database. Jalankan migrasi
            <code className="mx-1 rounded bg-white/70 px-1">20260913090000_customer_tiers_and_tier_prices.sql</code>
            dulu. Sampai itu dijalankan, semua pembeli tetap dikenakan harga retail dan apa pun yang diisi
            di sini tidak akan tersimpan.
          </div>
        </div>
      ) : null}
      {loadError ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{loadError}</div>
      ) : null}

      <div className="grid gap-2">
        {rows.map((row) => (
          <div key={row.id || 'all'} className="rounded-2xl border bg-white p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-bold uppercase text-editorial-charcoal">{row.label}</span>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {row.retail ? `Retail ${formatRupiah(row.retail)}` : 'Dipakai untuk ukuran yang kosong di bawah'}
              </span>
            </div>
            <div className={`mt-2 grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
              {EDITABLE_TIERS.map((tier) => (
                <label key={tier.key} className="grid gap-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">{tier.label}</span>
                  <LocalizedNumberInput
                    value={draft[cellKey(row.id, tier.key)] ?? ''}
                    onChange={(value) => setCell(row.id, tier.key, value)}
                    disabled={disabled}
                    placeholder="Kosong = retail"
                    className={inputClass}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-muted-foreground">
          Disimpan terpisah dari tombol Simpan produk. Kosongkan isian untuk kembali ke harga retail.
        </p>
        <Button
          type="button"
          className="h-10 rounded-2xl gap-2"
          onClick={handleSave}
          disabled={disabled || !dirtyKeys.length}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Menyimpan...' : `Simpan harga bertingkat${dirtyKeys.length ? ` (${dirtyKeys.length})` : ''}`}
        </Button>
      </div>
    </div>
  );
};

export default TierPriceEditor;
