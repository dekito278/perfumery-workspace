// The journal page prints the title and the excerpt above the body. Several articles' bodies open with the
// same two lines (fresh buyer audit, 15 Nov 2026: title, italic summary, then the summary again and the
// title again as paragraphs). The article in the database is Dekito's and stays as written; the PAGE skips
// leading blocks that only repeat what it has already printed. Nothing else in the body is touched.
const plain = (value) => String(value || '')
  .replace(/^#{1,6}\s+/, '')
  .replace(/[*_`>~]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

export const withoutRepeatedLead = (content = '', { title = '', excerpt = '' } = {}) => {
  const seen = new Set([plain(title), plain(excerpt)].filter(Boolean));
  if (!seen.size) return String(content || '');
  const blocks = String(content || '').split(/\n\s*\n/);
  let skip = 0;
  while (skip < blocks.length && skip < 3 && blocks[skip].trim() && seen.has(plain(blocks[skip]))) skip += 1;
  return skip ? blocks.slice(skip).join('\n\n') : String(content || '');
};

export default withoutRepeatedLead;
