/**
 * How many perfumes the collection shows before it asks the visitor to press a button.
 *
 * It was 12, against a catalogue of 18. Six perfumes — Pantura among them, in stock, priced, with its
 * English story written — sat behind a click that bought the shop nothing: the card images below the
 * fold are lazy, so they were not being downloaded either way. The button was costing discovery and
 * saving no bytes.
 *
 * 24 rather than "all of them": the paging still exists for a catalogue that genuinely outgrows one
 * screen, and a number tied to today's 18 would quietly start hiding the 25th perfume instead.
 *
 * One constant for both surfaces. Desktop and mobile drifting apart is this repo's commonest defect,
 * and here the drift would be invisible — each shop just showing a different amount of the same shelf.
 */
export const CATALOG_PAGE_SIZE = 24;

export default CATALOG_PAGE_SIZE;
