// What a PACE score MEANS — in one place, because two screens were answering differently.
//
// The bands and the per-metric targets lived inside FormulaWorkbookSimulationPanel.jsx, a 1392-line
// component. Nothing else could reach them, so the mobile card invented its own rule: `score >= 80` is
// "Balanced", everything else is "Review", in an amber warning badge.
//
// The same formula therefore read two ways:
//
//   score 72   desktop "Healthy"   mobile "Review"   (amber)
//   score 78   desktop "Strong"    mobile "Review"   (amber)
//
// A perfumer who opens a formula on the phone and again on the laptop is told two different things about
// one number, and the phone is the pessimistic one — so good formulas look like they need work.
//
// saas-perfumers had already lifted these out into a shared module; this is the same move against this
// repo's own copy rather than an import of saas's logic, which duplicates the analysis already computed
// in formulaWorkbookSimulation.js.
//
// Import-free so the node guard can test the bands as behaviour.

export const SCORE_BANDS = [
  { label: 'Strong', helper: '75+', tone: 'success', className: 'border-emerald-200 bg-emerald-50 text-emerald-900', min: 75 },
  { label: 'Healthy', helper: '60-74', tone: 'accent', className: 'border-primary/20 bg-primary/5 text-primary', min: 60 },
  { label: 'Needs work', helper: '40-59', tone: 'default', className: 'border-border bg-background text-foreground', min: 40 },
  { label: 'Weak', helper: '<40', tone: 'danger', className: 'border-destructive/25 bg-destructive/5 text-destructive', min: 0 },
];

export const PACE_TARGETS = {
  opening: 60,
  heart: 60,
  drydown: 62,
  diffusion: 58,
  tenacity: 62,
  harmony: 68,
  smoothness: 64,
  bridgeQuality: 62,
};

// Driven off each band's own `min`, so the thresholds cannot drift away from the "75+" / "60-74" labels
// printed next to them.
export const getScoreBand = (value) => (
  // NaN compares false against every min, so anything that is not a score falls through to the last band
  // on its own. An explicit isFinite check here would be dead code, not a safety net.
  SCORE_BANDS.find((band) => Number(value) >= band.min) || SCORE_BANDS[SCORE_BANDS.length - 1]
);

// The mobile badge speaks a different vocabulary than the desktop chips ('active'/'warning'/'danger'),
// so the mapping lives here too rather than being re-guessed on the phone.
export const getScoreBadgeTone = (value) => ({
  success: 'active',
  accent: 'active',
  default: 'warning',
  danger: 'danger',
}[getScoreBand(value).tone] || 'warning');
