// Generates the hand-drawn line motifs used across the storefront.
//
// The look comes from imperfection, not from the curve. A clean bezier reads as a logo; these
// references read as drawings because the hand wavers, overshoots the corner, and goes over the same
// contour twice without landing in the same place. So: interpolate a spline through control points,
// walk it while drifting perpendicular to the direction of travel, and lay down two or three passes
// that disagree slightly.
//
// Output is committed (src/components/line/paths.js) so builds stay deterministic — this runs only
// when someone wants new motifs:  node tools/line-art/generate.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const mulberry = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const catmull = (pts, per = 24) => {
  const p = [pts[0], ...pts, pts[pts.length - 1]];
  const out = [];
  for (let i = 0; i < p.length - 3; i += 1) {
    const [p0, p1, p2, p3] = [p[i], p[i + 1], p[i + 2], p[i + 3]];
    for (let s = 0; s < per; s += 1) {
      const t = s / per; const t2 = t * t; const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

// Drift perpendicular to travel — a wrist wobble, not per-point noise, which would read as a jagged
// edge rather than a drawn line. Eased at both ends so strokes start and finish on the intended point.
const waver = (pts, { amp = 2.6, drift = 0.55, overshoot = 0, seed = 1 }) => {
  const rnd = mulberry(seed);
  let off = 0; let vel = 0;
  const n = pts.length;
  const out = pts.map(([x, y], i) => {
    vel += (rnd() * 2 - 1) * drift; vel *= 0.82;
    off = Math.max(-amp, Math.min(amp, off + vel));
    const j = pts[Math.min(i + 1, n - 1)]; const k = pts[Math.max(i - 1, 0)];
    const dx = j[0] - k[0]; const dy = j[1] - k[1];
    const L = Math.hypot(dx, dy) || 1;
    const ease = Math.min(1, i / (n * 0.12)) * Math.min(1, (n - i) / (n * 0.12));
    return [x + (-dy / L) * off * ease, y + (dx / L) * off * ease];
  });
  if (overshoot > 0 && out.length > 3) {
    const [ax, ay] = out[out.length - 2]; const [bx, by] = out[out.length - 1];
    const dx = bx - ax; const dy = by - ay;
    [0.4, 0.9, 1.5].forEach((t) => out.push([bx + dx * t * overshoot, by + dy * t * overshoot + (rnd() * 3 - 1.5)]));
  }
  return out;
};

const d = (pts) => `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}`;

const stroke = (ctrl, { passes = 2, amp = 2.6, width = 1.35, overshoot = 0, seed = 1 } = {}) => {
  const base = catmull(ctrl);
  const opacity = [1, 0.45, 0.3];
  return Array.from({ length: passes }, (_, p) => ({
    d: d(waver(base, { amp: amp * (1 + 0.35 * p), overshoot: p === 0 ? overshoot : overshoot * 1.6, seed: seed * 97 + p * 31 })),
    width: Number((width * (1 - 0.18 * p)).toFixed(2)),
    opacity: opacity[Math.min(p, 2)],
  }));
};

const coil = (cx, cy, r, { turns = 3.2, n = 140, squash = 0.62 } = {}) => (
  Array.from({ length: n }, (_, t) => [
    cx + r * (1 - 0.42 * t / n) * Math.cos((t / n) * turns * 2 * Math.PI),
    cy + r * squash * (1 - 0.42 * t / n) * Math.sin((t / n) * turns * 2 * Math.PI),
  ])
);

const motifs = {
  divider: {
    viewBox: '0 0 900 150',
    strokes: [
      ...stroke([[14, 86], [120, 44], [196, 120], [268, 80], [360, 26], [452, 68], [540, 104], [596, 44], [690, 98], [772, 58], [840, 74], [892, 50]],
        { passes: 2, amp: 3.4, width: 1.5, overshoot: 0.28, seed: 7 }),
      ...stroke([[596, 44], [646, 12], [690, 34], [668, 68], [614, 74], [596, 44], [586, 28]],
        { passes: 1, amp: 2.2, width: 1.2, overshoot: 0.5, seed: 19 }).map((s) => ({ ...s, opacity: 0.6 })),
    ],
  },
  vessel: {
    viewBox: '0 0 320 440',
    strokes: [
      ...stroke([[150, 44], [140, 86], [120, 104], [92, 140], [86, 200], [86, 340], [96, 372], [126, 382], [206, 382], [238, 370], [246, 340], [246, 200], [238, 140], [210, 104], [188, 86], [178, 44], [150, 44], [152, 60], [178, 62]],
        { passes: 3, amp: 2.9, width: 1.5, overshoot: 0.22, seed: 3 }),
      ...stroke([[96, 232], [140, 258], [196, 252], [238, 220]], { passes: 1, amp: 2.4, width: 1.2, seed: 11 }).map((s) => ({ ...s, opacity: 0.55 })),
    ],
  },
  // A single coil, square, for use inside a small tile.
  mark: {
    viewBox: '0 0 120 120',
    strokes: stroke(coil(60, 60, 34, { turns: 2.8, n: 120, squash: 0.78 }), { passes: 1, amp: 2.2, width: 1.6, seed: 41 }),
  },
  scribble: {
    viewBox: '0 0 900 150',
    strokes: [
      [110, 44, 2, 0.95], [330, 40, 8, 0.8], [560, 36, 14, 0.65], [770, 30, 22, 0.5],
    ].flatMap(([x, r, seed, op]) => stroke(coil(x, 72, r), { passes: 1, amp: 2, width: 1.05, seed }).map((s) => ({ ...s, opacity: op }))),
  },
};

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'src', 'components', 'line', 'paths.js');
writeFileSync(out, `// GENERATED by tools/line-art/generate.mjs — do not edit by hand.\n`
  + `// Re-run that script to redraw the motifs (each run is deterministic; the seeds live in the script).\n`
  + `export const LINE_MOTIFS = ${JSON.stringify(motifs, null, 2)};\n`);
console.log(`wrote ${out}`);
Object.entries(motifs).forEach(([k, m]) => console.log(`  ${k}: ${m.strokes.length} strokes`));
