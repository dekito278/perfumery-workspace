// The cart line shows what a bottle smells of, not its whole notes list.
//
// `notes` became the full material list on 2026-10-07 — the Bortnikoff format Dekito asked for. That
// is right for the field and too long for a line beside a price: Pantura is twelve notes, about 120
// characters, which wraps to three lines on a phone and pushes the size off the end of the row.
//
// Four cart pages rendered it three different ways: the two desktop ones printed it whole, the
// Indonesian phone cart clamped it to two lines in CSS, and the English phone cart showed nothing.
// One rule instead, so a fifth cart cannot invent a fourth way.

/** How many notes a cart line shows before it trails off. Three reads as a scent, not a spec. */
export const CART_LINE_NOTE_LIMIT = 3;

/**
 * The first few notes of a comma-separated list, with an ellipsis when there are more.
 *
 * Splits on the comma because that is what the field is: `Green, Wet Moss, Leather Accord, …`. A
 * value that is not a list comes back unchanged, which is what the old short summaries were and what
 * a hand-typed note would be.
 */
export const shortNoteList = (notes, limit = CART_LINE_NOTE_LIMIT) => {
  const list = String(notes ?? '').split(',').map((note) => note.trim()).filter(Boolean);
  if (list.length === 0) return '';
  if (list.length <= limit) return list.join(', ');
  return `${list.slice(0, limit).join(', ')}…`;
};
