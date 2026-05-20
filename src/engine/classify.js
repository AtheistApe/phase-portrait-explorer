/**
 * Eigenvalues of a 2x2 matrix [[a, b], [c, d]] via the characteristic
 * polynomial λ² − T λ + Δ = 0, with T = trace, Δ = det.
 *
 * Returns { type: 'real' | 'complex', l1, l2 }.
 * For complex eigenvalues, l1 = α + iβ encoded as { re, im }, l2 = conjugate.
 */
export function eigenvalues2x2({ a, b, c, d }) {
  const trace = a + d;
  const det = a * d - b * c;
  const disc = trace * trace - 4 * det;

  if (disc >= 0) {
    const s = Math.sqrt(disc);
    return {
      type: 'real',
      l1: (trace + s) / 2,
      l2: (trace - s) / 2,
      trace,
      det,
      discriminant: disc,
    };
  }
  const s = Math.sqrt(-disc);
  return {
    type: 'complex',
    l1: { re: trace / 2, im: s / 2 },
    l2: { re: trace / 2, im: -s / 2 },
    trace,
    det,
    discriminant: disc,
  };
}

/**
 * Classify the equilibrium based on its Jacobian via eigenvalue type and sign.
 *
 * Returns a short label and a long description suitable for display.
 *
 * Edge cases (zero real-part, zero eigenvalue, repeated eigenvalues) are
 * called out explicitly: the linearization theorem fails for non-hyperbolic
 * equilibria, so the label is honest about uncertainty.
 */
export function classifyJacobian(J) {
  const ev = eigenvalues2x2(J);
  const NEAR = 1e-9;

  if (ev.type === 'real') {
    const { l1, l2 } = ev;
    const a = Math.min(l1, l2);
    const b = Math.max(l1, l2);

    // Saddle: opposite signs, both nonzero.
    if (a < -NEAR && b > NEAR) {
      return {
        label: 'Saddle',
        stability: 'unstable',
        detail: 'Real eigenvalues of opposite sign. Trajectories approach along one direction and recede along the other.',
        eigenvalues: ev,
      };
    }
    // Both negative: stable node.
    if (a < -NEAR && b < -NEAR) {
      const repeated = Math.abs(l1 - l2) < 1e-6;
      return {
        label: repeated ? 'Stable degenerate node' : 'Stable node',
        stability: 'stable',
        detail: repeated
          ? 'Repeated negative eigenvalue. Trajectories approach the equilibrium tangentially along the single eigendirection.'
          : 'Two distinct negative eigenvalues. Trajectories approach the equilibrium tangent to the slower eigendirection.',
        eigenvalues: ev,
      };
    }
    // Both positive: unstable node.
    if (a > NEAR && b > NEAR) {
      const repeated = Math.abs(l1 - l2) < 1e-6;
      return {
        label: repeated ? 'Unstable degenerate node' : 'Unstable node',
        stability: 'unstable',
        detail: repeated
          ? 'Repeated positive eigenvalue. Trajectories leave the equilibrium along a single eigendirection.'
          : 'Two distinct positive eigenvalues. Trajectories leave tangent to the slower eigendirection.',
        eigenvalues: ev,
      };
    }
    // At least one eigenvalue is (near-)zero: degenerate / non-hyperbolic.
    return {
      label: 'Degenerate (zero eigenvalue)',
      stability: 'unknown',
      detail: 'At least one eigenvalue is zero. The linearization is insufficient to determine stability; consider center-manifold or higher-order analysis.',
      eigenvalues: ev,
    };
  }

  // Complex conjugate pair.
  const alpha = ev.l1.re;
  if (alpha < -NEAR) {
    return {
      label: 'Stable spiral',
      stability: 'stable',
      detail: 'Complex eigenvalues with negative real part. Trajectories spiral inward.',
      eigenvalues: ev,
    };
  }
  if (alpha > NEAR) {
    return {
      label: 'Unstable spiral',
      stability: 'unstable',
      detail: 'Complex eigenvalues with positive real part. Trajectories spiral outward.',
      eigenvalues: ev,
    };
  }
  // Pure imaginary: linear center; nonlinear behavior may differ.
  return {
    label: 'Center (linear)',
    stability: 'neutral',
    detail: 'Purely imaginary eigenvalues. The linearization predicts closed orbits, but for the nonlinear system this is a non-hyperbolic equilibrium and the true behavior may be a stable or unstable spiral.',
    eigenvalues: ev,
  };
}
