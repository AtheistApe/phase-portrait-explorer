/**
 * Find equilibria of a 2D autonomous system on a bounded domain.
 *
 * Strategy: sample on a coarse grid, identify cells where |f| + |g| is small
 * relative to neighbors, then refine each candidate with damped Newton steps.
 * De-duplicate by proximity in the original coordinates.
 *
 * This is a heuristic, not a rigorous root finder; it will find the obvious
 * equilibria of textbook systems but can miss roots near domain boundaries
 * or those clustered tighter than the grid resolution. Adequate for v1.
 */

const EPS_FD = 1e-5;       // finite difference step for Jacobian
const NEWTON_MAX_ITER = 40;
const NEWTON_TOL = 1e-10;
const NEWTON_DAMP = 1.0;
const DEDUP_TOL = 1e-3;    // distance threshold in world coordinates

/**
 * Numerical 2x2 Jacobian via central differences.
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
 * One Newton step toward F(x,y) = (f, g) = 0 with damping.
 * Returns [xNext, yNext, ok]. ok=false if Jacobian is singular.
 */
function newtonStep(f, g, x, y, params) {
  const fx = f(x, y, params);
  const gx = g(x, y, params);
  const { a, b, c, d } = jacobian(f, g, x, y, params);
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-14) return [x, y, false];
  // [x;y] -= J^{-1} F
  const dx = (d * fx - b * gx) / det;
  const dy = (-c * fx + a * gx) / det;
  return [x - NEWTON_DAMP * dx, y - NEWTON_DAMP * dy, true];
}

/**
 * Refine a candidate point with Newton iteration. Returns null on failure.
 */
function refine(f, g, x0, y0, params) {
  let x = x0;
  let y = y0;
  for (let i = 0; i < NEWTON_MAX_ITER; i++) {
    const fv = f(x, y, params);
    const gv = g(x, y, params);
    if (!Number.isFinite(fv) || !Number.isFinite(gv)) return null;
    const res = Math.hypot(fv, gv);
    if (res < NEWTON_TOL) return { x, y };
    const [xn, yn, ok] = newtonStep(f, g, x, y, params);
    if (!ok) return null;
    if (!Number.isFinite(xn) || !Number.isFinite(yn)) return null;
    x = xn;
    y = yn;
  }
  // Final check.
  if (Math.hypot(f(x, y, params), g(x, y, params)) < 1e-6) return { x, y };
  return null;
}

/**
 * Find equilibria within the given rectangle.
 *
 * @param {Object} opts
 * @param {Function} opts.f - dx/dt evaluator
 * @param {Function} opts.g - dy/dt evaluator
 * @param {[number, number]} opts.xRange - [xmin, xmax]
 * @param {[number, number]} opts.yRange - [ymin, ymax]
 * @param {number} [opts.gridN=20] - samples per axis
 * @param {Object} [opts.params]
 * @returns {{x:number, y:number}[]}
 */
export function findEquilibria({ f, g, xRange, yRange, gridN = 20, params }) {
  const [x0, x1] = xRange;
  const [y0, y1] = yRange;
  const dx = (x1 - x0) / gridN;
  const dy = (y1 - y0) / gridN;
  const seeds = [];

  // Walk the grid, seeding from every cell. Newton handles the discrimination.
  for (let i = 0; i <= gridN; i++) {
    for (let j = 0; j <= gridN; j++) {
      const sx = x0 + i * dx;
      const sy = y0 + j * dy;
      const fv = f(sx, sy, params);
      const gv = g(sx, sy, params);
      if (Number.isFinite(fv) && Number.isFinite(gv)) {
        seeds.push([sx, sy]);
      }
    }
  }

  const found = [];
  for (const [sx, sy] of seeds) {
    const root = refine(f, g, sx, sy, params);
    if (!root) continue;
    if (root.x < x0 - 1e-3 || root.x > x1 + 1e-3) continue;
    if (root.y < y0 - 1e-3 || root.y > y1 + 1e-3) continue;
    // Deduplicate.
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
