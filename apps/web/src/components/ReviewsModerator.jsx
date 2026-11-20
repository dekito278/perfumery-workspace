import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Eye, EyeOff, Loader2, MessageSquareReply, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import { listReviewsForStudio, updateStudioReview } from '@/services/reviewService.js';
import { REVIEW_BODY_MAX } from '@/utils/reviews.js';

/**
 * Studio → Ulasan (Dekito, 20 Nov 2026). Every buyer review lands here as "Menunggu" and shows in the shop
 * only after "Tampilkan". Dekito can hide one again, and write one reply that prints under it as
 * "Balasan dari SOLIVAGANT". The buyer's words cannot be edited here — a review is theirs or it is not
 * shown. Shared by the desktop and phone pages so the two never drift.
 */

const FILTERS = [
  ['pending', 'Menunggu'],
  ['published', 'Tampil'],
  ['hidden', 'Disembunyikan'],
  ['all', 'Semua'],
];

const STATUS_TEXT = { pending: 'Menunggu', published: 'Tampil di toko', hidden: 'Disembunyikan' };
const STATUS_CLASS = {
  pending: 'bg-amber-50 text-amber-900 border-amber-300',
  published: 'bg-emerald-50 text-emerald-900 border-emerald-300',
  hidden: 'bg-muted text-muted-foreground border-border',
};

const dateText = (value) => {
  const time = Date.parse(value || '');
  return Number.isFinite(time)
    ? new Date(time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
};

const Stars = ({ rating }) => (
  <span className="inline-flex items-center gap-0.5 text-amber-500" role="img" aria-label={`${rating} dari 5 bintang`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} aria-hidden="true" className={`h-4 w-4 ${n <= rating ? 'fill-current' : 'text-muted-foreground/40'}`} />
    ))}
  </span>
);

const ReviewCard = ({ review, busy, onStatus, onReply, orderPath }) => {
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState(review.reply);
  useEffect(() => { setReply(review.reply); }, [review.reply]);

  return (
    <article className="grid gap-3 rounded-2xl border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold">{review.productName || 'Produk dihapus'}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {review.anonymous ? 'Anonim' : (review.displayName || 'Pembeli terverifikasi')}
            {' · '}
            {review.orderId ? <Link to={orderPath(review.orderId)} className="underline underline-offset-2">{review.orderNumber || 'Order'}</Link> : review.orderNumber}
            {' · '}
            {dateText(review.updatedAt || review.createdAt)}
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_CLASS[review.status]}`}>{STATUS_TEXT[review.status]}</span>
      </div>
      <Stars rating={review.rating} />
      {review.body
        ? <p className="m-0 whitespace-pre-line text-sm leading-relaxed">{review.body}</p>
        : <p className="m-0 text-sm italic text-muted-foreground">Hanya bintang, tanpa tulisan.</p>}

      {review.reply && !replyOpen ? (
        <div className="rounded-xl border-l-4 border-amber-300 bg-amber-50/50 p-3 text-sm">
          <div className="text-xs font-bold uppercase text-muted-foreground">Balasan dari SOLIVAGANT</div>
          <p className="m-0 mt-1 whitespace-pre-line">{review.reply}</p>
        </div>
      ) : null}

      {replyOpen ? (
        <form
          className="grid gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await onReply(review, reply);
            if (ok) setReplyOpen(false);
          }}
        >
          <label className="grid gap-1 text-xs font-bold uppercase text-muted-foreground">
            Balasan (tampil di bawah ulasan; kosongkan untuk menghapus)
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value.slice(0, REVIEW_BODY_MAX))}
              rows={3}
              maxLength={REVIEW_BODY_MAX}
              className="w-full rounded-xl border px-3 py-2 text-sm font-normal normal-case text-foreground outline-none focus:border-amber-300"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy}>Simpan balasan</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setReply(review.reply); setReplyOpen(false); }}>Batal</Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {review.status !== 'published' ? (
          <Button type="button" size="sm" className="gap-1.5" disabled={busy} onClick={() => onStatus(review, 'published')}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            Tampilkan
          </Button>
        ) : null}
        {review.status !== 'hidden' ? (
          <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => onStatus(review, 'hidden')}>
            <EyeOff className="h-4 w-4" aria-hidden="true" /> Sembunyikan
          </Button>
        ) : null}
        {!replyOpen ? (
          <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => setReplyOpen(true)}>
            <MessageSquareReply className="h-4 w-4" aria-hidden="true" /> {review.reply ? 'Ubah balasan' : 'Balas'}
          </Button>
        ) : null}
      </div>
    </article>
  );
};

const ReviewsModerator = ({ orderPath = (id) => `/studio/orders/${id}` }) => {
  const [reviews, setReviews] = useState([]);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('pending');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await listReviewsForStudio();
      setReady(result.ready);
      setReviews(result.reviews);
    } catch (error) {
      setLoadError(`Ulasan belum bisa dimuat: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => reviews.reduce((acc, review) => {
    acc[review.status] = (acc[review.status] || 0) + 1;
    acc.all += 1;
    return acc;
  }, { all: 0 }), [reviews]);
  const shown = filter === 'all' ? reviews : reviews.filter((review) => review.status === filter);

  const save = async (review, patch, message) => {
    setBusyId(review.id);
    try {
      const saved = await updateStudioReview(review.id, patch);
      setReviews((list) => list.map((row) => (row.id === saved.id ? saved : row)));
      toast.success(message);
      return true;
    } catch (error) {
      toast.error(`Gagal menyimpan: ${error.message || error}`);
      return false;
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="grid gap-4">
      <p className="m-0 text-sm text-muted-foreground">
        Ulasan dari pembeli yang pesanannya sudah dikirim. Semua masuk sebagai <b>Menunggu</b> dan baru tampil di
        halaman parfum sesudah kamu tekan <b>Tampilkan</b>. Ulasan yang diubah pembeli kembali menunggu. Bintang di
        kartu katalog muncul mulai 3 ulasan.
      </p>

      {!ready ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Fitur ulasan belum aktif: jalankan dulu file <code>supabase/manual/20261120090000_buyer_reviews.sql</code> di
            Supabase SQL editor. Sebelum itu pembeli tidak melihat tombol ulasan.
          </span>
        </div>
      ) : null}
      {loadError ? <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold text-destructive">{loadError}</div> : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Saring ulasan">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`min-h-[40px] rounded-full border px-4 text-sm font-bold ${filter === key ? 'border-foreground bg-foreground text-background' : 'bg-white'}`}
          >
            {label} ({counts[key] || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border bg-white p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuat ulasan…
        </div>
      ) : shown.length ? (
        <div className="grid gap-3">
          {shown.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              busy={busyId === review.id}
              orderPath={orderPath}
              onStatus={(row, status) => save(row, { status }, status === 'published' ? 'Ulasan tampil di toko.' : 'Ulasan disembunyikan.')}
              onReply={(row, text) => save(row, { reply: text }, text.trim() ? 'Balasan disimpan.' : 'Balasan dihapus.')}
            />
          ))}
        </div>
      ) : ready && !loadError ? (
        <div className="rounded-2xl border bg-white p-4 text-sm text-muted-foreground">
          {filter === 'pending' ? 'Tidak ada ulasan yang menunggu.' : 'Belum ada ulasan di sini.'}
        </div>
      ) : null}
    </div>
  );
};

export default ReviewsModerator;
