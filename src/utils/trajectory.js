/**
 * Linearly interpolate a trajectory at a specific time t.
 *
 * Returns { x, y, t } in the trajectory's frame, or null if t is outside
 * the trajectory's time range. Uses binary search; O(log n) per call.
 */
export function sampleTrajectoryAtT(tr, t) {
  if (!tr || tr.n < 2) return null;
  const t0 = tr.ts[0];
  const t1 = tr.ts[tr.n - 1];
  if (t < t0 || t > t1) return null;

  let lo = 0;
  let hi = tr.n - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >>> 1;
    if (tr.ts[mid] <= t) lo = mid;
    else hi = mid;
  }
  const ta = tr.ts[lo];
  const tb = tr.ts[hi];
  const span = tb - ta;
  const f = span === 0 ? 0 : (t - ta) / span;
  return {
    x: tr.xs[lo] * (1 - f) + tr.xs[hi] * f,
    y: tr.ys[lo] * (1 - f) + tr.ys[hi] * f,
    t,
  };
}
