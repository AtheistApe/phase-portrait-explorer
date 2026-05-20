/**
 * Shared visual constants. Keeping these centralized so the PhasePlane,
 * TimeSeries, and JacobianPanel agree on the per-trajectory and
 * per-stability palettes.
 */

export const TRAJ_COLORS = [
  '#d4ff4a', '#5ee2ff', '#ff7a59', '#bd93ff',
  '#ffd166', '#06d6a0', '#ff5ec4', '#73e8ff',
];

export function colorForTraj(i) {
  return TRAJ_COLORS[i % TRAJ_COLORS.length];
}

export const EQ_COLOR = {
  stable: '#06d6a0',
  unstable: '#ff5e7e',
  neutral: '#73e8ff',
  unknown: '#a0a0a0',
};

export const BG = '#0e1118';
