import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { TESTIMONIAL_LIMITS, normalizeTestimonials } from '@/utils/productTestimonials.js';

/**
 * Where Dekito pastes what a buyer actually wrote.
 *
 * One component for both layouts, because the two product forms were once written twice by hand and
 * drifted on a field — productFormState.js carries that story. A repeater written twice would drift the
 * same way.
 *
 * Only the quote is required. Someone who did not want their name printed still said the thing, so an
 * entry with a quote and no name is kept and shown unattributed; an entry with a name and no quote is
 * dropped on save, since a name alone is not a testimonial.
 *
 * There is no "generate" and no example text. A sentence this shop did not receive is a fake review
 * whatever the button is called.
 */
const TestimonialsField = ({ value, onChange, mobile = false }) => {
  const rows = Array.isArray(value) ? value : [];
  const setRow = (index, key, next) => onChange(rows.map((row, i) => (i === index ? { ...row, [key]: next } : row)));
  const addRow = () => onChange([...rows, { quote: '', name: '', city: '' }]);
  const removeRow = (index) => onChange(rows.filter((_, i) => i !== index));
  const kept = normalizeTestimonials(rows).length;
  const pad = mobile ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm';

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`font-bold uppercase tracking-[0.1em] text-stone-500 ${mobile ? 'text-[10px]' : 'text-xs'}`}>
          Kutipan pembeli
        </span>
        <span className="text-[10px] font-semibold text-stone-400">
          {kept
            ? `${kept} tampil di halaman produk`
            : 'kosong — halaman produk tidak menampilkan apa pun'}
        </span>
      </div>

      {/* Said once, here, rather than trusted to memory: these are pasted, never written for him. */}
      <p className="text-[10px] leading-relaxed text-stone-400">
        Tempel kalimat yang benar-benar dikirim pembeli lewat WhatsApp atau Instagram. Tanpa bintang,
        tanpa rata-rata. Nama dan kota boleh dikosongkan kalau dia tidak mau dicantumkan — kutipannya
        tetap tampil. Baris tanpa kutipan tidak akan disimpan.
      </p>

      {rows.map((row, index) => (
        <div key={index} className={`space-y-2 rounded-2xl border bg-white ${pad}`}>
          <textarea
            value={row.quote || ''}
            onChange={(event) => setRow(index, 'quote', event.target.value)}
            rows={mobile ? 3 : 2}
            maxLength={TESTIMONIAL_LIMITS.quote}
            placeholder="Kalimat pembeli, apa adanya"
            aria-label={`Kutipan pembeli ${index + 1}`}
            className="w-full resize-y rounded-xl border-0 bg-stone-50 p-2 text-sm text-stone-800 outline-none"
          />
          <div className="flex items-center gap-2">
            <input
              value={row.name || ''}
              onChange={(event) => setRow(index, 'name', event.target.value)}
              maxLength={TESTIMONIAL_LIMITS.name}
              placeholder="Nama (opsional)"
              aria-label={`Nama pembeli ${index + 1}`}
              className="min-w-0 flex-1 rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-800 outline-none"
            />
            <input
              value={row.city || ''}
              onChange={(event) => setRow(index, 'city', event.target.value)}
              maxLength={TESTIMONIAL_LIMITS.city}
              placeholder="Kota (opsional)"
              aria-label={`Kota pembeli ${index + 1}`}
              className="min-w-0 flex-1 rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-800 outline-none"
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              aria-label={`Hapus kutipan ${index + 1}`}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-stone-100 text-stone-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      {rows.length < TESTIMONIAL_LIMITS.count ? (
        <button
          type="button"
          onClick={addRow}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed font-bold text-stone-600 ${pad}`}
        >
          <Plus className="h-4 w-4" />
          Tambah kutipan
        </button>
      ) : null}
    </div>
  );
};

export default TestimonialsField;
