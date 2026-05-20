/**
 * Find equilibria of a 2D autonomous system on a bounded domain.
 *
 * Strategy:
 *   1. Sample |f| + |g| on a (gridN+1)² grid.
 *   2. Take grid points that are local minima vs their 8 neighbors. These
 *      are the only plausible Newton starting points; anywhere |f|+|g| is
 *      decreasing toward, an equilibrium can only sit downhill of.
 *   3. Run damped Newton from each seed. Discard non-converging seeds and
 *      roots outside the domain.
 *   4. Deduplicate by proximity in world coordinates.
 *
 * Pre-screening typically cuts the seed count from O(gridN²) ≈ 225 down
 * to under 20, which is the difference between a noticeable hitch on
 * every parameter slider tick and a hitch-free drag.
 *
 * This is heuristic, not rigorous. It catches the obvious equilibria of
 * textbook systems but can miss roots clustered tighter than the grid
 * resolution. Bump gridN at the call site if you hit that case.
 */

const EPS_FD = 1e-5;        // finite-difference step for Jacobian
const NEWTON_MAX_ITER = 40;
const NEWTON_TOL = 1e-10;
const DEDUP_TOL = 1e-3;     // world-coord distance for deduplication

/**
 * Numerical 2×2 Jacobian via central differences.
 */
export function jacobian(f, g, x, y, params, h = EPS_FD) {
  const fxp = f(x + h, y, params);
  const fxm = f(x - h, y, params);
  const fyp = f(x, y + h, params);
  const fym = f(x, y - h, params);
  const gxp = g(x + h, y, params);
  const gxm = g(x - h, y, params);
  const gyp = g(x, y + h, params);
  const gym = g(x, y - h, params);
  return {
    a: (fxp - fxm) / (2 * h), // ∂f/∂x
    b: (fyp - fym) / (2 * h), // ∂f/∂y
    c: (gxp - gxm) / (2 * h), // ∂g/∂x
    d: (gyp - gym) / (2 * h), // ∂g/∂y
  };
}

/**
 * Refine a candidate point with damped Newton. Returns {x, y} or null.
 * Damping defaults to 1 (full Newton); the variable exists so we can
 * back off if a step appears to diverge.
 */
function refine(f, g, x0, y0, params) {
  let x = x0;
  let y = y0;
  let prevRes = Infinity;
  for (let i = 0; i < NEWTON_MAX_ITER; i++) {
    const fv = f(x, y, params);
    const gv = g(x, y, params);
    if (!Number.isFinite(fv) || !Number.isFinite(gv)) return null;
    const res = Math.hypot(fv, gv);
    if (res < NEWTON_TOL) return { x, y };
    const J = jacobian(f, g, x, y, params);
    const det = J.a * J.d - J.b * J.c;
    if (Math.abs(det) < 1e-14) return null;
    // Damp if the residual just grew (Newton overshoot).
    const damp = res > prevRes ? 0.5 : 1.0;
    const dx = (J.d * fv - J.b * gv) / det;
    const dy = (-J.c * fv + J.a * gv) / det;
    x -= damp * dx;
    y -= damp * dy;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    prevRes = res;
  }
  // Final residual check; sometimes we're close but not under tol.
  if (Math.hypot(f(x, y, params), g(x, y, params)) < 1e-6) return { x, y };
  return null;
}

/**
 * Find equilibria within the given rectangle.
 *
 * @param {Object} opts
 * @param {Function} opts.f - dx/dt evaluator
 * @param {Function} opts.g - dy/dt evaluator
 * @param {[number, number]} opts.xRange
 * @param {[number, number]} opts.yRange
 * @param {number} [opts.gridN=14] - samples per axis minus 1 (we use gridN+1 points)
 * @param {Object} [opts.params]
 * @returns {{x:number, y:number}[]}
 */
export function findEquilibria({ f, g, xRange, yRange, gridN = 14, params }) {
  const [x0, x1] = xRange;
  const [y0, y1] = yRange;
  const dx = (x1 - x0) / gridN;
  const dy = (y1 - y0) / gridN;
  const N = gridN + 1;

  // Sample |f| + |g| on the grid.
  const mag = new Float64Array(N * N);
  for (let i = 0; i < N; i++) {
    const sx = x0 + i * dx;
    const base = i * N;
    for (let j = 0; j < N; j++) {
      const sy = y0 + j * dy;
      const fv = f(sx, sy, params);
      const gv = g(sx, sy, params);
      mag[base + j] = Number.isFinite(fv) && Number.isFinite(gv)
        ? Math.abs(fv) + Math.abs(gv)
        : Infinity;
    }
  }

  // Local-minimum pre-screening: cell (i, j) is a seed iff no neighbor in
  // the 3×3 stencil has a strictly smaller value. Ties pass through.
  const seeds = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const v = mag[i * N + j];
      if (!Number.isFinite(v)) continue;
      let isMin = true;
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(N - 1, i + 1);
      const j0 = Math.max(0, j - 1);
      const j1 = Math.min(N - 1, j + 1);
      for (let ii = i0; ii <= i1 && isMin; ii++) {
        for (let jj = j0; jj <= j1; jj++) {
          if (ii === i && jj === j) continue;
          if (mag[ii * N + jj] < v) { isMin = false; break; }
        }
      }
      if (isMin) seeds.push([x0 + i * dx, y0 + j * dy]);
    }
  }

  const found = [];
  for (const [sx, sy] of seeds) {
    const root = refine(f, g, sx, sy, params);
    if (!root) continue;
    if (root.x < x0 - 1e-3 || root.x > x1 + 1e-3) continue;
    if (root.y < y0 - 1e-3 || root.y > y1 + 1e-3) continue;
    let isDup = false;
    for (const e of found) {
      if (Math.hypot(e.x - root.x, e.y - root.y) < DEDUP_TOL) {
        isDup = true;
        break;
      }
    }
    if (!isDup) found.push(root);
  }
  return found;
}
