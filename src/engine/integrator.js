/**
 * Classical fourth-order Runge–Kutta step for a 2D autonomous system.
 *
 *   x' = f(x, y),  y' = g(x, y)
 *
 * Allocating variant: returns [xNext, yNext]. Convenient for tests and
 * one-shot use; avoid in tight loops because it allocates a fresh 2-element
 * array per call. Use rk4StepInto inside integrators.
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
 * In-place variant: writes [xNext, yNext] into out[0], out[1].
 * out must be a 2-element typed or plain array. Used by integrate() to
 * avoid per-step array allocations during long trajectory integrations.
 */
function rk4StepInto(f, g, x, y, dt, params, out) {
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
  out[0] = x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
  out[1] = y + (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
}

/**
 * Integrate a trajectory from (x0, y0) for `steps` of size `dt`.
 *
 * Stops early if either coordinate exceeds `bound` in magnitude (escape)
 * or becomes non-finite (blowup). This keeps unstable trajectories from
 * dominating the render and bounds the per-trajectory cost.
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
  const out = [0, 0]; // reused across all steps

  for (let i = 1; i <= steps; i++) {
    rk4StepInto(f, g, x, y, dt, params, out);
    const xn = out[0];
    const yn = out[1];
    if (xn !== xn || yn !== yn) break;                // NaN
    if (xn === Infinity || xn === -Infinity ||
        yn === Infinity || yn === -Infinity) break;
    if (Math.abs(xn) > bound || Math.abs(yn) > bound) {
      // Record the escape point so the visible portion of the curve still
      // terminates at a sensible location, then stop.
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
 * Integrate forward and backward from a common initial point, returning a
 * single trajectory ordered earliest-time-first with the IC at `icIndex`.
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
    const k = bwd.n - 1 + i;
    xs[k] = fwd.xs[i];
    ys[k] = fwd.ys[i];
    ts[k] = fwd.ts[i];
  }

  return { xs, ys, ts, n: total, icIndex: bwd.n - 1 };
}
