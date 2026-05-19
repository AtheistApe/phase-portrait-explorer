import { describe, it, expect } from 'vitest';
import { eigenvalues2x2, classifyJacobian } from '../src/engine/classify.js';

describe('eigenvalues2x2', () => {
  it('returns the diagonal of a diagonal matrix as real eigenvalues', () => {
    const ev = eigenvalues2x2({ a: 3, b: 0, c: 0, d: -1 });
    expect(ev.type).toBe('real');
    expect([ev.l1, ev.l2].sort((a, b) => a - b)).toEqual([-1, 3]);
  });

  it('finds the eigenvalues of a symmetric matrix correctly', () => {
    // [[4,1],[1,2]] has eigenvalues 3 ± sqrt(2).
    const ev = eigenvalues2x2({ a: 4, b: 1, c: 1, d: 2 });
    expect(ev.type).toBe('real');
    const expected = [3 - Math.sqrt(2), 3 + Math.sqrt(2)];
    const got = [ev.l1, ev.l2].sort((a, b) => a - b);
    expect(got[0]).toBeCloseTo(expected[0], 9);
    expect(got[1]).toBeCloseTo(expected[1], 9);
  });

  it('returns complex eigenvalues for rotation', () => {
    // [[0,1],[-1,0]] has eigenvalues ±i.
    const ev = eigenvalues2x2({ a: 0, b: 1, c: -1, d: 0 });
    expect(ev.type).toBe('complex');
    expect(ev.l1.re).toBeCloseTo(0, 10);
    expect(Math.abs(ev.l1.im)).toBeCloseTo(1, 10);
  });

  it('exposes trace, det, and discriminant', () => {
    const ev = eigenvalues2x2({ a: 2, b: 3, c: -1, d: 4 });
    expect(ev.trace).toBe(6);
    expect(ev.det).toBe(2 * 4 - 3 * (-1)); // 11
    expect(ev.discriminant).toBe(36 - 44);
  });
});

describe('classifyJacobian', () => {
  it('classifies a stable node', () => {
    const c = classifyJacobian({ a: -1, b: 0, c: 0, d: -2 });
    expect(c.label).toBe('Stable node');
    expect(c.stability).toBe('stable');
  });

  it('classifies an unstable node', () => {
    const c = classifyJacobian({ a: 1, b: 0, c: 0, d: 2 });
    expect(c.label).toBe('Unstable node');
    expect(c.stability).toBe('unstable');
  });

  it('classifies a saddle', () => {
    const c = classifyJacobian({ a: 2, b: 0, c: 0, d: -1 });
    expect(c.label).toBe('Saddle');
    expect(c.stability).toBe('unstable');
  });

  it('classifies a stable spiral', () => {
    const c = classifyJacobian({ a: -0.2, b: -1, c: 1, d: -0.2 });
    expect(c.label).toBe('Stable spiral');
    expect(c.stability).toBe('stable');
  });

  it('classifies an unstable spiral', () => {
    const c = classifyJacobian({ a: 0.2, b: -1, c: 1, d: 0.2 });
    expect(c.label).toBe('Unstable spiral');
    expect(c.stability).toBe('unstable');
  });

  it('classifies a linear center', () => {
    const c = classifyJacobian({ a: 0, b: 1, c: -1, d: 0 });
    expect(c.label).toBe('Center (linear)');
    expect(c.stability).toBe('neutral');
  });

  it('flags a zero-eigenvalue equilibrium as degenerate', () => {
    const c = classifyJacobian({ a: 0, b: 1, c: 0, d: -1 });
    expect(c.label).toMatch(/Degenerate/);
    expect(c.stability).toBe('unknown');
  });

  it('flags repeated eigenvalues as a degenerate node', () => {
    const c = classifyJacobian({ a: -2, b: 0, c: 0, d: -2 });
    expect(c.label).toBe('Stable degenerate node');
  });
});
