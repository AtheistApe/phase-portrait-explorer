import { describe, it, expect } from 'vitest';
import { findEquilibria, jacobian } from '../src/engine/equilibria.js';

function approxContains(equilibria, target, tol = 1e-3) {
  return equilibria.some(
    (e) => Math.abs(e.x - target[0]) < tol && Math.abs(e.y - target[1]) < tol,
  );
}

describe('findEquilibria', () => {
  it('finds the single origin equilibrium of a stable linear spiral', () => {
    const f = (x, y) => -0.2 * x - y;
    const g = (x, y) => x - 0.2 * y;
    const eqs = findEquilibria({ f, g, xRange: [-3, 3], yRange: [-3, 3] });
    expect(eqs.length).toBe(1);
    expect(approxContains(eqs, [0, 0])).toBe(true);
  });

  it('finds both equilibria of the standard Lotka–Volterra system', () => {
    const a = 1, b = 1, c = 1, d = 1;
    const f = (x, y) => a * x - b * x * y;
    const g = (x, y) => d * x * y - c * y;
    // Equilibria at (0,0) and (c/d, a/b) = (1, 1).
    const eqs = findEquilibria({ f, g, xRange: [-1, 4], yRange: [-1, 4] });
    expect(approxContains(eqs, [0, 0])).toBe(true);
    expect(approxContains(eqs, [1, 1])).toBe(true);
  });

  it('finds the three equilibria of the pendulum on (-2π, 2π)', () => {
    // x' = y, y' = -sin(x) - 0.2 y; equilibria at (kπ, 0).
    const f = (_, y) => y;
    const g = (x, y) => -Math.sin(x) - 0.2 * y;
    const eqs = findEquilibria({ f, g, xRange: [-2 * Math.PI, 2 * Math.PI], yRange: [-3, 3] });
    expect(approxContains(eqs, [0, 0])).toBe(true);
    expect(approxContains(eqs, [Math.PI, 0])).toBe(true);
    expect(approxContains(eqs, [-Math.PI, 0])).toBe(true);
  });

  it('does not invent equilibria for x\' = 1', () => {
    const f = () => 1;
    const g = () => 0;
    const eqs = findEquilibria({ f, g, xRange: [-2, 2], yRange: [-2, 2] });
    expect(eqs.length).toBe(0);
  });
});

describe('jacobian', () => {
  it('matches the analytic Jacobian of a known system', () => {
    // f = x^2 + y, g = sin(x) + 2y at point (1, 0).
    // ∂f/∂x = 2x = 2; ∂f/∂y = 1; ∂g/∂x = cos(x) ≈ 0.5403; ∂g/∂y = 2.
    const f = (x, y) => x * x + y;
    const g = (x) => Math.sin(x) + 2 * 0; // y term factored out; use full call below instead
    const gFull = (x, y) => Math.sin(x) + 2 * y;
    const J = jacobian(f, gFull, 1, 0);
    expect(J.a).toBeCloseTo(2, 5);
    expect(J.b).toBeCloseTo(1, 5);
    expect(J.c).toBeCloseTo(Math.cos(1), 5);
    expect(J.d).toBeCloseTo(2, 5);
  });
});
