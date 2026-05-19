/**
 * Preset library of canonical 2D systems for teaching.
 *
 * Each preset includes:
 *   - id, label, description
 *   - fExpr, gExpr: RHS as math.js-parseable strings
 *   - paramValues: default parameter values
 *   - view: default phase-plane window
 *   - dt, steps: sensible integration defaults
 *   - sampleICs: optional list of suggested initial conditions to seed
 */

export const PRESETS = [
  {
    id: 'linear-stable-spiral',
    label: 'Linear: stable spiral',
    description: "A 2×2 linear system with complex eigenvalues having negative real part. The textbook example of a stable focus.",
    fExpr: '-0.2*x - y',
    gExpr: 'x - 0.2*y',
    paramValues: {},
    view: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },
    dt: 0.02,
    steps: 2000,
    sampleICs: [[2, 0], [-2, 1], [0, 2.5]],
  },
  {
    id: 'linear-saddle',
    label: 'Linear: saddle',
    description: "A 2×2 linear system with one positive and one negative eigenvalue. Trajectories approach along the stable manifold and recede along the unstable one.",
    fExpr: 'x + 2*y',
    gExpr: '2*x + y',
    paramValues: {},
    view: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },
    dt: 0.01,
    steps: 800,
    sampleICs: [[2, -2.1], [-2, 2.1], [1, -1.05], [-1, 1.05]],
  },
  {
    id: 'linear-center',
    label: 'Linear: center',
    description: "Purely imaginary eigenvalues. The linear system traces closed elliptical orbits — but note that for nonlinear systems, a linear-center equilibrium can be a true center, a stable spiral, or an unstable spiral.",
    fExpr: 'y',
    gExpr: '-x',
    paramValues: {},
    view: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },
    dt: 0.02,
    steps: 1000,
    sampleICs: [[1, 0], [2, 0], [2.5, 0]],
  },
  {
    id: 'damped-pendulum',
    label: 'Damped pendulum',
    description: "θ'' + b·θ' + sin(θ) = 0 written as a first-order system with x = θ, y = θ'. Multiple equilibria at (nπ, 0); stable spirals when n is even, saddles when n is odd.",
    fExpr: 'y',
    gExpr: '-sin(x) - b*y',
    paramValues: { b: 0.2 },
    view: { xMin: -2 * Math.PI, xMax: 2 * Math.PI, yMin: -3, yMax: 3 },
    dt: 0.02,
    steps: 2000,
    sampleICs: [[0, 2.5], [Math.PI - 0.1, 0], [-Math.PI + 0.1, 0], [3, 0]],
  },
  {
    id: 'lotka-volterra',
    label: 'Lotka–Volterra (predator–prey)',
    description: "x' = αx − βxy,  y' = δxy − γy.  Classical predator–prey model with a center at (γ/δ, α/β) for the standard parameters.",
    fExpr: 'a*x - b*x*y',
    gExpr: 'd*x*y - c*y',
    paramValues: { a: 1.0, b: 1.0, c: 1.0, d: 1.0 },
    view: { xMin: 0, xMax: 4, yMin: 0, yMax: 4 },
    dt: 0.02,
    steps: 1500,
    sampleICs: [[1.5, 1], [2, 1], [2.5, 1]],
  },
  {
    id: 'van-der-pol',
    label: 'Van der Pol oscillator',
    description: "x' = y,  y' = μ(1 − x²)y − x.  Nonlinear oscillator exhibiting a stable limit cycle for μ > 0. Try increasing μ to see the relaxation regime.",
    fExpr: 'y',
    gExpr: 'mu*(1 - x^2)*y - x',
    paramValues: { mu: 1.0 },
    view: { xMin: -3, xMax: 3, yMin: -4, yMax: 4 },
    dt: 0.02,
    steps: 2000,
    sampleICs: [[0.1, 0], [3, 3], [-3, -3]],
  },
  {
    id: 'simple-harmonic',
    label: 'Simple harmonic oscillator',
    description: "x'' + ω²x = 0 as a system. Useful baseline: the integrator's symplectic-ness can be judged by drift in the Hamiltonian H = (y² + ω²x²)/2.",
    fExpr: 'y',
    gExpr: '-w^2 * x',
    paramValues: { w: 1.0 },
    view: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },
    dt: 0.02,
    steps: 2000,
    sampleICs: [[1, 0], [2, 0], [2.5, 0]],
  },
];

export const PRESET_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));
