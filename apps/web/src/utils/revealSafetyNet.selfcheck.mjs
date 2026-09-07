// `node src/utils/revealSafetyNet.selfcheck.mjs`
// The rule this protects: an element on screen is never left invisible. It exists because the desktop
// product page shipped with an add-to-cart button stuck at opacity 0 — in the DOM, clickable, unseeable.
import assert from 'node:assert/strict';

const { revealStranded, installRevealSafetyNet } = await (async () => {
  // Minimal DOM stand-in: enough for the net's two questions — is it on screen, is it revealed.
  const make = (top, height, revealed = false) => {
    const classes = new Set(revealed ? ['is-visible'] : []);
    return { classList: { add: (c) => classes.add(c), contains: (c) => classes.has(c) },
             getBoundingClientRect: () => ({ top, height, bottom: top + height }),
             get revealed() { return classes.has('is-visible'); } };
  };
  globalThis.window = { innerHeight: 800, setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {}, removeEventListener: () => {} };
  const nodes = { onScreen: make(100, 200), partly: make(-50, 120), below: make(2000, 300), already: make(50, 100, true), zeroHeight: make(100, 0) };
  globalThis.document = { querySelectorAll: () => Object.values(nodes).filter((n) => !n.revealed) };
  const mod = await import('./revealSafetyNet.js');
  return { ...mod, nodes };
})();

const nodes = globalThis.document.querySelectorAll();
revealStranded();

// On screen and stranded -> rescued.
assert.equal(nodes[0].classList.contains('is-visible'), true, 'an element inside the viewport must be revealed');
assert.equal(nodes[1].classList.contains('is-visible'), true, 'partly visible counts as on screen');
// Below the fold -> left alone, so scroll reveal still does its job.
assert.equal(nodes[2].classList.contains('is-visible'), false, 'off-screen elements must keep animating on scroll');
// A collapsed element is not "on screen".
assert.equal(nodes[3].classList.contains('is-visible'), false, 'zero-height elements are not rescued');

assert.equal(typeof installRevealSafetyNet(), 'function', 'installer returns a cleanup');

console.log('revealSafetyNet selfcheck OK');
