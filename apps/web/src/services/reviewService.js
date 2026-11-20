import supabase from '@/lib/supabaseClient.js';
import { isSchemaMissing } from '@/services/tierPricingService.js';
import {
  cleanReviewBody,
  clampRating,
  indexReviewStats,
  normalizePublicReview,
  normalizeReviewableItem,
  REVIEW_STATUSES,
} from '@/utils/reviews.js';

// Reviews arrive with supabase/manual/20261120090000_buyer_reviews.sql, which Dekito runs by hand. Until it
// has run, every storefront read answers "no reviews" — which renders nothing, exactly as a shop with no
// reviews yet should. Studio is told plainly instead (see listReviewsForStudio).

const PUBLIC_VIEW = 'storefront_reviews_public';
const STATS_VIEW = 'storefront_review_stats';
const TABLE = 'storefront_reviews';

/** Published reviews, newest first. `productSlug` narrows to one perfume. */
export const getPublicReviews = async ({ productSlug = '', limit = 200 } = {}) => {
  try {
    let query = supabase
      .from(PUBLIC_VIEW)
      .select('id,product_slug,product_name,rating,body,display_name,reply,replied_at,published_at,created_at')
      .order('published_at', { ascending: false })
      .limit(limit);
    if (productSlug) query = query.eq('product_slug', productSlug);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(normalizePublicReview).filter((review) => review.rating);
  } catch (error) {
    if (!isSchemaMissing(error)) console.warn('Reviews could not be loaded:', error.message || error);
    return [];
  }
};

let statsPromise = null;

/** { [slug]: { count, average } } over published reviews. Read once per page load. */
export const getReviewStats = () => {
  if (!statsPromise) {
    statsPromise = (async () => {
      try {
        const { data, error } = await supabase.from(STATS_VIEW).select('product_slug,review_count,average_rating');
        if (error) throw error;
        return indexReviewStats(data);
      } catch (error) {
        if (!isSchemaMissing(error)) console.warn('Review stats could not be loaded:', error.message || error);
        statsPromise = null;
        return {};
      }
    })();
  }
  return statsPromise;
};

/** The signed-in buyer's shipped perfumes, each with their review if they wrote one. */
export const getMyReviewableItems = async () => {
  const { data, error } = await supabase.rpc('storefront_my_reviewable_items');
  if (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
  return (data || []).map(normalizeReviewableItem).filter((item) => item.orderId && item.productId);
};

/** Send or change a review. The server checks everything again and answers with the saved row. */
export const submitReview = async ({ orderId, productId, rating, body = '', anonymous = false }) => {
  const stars = clampRating(rating);
  if (!stars) throw new Error('rating');
  const { data, error } = await supabase.rpc('storefront_submit_review', {
    p_order_id: orderId,
    p_product_id: productId,
    p_rating: stars,
    p_body: cleanReviewBody(body),
    p_anonymous: Boolean(anonymous),
  });
  if (error) throw error;
  return normalizeReviewableItem({ order_id: orderId, product_id: productId, review: data }).review;
};

// --- Studio --------------------------------------------------------------------------------------------

const normalizeStudioReview = (row = {}) => ({
  id: String(row.id || ''),
  productId: String(row.product_id || ''),
  productName: String(row.product?.name || ''),
  productSlug: String(row.product?.slug || ''),
  orderId: String(row.order_id || ''),
  orderNumber: String(row.order_number || ''),
  rating: clampRating(row.rating),
  body: String(row.body || ''),
  anonymous: row.anonymous === true,
  displayName: String(row.display_name || ''),
  status: REVIEW_STATUSES.includes(row.status) ? row.status : 'pending',
  reply: String(row.reply || ''),
  repliedAt: row.replied_at || null,
  publishedAt: row.published_at || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

/** Every review for Studio. `{ ready: false }` until the SQL has run, so the page can say so. */
export const listReviewsForStudio = async () => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, product:storefront_products(name,slug)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    if (isSchemaMissing(error)) return { ready: false, reviews: [] };
    throw error;
  }
  return { ready: true, reviews: (data || []).map(normalizeStudioReview) };
};

/** Publish / hide / back to waiting, and the shop's reply. */
export const updateStudioReview = async (id, { status, reply } = {}) => {
  const patch = {};
  if (status !== undefined) {
    if (!REVIEW_STATUSES.includes(status)) throw new Error(`Unknown review status: ${status}`);
    patch.status = status;
    patch.published_at = status === 'published' ? new Date().toISOString() : null;
  }
  if (reply !== undefined) {
    const text = cleanReviewBody(reply);
    patch.reply = text;
    patch.replied_at = text ? new Date().toISOString() : null;
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .select('*, product:storefront_products(name,slug)')
    .single();
  if (error) throw error;
  return normalizeStudioReview(data);
};
