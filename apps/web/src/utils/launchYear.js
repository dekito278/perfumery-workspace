// The year a perfume was released, as the atelier states it in Studio — or null.
//
// The field is a plain number input, so an emptied box arrives as '' and must not reach the integer column
// (Postgres refuses it, and the save fails). Anything that is not a plausible year is "not stated": the
// product page then shows no "Rilis …" at all, which is the honest answer. Never derived from created_at.
export const toLaunchYear = (value) => {
  const year = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
};
