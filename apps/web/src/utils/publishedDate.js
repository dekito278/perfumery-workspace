// The day an article says it was published, edited in Studio as a plain date.
//
// published_at is a timestamp the database stamps on first publish. Shown as a date in the reader's own
// time zone, so the box must read it in local time too: slicing the UTC string would show an article
// published at 03:00 WIB as the day before. A day picked in the box is stored at local NOON, which no
// time-zone shift between Jakarta and UTC can push onto another day. An unchanged day keeps the exact
// original timestamp, so opening and saving an article never moves it.
//
// Import-free so the guard runs the real thing.
const pad = (value) => String(value).padStart(2, '0');

export const toDateInputValue = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const fromDateInputValue = (value, previousIso = null) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return previousIso || null;
  if (previousIso && toDateInputValue(previousIso) === value) return previousIso;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? (previousIso || null) : date.toISOString();
};
