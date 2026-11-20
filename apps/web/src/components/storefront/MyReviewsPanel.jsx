import React, { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageSquareText, PencilLine } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslate } from '@/hooks/useTranslate.js';
import { getMyReviewableItems, submitReview } from '@/services/reviewService.js';
import { publicErrorMessage } from '@/utils/publicErrorMessage.js';
import {
  REVIEW_BODY_MAX,
  REVIEWS_ANCHOR,
  reviewDisplayName,
  reviewIsEditable,
} from '@/utils/reviews.js';
import { ReviewStars, ReviewStarsInput } from '@/components/storefront/ReviewStars.jsx';

/**
 * "Ulasan kamu" on the account page (Dekito, 20 Nov 2026).
 *
 * Lists every perfume from the buyer's own orders that has SHIPPED — the server decides that list
 * (storefront_my_reviewable_items), the page only prints it. One review per perfume per order, editable for
 * 30 days, checked by Dekito before it shows. Renders nothing for a buyer with nothing shipped yet: an empty
 * "write a review" box would only ask for something they cannot do.
 */

const ReviewStatusLine = ({ status }) => {
  const { t } = useTranslate();
  if (status === 'published') return <span className="ng-mono text-ng-sand">{t('review.status.published')}</span>;
  if (status === 'hidden') return <span className="ng-mono text-ng-ash">{t('review.status.hidden')}</span>;
  return <span className="ng-mono text-ng-ash">{t('review.status.pending')}</span>;
};

const ReviewForm = ({ item, onSaved, onCancel }) => {
  const { t } = useTranslate();
  const starsLabel = useId();
  const bodyId = useId();
  const [rating, setRating] = useState(item.review?.rating || 0);
  const [body, setBody] = useState(item.review?.body || '');
  const [anonymous, setAnonymous] = useState(item.review?.anonymous || false);
  const [saving, setSaving] = useState(false);
  // The server stores its own answer from the same name; this only previews it.
  const shownName = anonymous ? '' : reviewDisplayName(item.buyerName);

  const save = async (event) => {
    event.preventDefault();
    if (!rating) {
      toast.error(t('review.form.needStars'));
      return;
    }
    setSaving(true);
    try {
      const review = await submitReview({ orderId: item.orderId, productId: item.productId, rating, body, anonymous });
      toast.success(t('review.form.sent'));
      onSaved(review);
    } catch (error) {
      toast.error(publicErrorMessage(error, t('review.form.failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="mt-4 grid gap-4 border-t border-ng-bone/10 pt-4">
      <div className="grid gap-1">
        <span id={starsLabel} className="text-sm font-bold text-ng-bone">{t('review.form.stars')}</span>
        <ReviewStarsInput value={rating} onChange={setRating} labelledBy={starsLabel} />
      </div>
      <div className="grid gap-1">
        <label htmlFor={bodyId} className="text-sm font-bold text-ng-bone">{t('review.form.body')}</label>
        <textarea
          id={bodyId}
          value={body}
          onChange={(event) => setBody(event.target.value.slice(0, REVIEW_BODY_MAX))}
          maxLength={REVIEW_BODY_MAX}
          rows={4}
          placeholder={t('review.form.bodyHint')}
          className="w-full rounded-none border border-ng-bone/20 bg-transparent px-3 py-2 text-[15px] leading-relaxed outline-none focus:border-ng-bone/50"
        />
        <span className="text-right text-xs text-ng-ash">{body.length}/{REVIEW_BODY_MAX}</span>
      </div>
      <label className="flex min-h-[44px] items-center gap-3 text-sm text-ng-bone">
        <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} className="h-5 w-5 accent-current" />
        {t('review.form.anonymous')}
      </label>
      <p className="m-0 text-sm text-ng-dust">
        {t('review.form.shownAs', { name: shownName || t('review.verifiedBuyer') })}
      </p>
      <p className="m-0 text-xs leading-relaxed text-ng-ash">
        {item.review ? t('review.form.editChecked') : t('review.form.checkedFirst')}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="ng-btn">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {item.review ? t('review.form.saveEdit') : t('review.form.send')}
        </button>
        <button type="button" onClick={onCancel} className="ng-btn ng-btn--ghost">{t('review.form.cancel')}</button>
      </div>
    </form>
  );
};

const MyReviewsPanel = () => {
  const { t } = useTranslate();
  const [items, setItems] = useState(null);
  const [failed, setFailed] = useState(false);
  const [openKey, setOpenKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    getMyReviewableItems()
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) { setItems([]); setFailed(true); } });
    return () => { cancelled = true; };
  }, []);

  // Arriving from Studio's WhatsApp ask (/customer#<REVIEWS_ANCHOR>): bring the panel into view once it exists.
  useEffect(() => {
    if (!items?.length || window.location.hash !== `#${REVIEWS_ANCHOR}`) return;
    document.getElementById(REVIEWS_ANCHOR)?.scrollIntoView({ block: 'start' });
  }, [items]);

  if (failed) {
    return (
      <section id={REVIEWS_ANCHOR} className="rounded-none border bg-transparent p-5">
        <h2 className="ng-display text-[1.75rem]">{t('review.mine.title')}</h2>
        <p className="mt-2 text-sm text-ng-dust">{t('review.mine.loadFailed')}</p>
      </section>
    );
  }
  if (!items?.length) return null;

  const waiting = items.filter((item) => !item.review).length;
  const keyOf = (item) => `${item.orderId}:${item.productId}`;

  return (
    <section id={REVIEWS_ANCHOR} className="scroll-mt-24 rounded-none border bg-transparent p-5" aria-labelledby="my-reviews-title">
      <div className="flex items-start gap-3">
        <MessageSquareText className="mt-1 h-5 w-5 shrink-0 text-ng-sand" aria-hidden="true" />
        <div>
          <h2 id="my-reviews-title" className="ng-display text-[1.75rem]">{t('review.mine.title')}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ng-dust">
            {waiting ? t('review.mine.introWaiting', { count: waiting }) : t('review.mine.introDone')}
          </p>
        </div>
      </div>
      <ul className="m-0 mt-4 grid list-none gap-3 p-0">
        {items.map((item) => {
          const key = keyOf(item);
          const open = openKey === key;
          const editable = reviewIsEditable(item.review);
          return (
            <li key={key} className="border border-ng-bone/10 bg-ng-deep p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/catalog/${item.productSlug}`} className="font-ng-display text-xl leading-tight text-ng-bone underline-offset-4 hover:underline">
                    {item.productName}
                  </Link>
                  <p className="ng-mono m-0 mt-1 text-ng-ash">{item.orderNumber}</p>
                </div>
                {item.review ? <ReviewStatusLine status={item.review.status} /> : null}
              </div>

              {item.review && !open ? (
                <div className="mt-3 grid gap-2">
                  <ReviewStars rating={item.review.rating} />
                  {item.review.body ? <p className="m-0 whitespace-pre-line text-[15px] leading-relaxed text-ng-sand">{item.review.body}</p> : null}
                  {item.review.reply ? (
                    <div className="border-l-2 border-ng-bone/20 pl-3">
                      <p className="ng-mono m-0 text-ng-ash">{t('review.replyFrom')}</p>
                      <p className="m-0 mt-1 whitespace-pre-line text-sm leading-relaxed text-ng-dust">{item.review.reply}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {open ? (
                <ReviewForm
                  item={item}
                  onCancel={() => setOpenKey('')}
                  onSaved={(review) => {
                    setItems((list) => list.map((row) => (keyOf(row) === key ? { ...row, review } : row)));
                    setOpenKey('');
                  }}
                />
              ) : (
                <div className="mt-3">
                  {!item.review ? (
                    <button type="button" className="ng-btn ng-btn--tight" onClick={() => setOpenKey(key)}>
                      {t('review.mine.write')}
                    </button>
                  ) : editable ? (
                    <button type="button" className="ng-btn ng-btn--ghost ng-btn--tight" onClick={() => setOpenKey(key)}>
                      <PencilLine className="h-4 w-4" aria-hidden="true" /> {t('review.mine.edit')}
                    </button>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default MyReviewsPanel;
