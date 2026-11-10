import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, Pencil, Plus, Power, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import LocalizedNumberInput from '@/components/LocalizedNumberInput.jsx';
import { getMemberCodeStats, listMemberCodes, saveMemberCode, setMemberCodeActive } from '@/services/memberCodeService.js';
import { MAX_MEMBER_CODE_PERCENT, memberCodeProblem, normalizeMemberCode } from '@/utils/memberCode.js';

const EMPTY_DRAFT = { id: null, name: '', code: '', percent: 10 };
const percentText = (value) => `${Number(value).toLocaleString('id-ID')}%`;
const fieldClass = 'h-11 w-full min-w-0 rounded-xl border px-3 text-sm font-semibold outline-none focus:border-amber-300';

/**
 * Member codes — one per community (Jakarta Fragrance Club, Indramayu Fragrance Club, the card in
 * marketplace parcels...), each with its own percentage. Dekito, 10 Nov 2026: the percentages are set
 * here, by Dekito. Shared by the desktop and phone pages so the two never drift.
 */
const MemberCodesEditor = ({ curationPath = '/studio/products/curation' }) => {
  const [codes, setCodes] = useState([]);
  const [stats, setStats] = useState({});
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [{ codes: list, schemaReady: ready }, counts] = await Promise.all([listMemberCodes(), getMemberCodeStats()]);
      setCodes(list);
      setSchemaReady(ready);
      setStats(counts);
    } catch (error) {
      setLoadError(error.message || 'Kode member gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const problem = memberCodeProblem(draft);
  const editing = Boolean(draft.id);

  const submit = async (event) => {
    event.preventDefault();
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveMemberCode(draft);
      toast.success(`${saved.name}: ${saved.code} · ${percentText(saved.percent)} tersimpan`);
      setDraft(EMPTY_DRAFT);
      await load();
    } catch (error) {
      toast.error(error.message || 'Kode member gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (code) => {
    setBusyId(code.id);
    try {
      await setMemberCodeActive(code.id, !code.active);
      toast.success(code.active
        ? `${code.code} dimatikan. Yang sudah memakainya tetap member.`
        : `${code.code} aktif lagi.`);
      await load();
    } catch (error) {
      toast.error(error.message || 'Status kode gagal diubah.');
    } finally {
      setBusyId('');
    }
  };

  const legacyAccounts = stats['']?.accounts || 0;

  return (
    <div className="grid gap-4">
      <p className="m-0 text-sm text-muted-foreground">
        Setiap komunitas punya kode sendiri. Akun yang memasukkan kode di toko langsung jadi member, dengan
        persen kode itu. Yang belum punya kode jadi member setelah belanja pertamanya lunas, dengan harga
        member per produk dari <Link to={curationPath} className="font-bold underline underline-offset-2">Kurasi katalog</Link>.
        Pembeli selalu dapat harga member yang lebih murah dari keduanya.
      </p>

      {!schemaReady ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Tabel kode member belum ada di database. Jalankan migrasi 20261110120000_member_codes.sql dulu —
          sampai itu, kode yang diisi di sini tidak tersimpan dan toko masih memakai aturan lama
          (semua yang masuk dapat harga member).
        </div>
      ) : null}
      {loadError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold text-destructive">{loadError}</div>
      ) : null}

      <form onSubmit={submit} className="grid gap-3 rounded-2xl border bg-white p-4">
        <div className="text-sm font-bold">{editing ? `Ubah ${draft.code}` : 'Tambah kode'}</div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.6fr)]">
          <label className="grid min-w-0 gap-1 text-xs font-bold uppercase text-muted-foreground">
            Nama komunitas
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Jakarta Fragrance Club"
              maxLength={80}
              className={fieldClass}
            />
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-bold uppercase text-muted-foreground">
            Kode
            <input
              value={draft.code}
              onChange={(event) => setDraft((current) => ({ ...current, code: normalizeMemberCode(event.target.value) }))}
              placeholder="JFC2026"
              maxLength={32}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className={`${fieldClass} uppercase tracking-[0.08em]`}
            />
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-bold uppercase text-muted-foreground">
            Potongan
            <span className="flex items-center gap-2">
              <LocalizedNumberInput
                value={draft.percent}
                onChange={(value) => setDraft((current) => ({ ...current, percent: value }))}
                aria-label="Persen potongan"
                className={fieldClass}
              />
              <span className="text-sm font-bold">%</span>
            </span>
          </label>
        </div>
        <p className="m-0 text-xs text-muted-foreground">
          Dari harga retail, dibulatkan ke bawah ke ribuan. Paling besar {MAX_MEMBER_CODE_PERCENT}%.
          {editing ? ' Persen baru langsung berlaku untuk semua member kode ini.' : ''}
        </p>
        {draft.name || draft.code ? (
          problem ? <p className="m-0 text-xs font-semibold text-destructive">{problem}</p> : null
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving || !schemaReady} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : (editing ? <Save className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />)}
            {editing ? 'Simpan perubahan' : 'Tambah kode'}
          </Button>
          {editing ? (
            <Button type="button" variant="ghost" onClick={() => setDraft(EMPTY_DRAFT)}>Batal</Button>
          ) : null}
        </div>
      </form>

      <section className="grid gap-2" aria-label="Daftar kode member">
        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border bg-white p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuat kode member…
          </div>
        ) : null}
        {!loading && schemaReady && !codes.length ? (
          <div className="rounded-2xl border border-dashed bg-white p-4 text-sm text-muted-foreground">
            Belum ada kode. Tambahkan satu untuk tiap komunitas.
          </div>
        ) : null}
        {codes.map((code) => {
          const count = stats[code.id] || { accounts: 0, paidOrders: 0 };
          return (
            <article key={code.id} className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-bold">{code.name}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${code.active ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-stone-300 bg-stone-100 text-stone-600'}`}>
                    {code.active ? 'Aktif' : 'Dimatikan'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="font-mono font-bold tracking-[0.08em]">{code.code}</span>
                  <span className="font-bold">{percentText(code.percent)}</span>
                  <span className="text-muted-foreground">{count.accounts} akun · {count.paidOrders} order lunas</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="gap-2" onClick={() => setDraft({ id: code.id, name: code.name, code: code.code, percent: code.percent })}>
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Ubah
                </Button>
                <Button type="button" variant="outline" className="gap-2" disabled={busyId === code.id} onClick={() => toggle(code)}>
                  <Power className="h-4 w-4" aria-hidden="true" /> {code.active ? 'Matikan' : 'Aktifkan'}
                </Button>
              </div>
            </article>
          );
        })}
      </section>

      {schemaReady && legacyAccounts ? (
        <p className="m-0 text-xs text-muted-foreground">
          {legacyAccounts} akun yang sudah ada sebelum kode member dipakai tetap member, tanpa kode.
        </p>
      ) : null}
    </div>
  );
};

export default MemberCodesEditor;
