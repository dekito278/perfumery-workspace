export const PACE_PRIORITY_QUERY_KEY = 'pacePriority';

export const PACE_PRIORITY_MODES = [
  {
    value: 'balance',
    label: 'Balance first',
    shortLabel: 'Balance',
    helper: 'Stabilise bridge quality, harmony, and the middle structure first.',
  },
  {
    value: 'projection',
    label: 'Projection first',
    shortLabel: 'Projection',
    helper: 'Prioritise opening lift and outward diffusion before other fixes.',
  },
  {
    value: 'longevity',
    label: 'Longevity first',
    shortLabel: 'Longevity',
    helper: 'Protect drydown weight and long wear before other adjustments.',
  },
];

const PACE_PRIORITY_MODE_MAP = new Map(PACE_PRIORITY_MODES.map((mode) => [mode.value, mode]));

export const normalizePacePriorityMode = (value) => (
  PACE_PRIORITY_MODE_MAP.has(value) ? value : 'balance'
);

export const getPacePriorityModeMeta = (value) => (
  PACE_PRIORITY_MODE_MAP.get(normalizePacePriorityMode(value)) || PACE_PRIORITY_MODES[0]
);
