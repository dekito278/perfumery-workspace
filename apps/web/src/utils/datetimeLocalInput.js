// <input type="datetime-local"> speaks the browser's local clock, with no zone attached. Orders store
// timestamps in UTC, so the two only agree if something converts between them.
//
// Slicing the stored ISO string hands the input the UTC clock reading as if it were local: a shipment
// recorded at 10:00 WIB shows as 03:00, and saving that back writes 03:00 WIB — seven hours earlier.
// Every save shifts it again, so the same order edited three times lands on the previous day (audit
// round 7, fixed then on the desktop order page only).

// Stored UTC -> what the input should show. 'sv' formats as YYYY-MM-DD HH:mm in local time.
export const toDatetimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('sv').slice(0, 16).replace(' ', 'T');
};

// What the input holds -> UTC to store. new Date() reads a zoneless string as local, which is correct here.
export const fromDatetimeLocal = (value) => (value ? new Date(value).toISOString() : '');
