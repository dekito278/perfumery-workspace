import supabase from '@/lib/supabaseClient.js';
import { getCurrentUserId, toAppRecord } from '@/services/supabaseDataHelpers.js';

export const JOURNAL_CATEGORIES = [
  { value: 'formula_accord', label: 'Formula Accord' },
  { value: 'experience', label: 'Experience' },
  { value: 'material_note', label: 'Material Note' },
  { value: 'process', label: 'Process' },
  { value: 'product_idea', label: 'Product Idea' },
];

export const JOURNAL_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
];

export const JOURNAL_CATEGORY_BADGE_CLASS_NAMES = {
  formula_accord: 'border-amber-200 bg-amber-50 text-amber-800',
  experience: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  material_note: 'border-sky-200 bg-sky-50 text-sky-800',
  process: 'border-violet-200 bg-violet-50 text-violet-800',
  product_idea: 'border-rose-200 bg-rose-50 text-rose-800',
};

export const JOURNAL_STATUS_BADGE_CLASS_NAMES = {
  draft: 'border-slate-200 bg-slate-50 text-slate-700',
  published: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

export const JOURNAL_CATEGORY_COVER_CLASS_NAMES = {
  formula_accord: 'from-amber-100 via-white to-emerald-50 text-amber-900',
  experience: 'from-emerald-100 via-white to-stone-100 text-emerald-900',
  material_note: 'from-sky-100 via-white to-emerald-50 text-sky-900',
  process: 'from-violet-100 via-white to-stone-100 text-violet-900',
  product_idea: 'from-rose-100 via-white to-amber-50 text-rose-900',
};

export const getJournalCategoryLabel = (value) => (
  JOURNAL_CATEGORIES.find((category) => category.value === value)?.label || 'Experience'
);

export const getJournalCategoryBadgeClassName = (value) => (
  JOURNAL_CATEGORY_BADGE_CLASS_NAMES[value] || JOURNAL_CATEGORY_BADGE_CLASS_NAMES.experience
);

export const getJournalStatusBadgeClassName = (value) => (
  JOURNAL_STATUS_BADGE_CLASS_NAMES[value] || JOURNAL_STATUS_BADGE_CLASS_NAMES.draft
);

export const getJournalCategoryCoverClassName = (value) => (
  JOURNAL_CATEGORY_COVER_CLASS_NAMES[value] || JOURNAL_CATEGORY_COVER_CLASS_NAMES.experience
);

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) {
    return [...new Set(tags.map((tag) => String(tag || '').trim()).filter(Boolean))];
  }

  return [...new Set(String(tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean))];
};

const normalizeJournalPostPayload = (postData) => ({
  title: String(postData.title || '').trim(),
  category: postData.category || 'experience',
  status: postData.status || 'draft',
  related_formula_id: postData.related_formula_id && postData.related_formula_id !== 'none'
    ? postData.related_formula_id
    : null,
  excerpt: postData.excerpt ? String(postData.excerpt).trim() : null,
  content: postData.content ? String(postData.content).trim() : null,
  seo_title: postData.seo_title ? String(postData.seo_title).trim() : null,
  cover_image_url: postData.cover_image_url ? String(postData.cover_image_url).trim() : null,
  tags: normalizeTags(postData.tags),
});

export const getJournalPosts = async () => {
  const { data, error } = await supabase
    .from('journal_posts')
    .select('*')
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching journal posts:', error);
    throw new Error(error.message || 'Failed to fetch journal posts');
  }

  return (data || []).map(toAppRecord);
};

export const getJournalPostById = async (id) => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ''));
  const column = isUuid ? 'id' : 'slug';
  const { data, error } = await supabase
    .from('journal_posts')
    .select('*')
    .eq(column, id)
    .single();

  if (error) {
    console.error('Error fetching journal post:', error);
    throw new Error(error.message || 'Failed to fetch journal post');
  }

  return toAppRecord(data);
};

export const getPublishedJournalPostBySlug = async (slug) => {
  const normalizedSlug = String(slug || '').trim();

  if (!normalizedSlug) {
    return null;
  }

  const { data, error } = await supabase
    .from('journal_posts')
    .select('id, title, category, status, slug, excerpt, content, seo_title, cover_image_url, tags, published_at, created_at, updated_at')
    .eq('slug', normalizedSlug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) {
    console.error('Error fetching published journal post:', error);
    throw new Error(error.message || 'Failed to fetch published journal post');
  }

  return data ? toAppRecord(data) : null;
};

export const createJournalPost = async (postData) => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('journal_posts')
    .insert({
      user_id: userId,
      ...normalizeJournalPostPayload(postData),
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating journal post:', error);
    throw new Error(error.message || 'Failed to create journal post');
  }

  return toAppRecord(data);
};

export const updateJournalPost = async (postId, postData) => {
  const { data, error } = await supabase
    .from('journal_posts')
    .update(normalizeJournalPostPayload(postData))
    .eq('id', postId)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating journal post:', error);
    throw new Error(error.message || 'Failed to update journal post');
  }

  return toAppRecord(data);
};
