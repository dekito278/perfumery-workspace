export const PACE_PRIORITY_QUERY_KEY = 'pacePriority';

export const PACE_PRIORITY_MODES = [
  {
    value: 'balance',
    label: 'Utamakan keseimbangan',
    shortLabel: 'Keseimbangan',
    helper: 'Rapikan dulu kualitas jembatan, harmoni, dan struktur nada tengah.',
  },
  {
    value: 'projection',
    label: 'Utamakan pancaran',
    shortLabel: 'Pancaran',
    helper: 'Dahulukan angkatan pembuka dan sebaran keluar sebelum perbaikan lain.',
  },
  {
    value: 'longevity',
    label: 'Utamakan ketahanan',
    shortLabel: 'Ketahanan',
    helper: 'Jaga bobot jejak akhir dan ketahanan pakai sebelum penyesuaian lain.',
  },
];

const PACE_PRIORITY_MODE_MAP = new Map(PACE_PRIORITY_MODES.map((mode) => [mode.value, mode]));

export const normalizePacePriorityMode = (value) => (
  PACE_PRIORITY_MODE_MAP.has(value) ? value : 'balance'
);

export const getPacePriorityModeMeta = (value) => (
  PACE_PRIORITY_MODE_MAP.get(normalizePacePriorityMode(value)) || PACE_PRIORITY_MODES[0]
);
