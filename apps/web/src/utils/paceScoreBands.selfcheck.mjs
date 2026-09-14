// `node src/utils/paceScoreBands.selfcheck.mjs`
//
// What a PACE score MEANS was defined twice, and the two definitions disagreed.
//
// SCORE_BANDS and PACE_TARGETS lived inside FormulaWorkbookSimulationPanel.jsx (1392 lines), unreachable
// from anywhere else, so the mobile card invented its own rule: >= 80 is "Balanced", everything else is
// "Review" in an amber warning badge. The same formula read two ways:
//
//   score 72   desktop "Healthy"   mobile "Review" (amber)
//   score 78   desktop "Strong"    mobile "Review" (amber)
//
// Open a formula on the phone and again on the laptop and you were told two different things about one
// number — with the phone the pessimistic one, so healthy formulas looked like they needed work.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PACE_TARGETS, SCORE_BANDS, getScoreBand, getScoreBadgeTone } from './paceScoreBands.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => stripComments(readFileSync(join(srcRoot, ...parts), 'utf8'));

// --- 1. The boundaries, exactly where the printed labels say they are --------------------------------
for (const [score, label] of [[100, 'Strong'], [75, 'Strong'], [74.9, 'Healthy'], [60, 'Healthy'],
  [59.9, 'Needs work'], [40, 'Needs work'], [39.9, 'Weak'], [0, 'Weak']]) {
  assert.equal(getScoreBand(score).label, label, `${score} must read as "${label}"`);
}

// The two scores that used to disagree between the screens.
assert.equal(getScoreBand(72).label, 'Healthy', '72 is the case the phone used to call "Review"');
assert.equal(getScoreBand(78).label, 'Strong', '78 is the case the phone used to call "Review"');
assert.equal(getScoreBadgeTone(72), 'active', 'and the phone must stop showing it as an amber warning');
assert.equal(getScoreBadgeTone(78), 'active');
assert.equal(getScoreBadgeTone(50), 'warning', 'a genuinely middling score still warns');
assert.equal(getScoreBadgeTone(20), 'danger', 'and a weak one is not merely a warning');

// --- 2. The labels must match the thresholds they advertise -------------------------------------------
// The helper text ("75+", "60-74") is printed next to the chip, so a threshold that drifts away from its
// own label is a lie on screen rather than a silent bug.
for (const band of SCORE_BANDS) {
  const printed = band.helper.match(/(\d+)/);
  if (band.helper.startsWith('<')) {
    assert.equal(band.min, 0, 'the bottom band catches everything below the one above it');
    continue;
  }
  assert.equal(band.min, Number(printed[1]), `the "${band.helper}" band must actually start at ${printed[1]}`);
}

// Ordered high to low, or `find` returns the wrong band.
for (let i = 1; i < SCORE_BANDS.length; i += 1) {
  assert.ok(SCORE_BANDS[i].min < SCORE_BANDS[i - 1].min, 'bands must be ordered high to low');
}

// --- 3. Nonsense in must not become a confident answer ------------------------------------------------
for (const bad of [null, undefined, NaN, 'abc', {}]) {
  assert.equal(getScoreBand(bad).label, 'Weak', `${JSON.stringify(bad)} is not a score and must not read as healthy`);
}
assert.equal(getScoreBand('72').label, 'Healthy', 'a numeric string is still a score');

// --- 4. Neither screen may define its own bands any more ----------------------------------------------
const desktop = read('components', 'FormulaWorkbookSimulationPanel.jsx');
assert.match(desktop, /import \{[^}]*getScoreBand[^}]*\} from '@\/utils\/paceScoreBands\.js'/,
  'the desktop panel must read the shared bands');
assert.doesNotMatch(desktop, /const SCORE_BANDS = \[/, 'and must not keep a private copy of them');
assert.doesNotMatch(desktop, /const PACE_TARGETS = \{/, 'nor a private copy of the per-metric targets');
assert.doesNotMatch(desktop, /const getScoreBand = /, 'nor its own banding rule');

const mobile = read('components', 'mobile', 'PaceAnalysisCard.jsx');
assert.match(mobile, /getScoreBand\(numericScore\)/, 'the mobile card must band the score the same way');
assert.doesNotMatch(mobile, /numericScore >= \d+/,
  'the mobile card must not compare the score against a threshold of its own');
assert.doesNotMatch(mobile, /'Balanced'/, '"Balanced" was a label only the phone knew');

// A missing score is still its own case on the phone — it must not render as a red "Weak".
assert.match(mobile, /hasScore \? getScoreBand/, 'no score means no band, not the worst band');
assert.match(mobile, /'No score'/, 'and it must still say so');

// --- 5. The targets are the desktop's, unchanged -------------------------------------------------------
assert.deepEqual(PACE_TARGETS, {
  opening: 60, heart: 60, drydown: 62, diffusion: 58,
  tenacity: 62, harmony: 68, smoothness: 64, bridgeQuality: 62,
}, 'extracting the targets must not quietly retune them');

console.log('paceScoreBands selfcheck OK (one PACE score, one verdict, on both screens)');
