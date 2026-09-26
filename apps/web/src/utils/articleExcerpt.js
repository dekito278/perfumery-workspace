// One preview line for a journal article, built the same way wherever it is shown.
//
// It was built three ways. The desktop journal stripped markdown from the CONTENT and returned a
// stored excerpt untouched; the phone journal stripped both; the home page stripped a smaller set of
// characters and left image and link syntax in place. So the same article could read three ways
// depending on which screen found it.
//
// Import-free on purpose: this is a pure string function and every surface that shows an article
// preview should be able to reach it.

/** Markdown reduced to the words a reader actually sees. */
export const stripMarkdown = (value) => String(value || '')
  .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/[`*_>#-]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * @param post an article row; its stored excerpt wins over its content
 * @param limit characters, or 0 for no limit — the surfaces disagree on length on purpose, because a
 *   home-page card has less room than a journal list, and that is a layout decision rather than a
 *   different idea of what an excerpt is.
 *
 * The stored excerpt is stripped too. It used to be returned raw on two surfaces, which is the half of
 * this that will bite first: excerpts are written by hand, in the same markdown as the body.
 */
export const articleExcerpt = (post = {}, limit = 0) => {
  const text = stripMarkdown(post?.excerpt || post?.content || '');
  if (!limit || text.length <= limit) return text;
  return text.slice(0, limit);
};

export default articleExcerpt;
