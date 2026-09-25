// `node src/utils/blockInsidePhrasing.selfcheck.mjs`
//
// React warned about this on every visit to /studio/orders, and nothing on screen looked wrong:
//
//   validateDOMNesting(...): <p> cannot appear as a descendant of <p>
//   validateDOMNesting(...): <div> cannot appear as a descendant of <p>
//
// BriefText renders a customer's bespoke brief — paragraphs, bullets, bold runs — as a <div> holding
// <p> and <ul>. Two desktop screens put it inside a <p>. Their phone twins put it inside a <div>, which
// is why this never showed up on a phone: the same component, the same data, one surface correct.
//
// Invalid nesting is not cosmetic. The browser does not render what React wrote: it CLOSES the open <p>
// when a block element starts inside it, so the wrapper's styling stops applying part-way through and
// the rest of the brief lands as a sibling. On a hydrating page that also means the server's DOM and the
// client's differ, which is how a mismatch turns into a re-render that throws away state.
//
// The rule: a component that renders block content may not be placed inside an element that can only
// hold phrasing content. Both halves derived — the block components by reading what they return, the
// nesting by parsing the JSX around each use — because the next such component will not be called
// BriefText, and the next wrong wrapper will not be on this page.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

// <p> alone, and the line is drawn where the BROWSER draws it, not where the spec does.
//
// The HTML parser implies a </p> the moment a block-level start tag appears inside an open <p>. That is
// the case that actually restructures the document: the wrapper closes early, everything after it lands
// as a sibling styled by something else, and a hydrating page's server and client DOM disagree. React
// warns about exactly this set, which is why it was in the console and the others were not.
//
// <label> and <button> also take phrasing content by spec, and this codebase nests a <div> inside both
// — ProductForm's WearPicker and MobileCartPage's product card. The parser does NOT auto-close either,
// so the DOM is what React wrote, the click targets work, and rewriting them would churn working UI to
// satisfy a validator nobody runs. Left alone deliberately; if that ever stops being true, widen this
// set rather than adding exceptions to it.
const PHRASING_ONLY = new Set(['p']);
const BLOCK_TAGS = new Set(['div', 'p', 'ul', 'ol', 'section', 'article', 'table', 'form', 'header', 'footer']);

/**
 * Comments blanked, LENGTH PRESERVED so reported line numbers still point at the real line.
 *
 * Necessary, and the reason is itself a lesson this repo keeps relearning: MobileProductDetailPage
 * explains its own markup in a JSX comment that contains the text "a bare <p> collapses every newline".
 * A scanner that reads that as an opening tag has a <p> open for the rest of the file, and reports three
 * components on that page as badly nested when none of them are.
 */
const blankComments = (text) => text
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, (match) => match.replace(/[^\n]/g, ' '))
  .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
  .replace(/^([^\n'"`]*?)\/\/[^\n]*/gm, (match, before) => before + ' '.repeat(match.length - before.length));

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.jsx')) files.push(full);
  }
};
walk(src);

// --- 1. Which components render block content, read off what they return ---------------------------------
const blockComponents = new Map();
for (const file of files) {
  const text = blankComments(readFileSync(file, 'utf8'));
  // The root element of a returned JSX tree: `return (\n  <div ...`, or `return <div ...`.
  for (const match of text.matchAll(/return\s*\(?\s*<([a-z][\w]*)[\s>]/g)) {
    if (!BLOCK_TAGS.has(match[1])) continue;
    const name = file.split('/').pop().replace('.jsx', '');
    blockComponents.set(name, file.slice(src.length + 1));
  }
}
assert.ok(blockComponents.has('BriefText'),
  'BriefText no longer reads as a component that returns block content — this guard was written for it, '
  + `so check the scan before trusting the pass. Found: ${[...blockComponents.keys()].length} components`);
assert.ok(blockComponents.size >= 5,
  `expected to find the block-rendering components, found ${blockComponents.size} — the scan is broken`);

/**
 * The chain of open JSX elements at a character offset.
 *
 * A character scanner, not a regex. The first version of this used one, and it was wrong in a way worth
 * recording: a multi-line tag whose attributes carry braces and quotes — which is most of them in this
 * codebase — did not match to its own ">", so a self-closing <ProductGallery ... /> was pushed as an
 * open element and never popped. The stack then read ImmersiveProductPage > ... > PriceNote > p at a
 * line that has no <p> anywhere near it, and the guard reported five things that were not true.
 */
const openElementsAt = (text, offset) => {
  const stack = [];
  let index = 0;
  while (index < offset) {
    if (text[index] !== '<') { index += 1; continue; }
    const closing = text[index + 1] === '/';
    const nameStart = index + (closing ? 2 : 1);
    if (!/[A-Za-z]/.test(text[nameStart] || '')) { index += 1; continue; }
    let cursor = nameStart;
    while (/[\w.]/.test(text[cursor] || '')) cursor += 1;
    const name = text.slice(nameStart, cursor);
    // Forward to this tag's own '>', stepping over strings and brace expressions.
    let depth = 0;
    let quote = null;
    let selfClosing = false;
    while (cursor < text.length) {
      const character = text[cursor];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'" || character === '`') {
        quote = character;
      } else if (character === '{') depth += 1;
      else if (character === '}') depth -= 1;
      else if (character === '>' && depth === 0) {
        selfClosing = text[cursor - 1] === '/';
        break;
      }
      cursor += 1;
    }
    if (closing) {
      const at = stack.lastIndexOf(name);
      if (at !== -1) stack.length = at;
    } else if (!selfClosing) {
      stack.push(name);
    }
    index = cursor + 1;
  }
  return stack;
};

// --- 2. No block component sits inside a phrasing-only element -------------------------------------------
const offenders = [];
for (const file of files) {
  const text = blankComments(readFileSync(file, 'utf8'));
  for (const [name] of blockComponents) {
    if (file.endsWith(`${name}.jsx`)) continue;
    for (const use of text.matchAll(new RegExp(`<${name}[\\s/>]`, 'g'))) {
      const open = openElementsAt(text, use.index);
      const wrapper = [...open].reverse().find((element) => PHRASING_ONLY.has(element));
      if (wrapper) {
        const line = text.slice(0, use.index).split('\n').length;
        offenders.push(`${file.slice(src.length + 1)}:${line} — <${name}> inside <${wrapper}>`);
      }
    }
  }
}

assert.deepEqual(offenders, [],
  'a component that renders block content is nested inside an element that can only hold phrasing. The '
  + 'browser closes the wrapper early and the rest lands outside it, styled by something else, and on a '
  + `hydrating page the server and client DOM disagree:\n  ${offenders.join('\n  ')}`);

console.log(`blockInsidePhrasing selfcheck OK (${blockComponents.size} block-rendering components, none `
  + `of them inside a <p> across ${files.length} screens)`);
