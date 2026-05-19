import { describe, it, expect } from 'vitest';
import { rk4Step, integrate, integrateBoth } from '../src/engine/integrator.js';

describe('rk4Step', () => {
  it('reproduces analytic decay x\' = -x to high accuracy', () => {
    const f = (x) => -x;
    const g = () => 0;
    let x = 1, y = 0;
    const dt = 0.01;
    const T = 1.0;
    const steps = Math.round(T / dt);
    for (let i = 0; i < steps; i++) {
      [x, y] = rk4Step(f, g, x, y, dt);
    }
    // True value: e^{-1} ≈ 0.367879
    expect(x).toBeCloseTo(Math.exp(-1), 6);
  });

  it('approximately conserves the Hamiltonian of the harmonic oscillator over one period', () => {
    // x' = y, y' = -x has H = (x^2 + y^2)/2 conserved.
    const f = (_, y) => y;
    const g = (x) => -x;
    let x = 1, y = 0;
    const H0 = 0.5 * (x * x + y * y);
    const dt = 0.01;
    const period = 2 * Math.PI;
    const steps = Math.round(period / dt);
    for (let i = 0; i < steps; i++) {
      [x, y] = rk4Step(f, g, x, y, dt);
    }
    const H1 = 0.5 * (x * x + y * y);
    // RK4 isn't symplectic but for one period with dt=0.01 the error is tiny.
    expect(Math.abs(H1 - H0)).toBeLessThan(1e-6);
  });
});

describe('integrate', () => {
  it('returns the requested number of steps + 1 points', () => {
    const result = integrate({
      f: () => 1,
      g: () => 0,
      x0: 0,
      y0: 0,
      dt: 0.1,
      steps: 10,
    });
    expect(result.n).toBe(11);
    expect(result.xs[10]).toBeCloseTo(1.0, 8);
  });

  it('terminates early when the trajectory escapes the bound', () => {
    // x' = x grows without bound; bound = 10 should stop us early.
    const result = integrate({
      f: (x) => x,
      g: () => 0,
      x0: 1,
      y0: 0,
      dt: 0.1,
      steps: 1000,
      bound: 10,
    });
    expect(result.n).toBeLessThan(1000);
    expect(Math.abs(result.xs[result.n - 1])).toBeGreaterThan(10);
  });

  it('integrates backward in time when dt is negative', () => {
    // x' = -x, integrating backward from x=1 should give x = e^t (growing).
    const result = integrate({
      f: (x) => -x,
      g: () => 0,
      x0: 1,
      y0: 0,
      dt: -0.01,
      steps: 100,
    });
    expect(result.xs[100]).toBeCloseTo(Math.exp(1), 4);
  });
});

describe('integrateBoth', () => {
  it('produces a single trajectory passing through the initial condition', () => {
    const result = integrateBoth({
      f: (_, y) => y,
      g: (x) => -x,
      x0: 1,
      y0: 0,
      dt: 0.01,
      forwardSteps: 100,
      backwardSteps: 100,
    });
    expect(result.icIndex).toBe(100);
    expect(result.xs[result.icIndex]).toBeCloseTo(1, 10);
    expect(result.ys[result.icIndex]).toBeCloseTo(0, 10);
    expect(result.n).toBe(201); // backwards + forwards - shared IC
  });

  it('orders time strictly increasing', () => {
    const result = integrateBoth({
      f: (_, y) => y,
      g: (x) => -x,
      x0: 1, y0: 0,
      dt: 0.01,
      forwardSteps: 50,
      backwardSteps: 30,
    });
    for (let i = 1; i < result.n; i++) {
      expect(result.ts[i]).toBeGreaterThan(result.ts[i - 1]);
    }
  });
});
