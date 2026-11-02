import React, { useEffect, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import { useSiteFacts } from '@/hooks/useSiteFacts.js';
import { saveSiteFacts } from '@/services/siteSettingsService.js';
import { JOURNAL_CATEGORY_VALUE, journalCategoryValueFor } from '@/data/siteFacts.js';

// The shop facts Dekito changes from Studio (src/data/siteFacts.js). One form for the desktop and the phone
// page, so the two cannot offer different fields.
const field = 'h-11 w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300';
const label = 'text-xs font-bold uppercase text-[#6b7280]';
const hint = 'text-xs text-[#6b7280]';

const SiteFactsForm = () => {
  const saved = useSiteFacts();
  const [form, setForm] = useState(saved);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  // The saved row arrives after the first render; take it unless something has been typed already.
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (!touched) setForm(saved); }, [saved, touched]);

  const update = (key, value) => { setTouched(true); setForm((current) => ({ ...current, [key]: value })); };
  const renameCategory = (value, nextLabel) => update('journalCategories',
    form.journalCategories.map((category) => (category.value === value ? { ...category, label: nextLabel } : category)));
  const addCategory = () => {
    const name = newCategory.trim();
    const value = journalCategoryValueFor(name);
    if (!name || !JOURNAL_CATEGORY_VALUE.test(value)) { toast.error('Nama kategori belum bisa dipakai.'); return; }
    if (form.journalCategories.some((category) => category.value === value)) { toast.error('Kategori itu sudah ada.'); return; }
    update('journalCategories', [...form.journalCategories, { value, label: name }]);
    setNewCategory('');
  };

  const save = async () => {
    setSaving(true);
    try {
      const next = await saveSiteFacts(form);
      setForm(next);
      setTouched(false);
      toast.success('Fakta toko tersimpan. Toko langsung memakai angka baru.');
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan fakta toko.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 rounded-2xl border border-[#e5e7eb] bg-white p-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className={label}>Lama pengerjaan bespoke (hari)</span>
          <input value={form.bespokeDays} onChange={(event) => update('bespokeDays', event.target.value)} placeholder="7–14" className={field} />
          <span className={hint}>Satu angka atau rentang, mis. 7–14. Tampil di halaman Bespoke.</span>
        </label>
        <label className="grid gap-1.5">
          <span className={label}>Ongkir luar negeri dikutip dalam (jam)</span>
          <input type="number" inputMode="numeric" min="1" max="168" value={form.quoteHours} onChange={(event) => update('quoteHours', event.target.value)} className={field} />
          <span className={hint}>Janji di halaman pembayaran order luar negeri: "kami kirim dalam 1x24 jam".</span>
        </label>
        <label className="grid gap-1.5">
          <span className={label}>Kota brand</span>
          <input value={form.brandCity} onChange={(event) => update('brandCity', event.target.value)} placeholder="Bogor" className={field} />
          <span className={hint}>Halaman About dan invoice.</span>
        </label>
        <label className="grid gap-1.5">
          <span className={label}>Tahun berdiri</span>
          <input type="number" inputMode="numeric" min="1900" max="2100" value={form.brandFoundedYear} onChange={(event) => update('brandFoundedYear', event.target.value)} className={field} />
          <span className={hint}>Tahun brand berdiri, bukan tahun rilis parfum.</span>
        </label>
        <label className="grid gap-1.5 sm:col-span-2">
          <span className={label}>Nama di footer</span>
          <input value={form.footerOwner} onChange={(event) => update('footerOwner', event.target.value)} placeholder="SOLIVAGANT by Dekito" className={field} />
          <span className={hint}>Baris "© tahun …" di bawah setiap halaman toko.</span>
        </label>
      </section>

      <section className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4">
        <div>
          <div className={label}>Kategori jurnal</div>
          <p className={`${hint} mt-1`}>Ganti nama atau tambah kategori. Kategori tidak dihapus dari sini, supaya artikel lama tidak kehilangan labelnya.</p>
        </div>
        {form.journalCategories.map((category) => (
          <label key={category.value} className="grid gap-1">
            <input aria-label={`Nama kategori ${category.value}`} value={category.label} onChange={(event) => renameCategory(category.value, event.target.value)} className={field} />
            <span className="text-[11px] text-[#9ca3af]">kunci: {category.value}</span>
          </label>
        ))}
        <div className="flex gap-2">
          <input aria-label="Kategori baru" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Kategori baru" className={field} />
          <Button type="button" variant="outline" onClick={addCategory} className="h-11 shrink-0 gap-1 rounded-2xl bg-white">
            <Plus className="h-4 w-4" /> Tambah
          </Button>
        </div>
      </section>

      <Button type="button" onClick={save} disabled={saving} className="h-11 gap-2 rounded-2xl">
        <Save className="h-4 w-4" /> {saving ? 'Menyimpan...' : 'Simpan fakta toko'}
      </Button>
    </div>
  );
};

export default SiteFactsForm;
