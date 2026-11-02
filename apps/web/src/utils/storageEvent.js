// A 'storage' event fires in every OTHER tab for EVERY localStorage write — Supabase's own lock-test keys
// (lswt-…) and the visit counter included, several per page load. A listener that refetched on any of them
// turned a buyer opening perfumes in new tabs into a storm: each of the ~30 catalogue hooks in each tab
// re-downloaded the whole catalogue per write, requests ran past the 4,2 s timeout, the fallback was empty,
// and 5 of 6 product tabs landed on "page not found" (measured on the live shop, 2026-11-02).
//
// key === null is localStorage.clear(), which did change the keys being watched.
export const onStorageKeys = (keys, handler) => (event) => {
  if (event.key === null || keys.includes(event.key)) handler();
};
