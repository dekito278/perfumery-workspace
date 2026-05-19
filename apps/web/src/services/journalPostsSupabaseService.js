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

export const getJournalCategoryLabel = (value) => (
  JOURNAL_CATEGORIES.find((category) => category.value === value)?.label || 'Experience'
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
