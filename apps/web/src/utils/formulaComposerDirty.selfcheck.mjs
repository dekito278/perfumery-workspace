// `node src/utils/formulaComposerDirty.selfcheck.mjs`
//
// All four formula composer pages had NO protection against losing unsaved work — not a browser prompt,
// not an in-app confirmation, nothing. Close the tab mid-composition and it was gone. The product forms
// and the journal editor had guarded this for a long time; the composer, where the longest sessions
// happen, had not.
//
// The create pages could ask `some(item => item_id || gram > 0)` because they start empty. The edit
// pages start FULL, so "touched" can only mean "differs from what loaded" — which is what this snapshot
// is for, and why it is one shared function rather than four page-local guesses.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { formulaComposerSnapshot, isFormulaComposerDirty } from './formulaComposerDirty.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(join(src, ...p), 'utf8');

const base = {
  name: 'Sunda', code: 'SND-1', category: 'perfume', version: '1', status: 'draft', notes: '',
  formulaItems: [{ item_id: 'm1', gram_amount: '10', dilution_percent: '', dilution_solvent_id: '' }],
};
const snap = formulaComposerSnapshot(base);

// --- what counts as a change ------------------------------------------------------------------------
for (const [label, patch] of [
  ['nama', { name: 'Sunda Baru' }],
  ['kode', { code: 'SND-2' }],
  ['kategori', { category: 'accord' }],
  ['versi', { version: '2' }],
  ['status', { status: 'final' }],
  ['catatan', { notes: 'diubah' }],
  ['gram', { formulaItems: [{ ...base.formulaItems[0], gram_amount: '11' }] }],
  ['material', { formulaItems: [{ ...base.formulaItems[0], item_id: 'm2' }] }],
  ['pengenceran', { formulaItems: [{ ...base.formulaItems[0], dilution_percent: '10' }] }],
  ['baris baru', { formulaItems: [...base.formulaItems, { item_id: 'm3', gram_amount: '5' }] }],
]) {
  assert.notEqual(formulaComposerSnapshot({ ...base, ...patch }), snap, `${label} harus terhitung berubah`);
}

// --- what must NOT count ------------------------------------------------------------------------------
// A dirty flag that fires on its own teaches people to click straight through the warning, which is
// worse than not having one.
assert.equal(formulaComposerSnapshot({ ...base, formulaItems: [{ ...base.formulaItems[0], row_key: 'x-99' }] }), snap,
  'kunci baris berubah tiap render — tidak boleh dianggap perubahan');
assert.equal(formulaComposerSnapshot({ ...base, formulaItems: [{ ...base.formulaItems[0], percentage: 42 }] }), snap,
  'persentase itu turunan, bukan yang diketik orang');
assert.equal(formulaComposerSnapshot({ ...base, name: '  Sunda  ' }), snap, 'spasi tepi bukan perubahan');
assert.equal(formulaComposerSnapshot({ ...base, formulaItems: [...base.formulaItems, { item_id: '', gram_amount: '' }] }), snap,
  'baris kosong yang selalu tersedia di composer bukan perubahan');

// --- the flag itself -----------------------------------------------------------------------------------
assert.equal(isFormulaComposerDirty(snap, snap), false);
assert.equal(isFormulaComposerDirty('berbeda', snap), true);
assert.equal(isFormulaComposerDirty(snap, ''), false,
  'sebelum data termuat belum ada pembanding — jangan memperingatkan apa pun');

// --- every composer page is protected -------------------------------------------------------------------
for (const page of ['pages/CreateFormulaPage.jsx', 'pages/EditFormulaPage.jsx',
                    'pages/mobile/MobileCreateFormulaPage.jsx', 'pages/mobile/MobileEditFormulaPage.jsx']) {
  const source = read(...page.split('/'));
  assert.match(source, /useUnsavedChangesWarning\(/, `${page} harus memasang peringatan kerja belum disimpan`);
}
// The edit pages start full, so they need the snapshot; the create pages start empty and already had a flag.
for (const page of ['pages/EditFormulaPage.jsx', 'pages/mobile/MobileEditFormulaPage.jsx']) {
  const source = read(...page.split('/'));
  assert.match(source, /setSavedSnapshot\(formulaComposerSnapshot\(/, `${page} harus mencatat keadaan saat dimuat`);
  assert.match(source, /isFormulaComposerDirty\(currentSnapshot, savedSnapshot\)/, `${page} harus membandingkan dengannya`);
}

// The hook stays free of window.confirm: this repo routes every confirmation through confirmAction (#121),
// and its guard fails the build on a stray window.confirm.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
assert.doesNotMatch(stripComments(read('hooks', 'useUnsavedChangesWarning.js')), /window\.confirm/,
  'konfirmasi in-app lewat confirmAction, bukan dialog bawaan browser');

console.log('formulaComposerDirty selfcheck OK (empat halaman composer terlindungi; sinyal dirty tidak menyala sendiri)');
