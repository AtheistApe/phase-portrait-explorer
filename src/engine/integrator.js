/**
 * Classical fourth-order Runge–Kutta step for a 2D autonomous system.
 *
 *   x' = f(x, y),  y' = g(x, y)
 *
 * Returns [xNext, yNext]. Pure function; the caller owns state.
 */
export function rk4Step(f, g, x, y, dt, params) {
  const k1x = f(x, y, params);
  const k1y = g(x, y, params);

  const x2 = x + 0.5 * dt * k1x;
  const y2 = y + 0.5 * dt * k1y;
  const k2x = f(x2, y2, params);
  const k2y = g(x2, y2, params);

  const x3 = x + 0.5 * dt * k2x;
  const y3 = y + 0.5 * dt * k2y;
  const k3x = f(x3, y3, params);
  const k3y = g(x3, y3, params);

  const x4 = x + dt * k3x;
  const y4 = y + dt * k3y;
  const k4x = f(x4, y4, params);
  const k4y = g(x4, y4, params);

  return [
    x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x),
    y + (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y),
  ];
}

/**
 * Integrate a trajectory from (x0, y0) for `steps` of size `dt`.
 *
 * Stops early if either coordinate exceeds `bound` in magnitude (escape)
 * or becomes non-finite (blowup). This keeps unstable trajectories from
 * dominating the render and locks down a predictable per-trajectory cost.
 *
 * @param {Object} opts
 * @param {Function} opts.f - dx/dt evaluator
 * @param {Function} opts.g - dy/dt evaluator
 * @param {number} opts.x0 - initial x
 * @param {number} opts.y0 - initial y
 * @param {number} opts.dt - step size (negative for backward integration)
 * @param {number} opts.steps - number of steps
 * @param {number} [opts.bound=1e4] - magnitude bound for early termination
 * @param {Object} [opts.params] - parameter values
 * @returns {{ xs: Float64Array, ys: Float64Array, ts: Float64Array, n: number }}
 *   Arrays are full size; `n` is the number of valid points (≤ steps + 1).
 */
export function integrate({ f, g, x0, y0, dt, steps, bound = 1e4, params }) {
  const xs = new Float64Array(steps + 1);
  const ys = new Float64Array(steps + 1);
  const ts = new Float64Array(steps + 1);

  xs[0] = x0;
  ys[0] = y0;
  ts[0] = 0;

  let x = x0;
  let y = y0;
  let n = 1;

  for (let i = 1; i <= steps; i++) {
    const [xn, yn] = rk4Step(f, g, x, y, dt, params);
    if (!Number.isFinite(xn) || !Number.isFinite(yn)) break;
    if (Math.abs(xn) > bound || Math.abs(yn) > bound) {
      xs[i] = xn;
      ys[i] = yn;
      ts[i] = i * dt;
      n = i + 1;
      break;
    }
    xs[i] = xn;
    ys[i] = yn;
    ts[i] = i * dt;
    x = xn;
    y = yn;
    n = i + 1;
  }

  return { xs, ys, ts, n };
}

/**
 * Integrate both forward and backward from an initial point, producing a
 * single trajectory that runs through the IC. Useful so click-to-seed shows
 * the full orbit segment near the click, not just where it goes next.
 *
 * Returns arrays where index 0 is the earliest time (most negative) and the
 * final index is the latest time. The IC is at index `backSteps`.
 */
export function integrateBoth({ f, g, x0, y0, dt, forwardSteps, backwardSteps, bound = 1e4, params }) {
  const fwd = integrate({ f, g, x0, y0, dt, steps: forwardSteps, bound, params });
  const bwd = integrate({ f, g, x0, y0, dt: -dt, steps: backwardSteps, bound, params });

  const total = bwd.n + fwd.n - 1; // shared IC point
  const xs = new Float64Array(total);
  const ys = new Float64Array(total);
  const ts = new Float64Array(total);

  // Backward run reversed (oldest first), then forward (skipping shared IC).
  for (let i = 0; i < bwd.n; i++) {
    const j = bwd.n - 1 - i;
    xs[i] = bwd.xs[j];
    ys[i] = bwd.ys[j];
    ts[i] = bwd.ts[j];
  }
  for (let i = 1; i < fwd.n; i++) {
    xs[bwd.n - 1 + i] = fwd.xs[i];
    ys[bwd.n - 1 + i] = fwd.ys[i];
    ts[bwd.n - 1 + i] = fwd.ts[i];
  }

  return { xs, ys, ts, n: total, icIndex: bwd.n - 1 };
}
