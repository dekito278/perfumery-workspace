import React from 'react';
import { BookOpenText } from 'lucide-react';
import {
  getJournalCategoryCoverClassName,
  getJournalCategoryLabel,
} from '@/services/journalPostsSupabaseService.js';

const JournalCoverFrame = ({
  post,
  className = '',
  imageClassName = 'aspect-[16/7]',
  compact = false,
  eager = false,
}) => {
  const title = post?.title || 'Journal note';
  const category = post?.category || 'experience';
  const categoryLabel = getJournalCategoryLabel(category);

  if (post?.cover_image_url) {
    return (
      <figure className={`overflow-hidden border bg-muted ${className}`}>
        <img
          src={post.cover_image_url}
          alt=""
          className={`${imageClassName} w-full object-cover`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eager ? 'high' : 'auto'}
          width="1200"
          height="675"
        />
      </figure>
    );
  }

  return (
    <figure className={`overflow-hidden border bg-gradient-to-br ${getJournalCategoryCoverClassName(category)} ${className}`}>
      <div className={`${imageClassName} flex min-h-full w-full flex-col justify-between ${compact ? 'gap-1.5 p-2' : 'gap-8 p-4 sm:p-8'}`}>
        <div className="flex items-center justify-between gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 font-bold uppercase tracking-[0.14em] ${compact ? 'px-2 py-1 text-[8px]' : 'px-3 py-1 text-[10px]'}`}>
            <BookOpenText className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            <span className={compact ? 'sr-only' : ''}>{categoryLabel}</span>
          </span>
        </div>
        <figcaption className={compact ? 'line-clamp-2 text-[11px] font-bold leading-tight' : 'max-w-2xl text-2xl font-bold leading-tight sm:text-4xl'}>
          {title}
        </figcaption>
      </div>
    </figure>
  );
};

export default JournalCoverFrame;
