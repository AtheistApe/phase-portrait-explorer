import { describe, it, expect } from 'vitest';
import { compileSystem, extractParameters, validateSystem } from '../src/engine/parser.js';

describe('compileSystem', () => {
  it('compiles simple linear expressions', () => {
    const { f, g } = compileSystem('y', '-x', []);
    expect(f(0, 3)).toBe(3);
    expect(g(2, 0)).toBe(-2);
  });

  it('passes parameters through scope', () => {
    const { f, g } = compileSystem('a*x', 'b*y', ['a', 'b']);
    expect(f(2, 0, { a: 3, b: 0 })).toBe(6);
    expect(g(0, 4, { a: 0, b: -1 })).toBe(-4);
  });

  it('reuses a single scope across calls without leaking parameter changes', () => {
    const { f } = compileSystem('a*x', 'a*y', ['a']);
    expect(f(1, 0, { a: 5 })).toBe(5);
    expect(f(1, 0, { a: 2 })).toBe(2);
    expect(f(1, 0, { a: -1 })).toBe(-1);
  });

  it('supports built-in math functions', () => {
    const { f, g } = compileSystem('sin(x)', 'cos(y)', []);
    expect(f(Math.PI / 2, 0)).toBeCloseTo(1, 12);
    expect(g(0, 0)).toBeCloseTo(1, 12);
  });
});

describe('extractParameters', () => {
  it('returns an empty list for pure x,y expressions', () => {
    expect(extractParameters(['y', '-x'])).toEqual([]);
  });

  it('collects parameter names across both equations', () => {
    expect(extractParameters(['a*x - b*x*y', 'd*x*y - c*y'])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('omits reserved symbols like pi and e', () => {
    expect(extractParameters(['pi*x + e*y'])).toEqual([]);
  });

  it('does not treat function names as parameters', () => {
    expect(extractParameters(['sin(x) + cos(y) + tan(x)'])).toEqual([]);
  });

  it('handles syntactically invalid expressions silently', () => {
    expect(extractParameters(['x + +', 'y'])).toEqual([]);
  });
});

describe('validateSystem', () => {
  it('accepts well-formed expressions', () => {
    expect(validateSystem('y', '-x').ok).toBe(true);
  });

  it('rejects malformed expressions with a helpful error', () => {
    const r = validateSystem('y * *', '-x');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/dx\/dt/);
  });

  it('blames the right equation', () => {
    const r = validateSystem('y', '(((');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/dy\/dt/);
  });
});
