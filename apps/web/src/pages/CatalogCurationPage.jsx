import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Save, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import LocalizedNumberInput from '@/components/LocalizedNumberInput.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { formatRupiah, saveProductFeatured } from '@/services/productCatalogService.js';
import { listMemberTierPrices, saveTierPrice } from '@/services/tierPricingService.js';
import {
  DEFAULT_MEMBER_DISCOUNT_PERCENT,
  buildCurationRows,
  collectCurationChanges,
  memberPriceFromRetail,
  memberSaving,
} from '@/utils/memberPriceFill.js';

/**
 * Member prices and the featured flag for the whole catalogue, on one screen.
 *
 * Both already existed — member prices inside the product form, featured inside the product form — and
 * both went unused because setting them meant opening 18 heavy forms one after another. 17 of 18 products
 * still had no member price weeks after the storefront was built to show them.
 *
 * Nothing here saves on its own. "Isi semua" fills the DRAFT and shows what it would write; Simpan writes
 * only the rows that actually changed, and reports each failure by name rather than a single "gagal".
 */
const CatalogCurationPage = () => {
  const navigate = useNavigate();
  const products = useCatalogProducts();
  const [memberIndex, setMemberIndex] = useState({});
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [percent, setPercent] = useState(String(DEFAULT_MEMBER_DISCOUNT_PERCENT));
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { index, schemaReady: ready } = await listMemberTierPrices();
      setMemberIndex(index);
      setSchemaReady(ready);
    } catch (error) {
      setLoadError(error.message || 'Gagal memuat harga member');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const rows = useMemo(() => buildCurationRows(products, memberIndex), [products, memberIndex]);
  const changes = useMemo(() => collectCurationChanges(rows, draft), [rows, draft]);
  const changeCount = changes.priceChanges.length + changes.featuredChanges.length;

  const valueFor = (row, field) => {
    const next = draft[row.key];
    if (next && Object.prototype.hasOwnProperty.call(next, field)) return next[field];
    return field === 'member' ? (row.savedMember ?? '') : row.featured;
  };
  const setValue = (row, field, value) => setDraft((current) => ({
    ...current, [row.key]: { ...(current[row.key] || {}), [field]: value },
  }));

  // Fills the draft only. Rows the owner already typed into are left alone — a bulk button that overwrites
  // a deliberate number is worse than no bulk button.
  const fillAll = () => {
    const cut = Number(percent);
    const next = { ...draft };
    let filled = 0;
    let skipped = 0;
    for (const row of rows) {
      if (draft[row.key] && Object.prototype.hasOwnProperty.call(draft[row.key], 'member')) { skipped += 1; continue; }
      const suggested = memberPriceFromRetail(row.retail, cut);
      if (suggested === null) { skipped += 1; continue; }
      next[row.key] = { ...(next[row.key] || {}), member: suggested };
      filled += 1;
    }
    setDraft(next);
    toast.success(`${filled} harga diisi di draf${skipped ? `, ${skipped} dilewati` : ''}. Belum tersimpan — cek dulu, lalu Simpan.`);
  };

  const save = async () => {
    if (!changeCount) return;
    setSaving(true);
    const failures = [];
    let saved = 0;

    for (const change of changes.priceChanges) {
      try {
        await saveTierPrice({ productId: change.productId, variantId: change.variantId, tier: 'member', priceNumber: change.priceNumber });
        saved += 1;
      } catch (error) {
        failures.push(`${change.row.name}: ${error.message}`);
      }
    }
    for (const change of changes.featuredChanges) {
      try {
        await saveProductFeatured(change.productId, change.featured);
        saved += 1;
      } catch (error) {
        failures.push(`${change.row.name} (pilihan): ${error.message}`);
      }
    }

    setSaving(false);
    setDraft({});
    await reload();

    if (failures.length) {
      // Named, not counted. "3 gagal" leaves the owner to find which three by hand.
      toast.error(`${saved} tersimpan, ${failures.length} gagal — ${failures.slice(0, 3).join(' | ')}`);
    } else {
      toast.success(`${saved} perubahan tersimpan.`);
    }
  };

  const withMember = rows.filter((row) => row.savedMember).length;
  const featuredCount = new Set(rows.filter((row) => row.featured).map((row) => row.productId)).size;
  const productCount = new Set(rows.map((row) => row.productId)).size;

  return (
    <AuthenticatedLayout>
      <Helmet><title>Kurasi katalog - Solivagant Studio</title></Helmet>
      <div className="mx-auto grid w-full max-w-5xl gap-5 p-6">
        <div className="grid gap-2">
          <Button variant="ghost" className="w-fit gap-2 px-0" onClick={() => navigate('/studio/products')}>
            <ArrowLeft className="h-4 w-4" /> Produk
          </Button>
          <h1 className="text-2xl font-bold text-editorial-charcoal">Kurasi katalog</h1>
          <p className="text-sm text-muted-foreground">
            Harga member dan produk pilihan untuk seluruh katalog, dalam satu layar. Harga member tampil
            di etalase untuk pengunjung yang belum masuk — itulah alasan mereka membuat akun.
          </p>
        </div>

        {!schemaReady ? (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Tabel harga bertingkat belum ada di database ini. Jalankan migrasi harga bertingkat dulu —
            sampai itu, harga member yang diisi di sini tidak akan tersimpan.
          </div>
        ) : null}
        {loadError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold text-destructive">{loadError}</div>
        ) : null}

        <div className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-xs font-bold uppercase text-muted-foreground">
            Potongan member
            <div className="flex items-center gap-2">
              <input
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
                type="number" min="1" max="90" step="1"
                className="h-11 w-24 rounded-xl border px-3 text-sm font-bold outline-none focus:border-amber-300"
              />
              <span className="text-sm font-bold text-muted-foreground">%</span>
            </div>
          </label>
          <Button type="button" variant="outline" className="h-11 gap-2 rounded-xl bg-white" onClick={fillAll}>
            <Wand2 className="h-4 w-4" /> Isi semua
          </Button>
          <p className="text-xs font-semibold leading-relaxed text-muted-foreground">
            Dibulatkan ke bawah ke ribuan terdekat, jadi pembulatan selalu memihak pembeli. Baris yang sudah
            kamu ketik sendiri tidak ditimpa. Mengisi tidak menyimpan apa pun.
          </p>
          <Button type="button" className="h-11 gap-2 rounded-xl" onClick={save} disabled={!changeCount || saving}>
            <Save className="h-4 w-4" /> {saving ? 'Menyimpan...' : `Simpan${changeCount ? ` (${changeCount})` : ''}`}
          </Button>
        </div>

        <div className="text-xs font-semibold text-muted-foreground">
          {productCount} produk · {withMember} sudah punya harga member · {featuredCount} ditandai pilihan
        </div>

        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#fbfaf7] text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3 text-right">Retail</th>
                <th className="px-4 py-3 text-right">Harga member</th>
                <th className="px-4 py-3 text-right">Hemat</th>
                <th className="px-4 py-3 text-center">Pilihan</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && !rows.length ? (
                <tr><td colSpan="5" className="px-4 py-6 text-sm font-semibold text-muted-foreground">Memuat katalog...</td></tr>
              ) : null}
              {rows.map((row) => {
                const member = valueFor(row, 'member');
                const saving_ = memberSaving(row.retail, member);
                const touched = draft[row.key] && Object.prototype.hasOwnProperty.call(draft[row.key], 'member')
                  && (Number(member) || null) !== (row.savedMember ?? null);
                return (
                  <tr key={row.key} className={touched ? 'bg-amber-50/60' : undefined}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-editorial-charcoal">{row.name}</div>
                      <div className="text-xs font-semibold text-muted-foreground">{row.size || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{row.retail ? formatRupiah(row.retail) : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <LocalizedNumberInput
                        value={member}
                        onChange={(value) => setValue(row, 'member', value)}
                        placeholder="Kosong = retail"
                        className="h-10 w-40 rounded-xl border px-3 text-right text-sm font-bold outline-none focus:border-amber-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-amber-700">
                      {saving_ ? `-${formatRupiah(saving_)}` : ''}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(valueFor(row, 'featured'))}
                        onChange={(event) => setValue(row, 'featured', event.target.checked)}
                        aria-label={`Tandai ${row.name} sebagai pilihan`}
                        className="h-4 w-4"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default CatalogCurationPage;
