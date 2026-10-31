// `node src/utils/scriptName.selfcheck.mjs`
// The aksara line comes from the product's own name, and only from it.
import assert from 'node:assert/strict';
import { splitScriptName } from './scriptName.js';

assert.deepEqual(splitScriptName('Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀)'), { name: 'Ayang-ayang', script: 'ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀' });
assert.deepEqual(splitScriptName('Maskumambang'), { name: 'Maskumambang', script: '' }, 'no aksara in the name, none on the page');
assert.deepEqual(splitScriptName('HUG N°1'), { name: 'HUG N°1', script: '' });
assert.deepEqual(splitScriptName('Vial (2 ml)'), { name: 'Vial (2 ml)', script: '' }, 'brackets without aksara stay part of the name');
assert.deepEqual(splitScriptName(null), { name: '', script: '' });
console.log('scriptName selfcheck OK (the aksara line is read from the name, never written for it)');
