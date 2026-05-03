export const MOBILE_PAGE_SIZE = 7;
export const MOBILE_ACTIVITY_LIMIT = 5;

export const filterByText = (items, query, fields) => {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) {
    return items;
  }

  return items.filter((item) => fields
    .map((field) => (typeof field === 'function' ? field(item) : item[field]))
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized)));
};

export const sortByUpdated = (items) => [...items].sort((left, right) =>
  new Date(right.updated || right.created || 0).getTime() - new Date(left.updated || left.created || 0).getTime()
);

export const getVisibleItems = (items, visibleCount) => items.slice(0, visibleCount);

export const getDisplayName = (currentUser) =>
  currentUser?.user_metadata?.name?.trim()
  || currentUser?.email?.split('@')[0]
  || 'Dekito';
