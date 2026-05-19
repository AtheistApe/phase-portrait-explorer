# Phase Portrait Explorer

An interactive web app for exploring 2D systems of ordinary differential
equations, intended as a teaching tool for ODE and dynamical-systems units in
introductory calculus and beyond.

This is **v1 (Explore mode)** of a planned multi-mode tool. The roadmap
follows the modes outlined in the design discussion:

- **v1 — Explore** *(this release)*: vector field, click-to-seed trajectories,
  time-series pane, equilibrium detection with Jacobian / eigenvalue display.
- **v2 — Linear Systems**: matrix entry, trace–determinant plane.
- **v3 — Stability**: linearization overlays per equilibrium.
- **v4 — Numerics**: method comparison, energy/conservation tracking.

The phase-plane canvas is shared across all modes; only the side panels swap.

## Getting started

```sh
npm install
npm run dev       # development server (vite)
npm run build     # production build → dist/
npm run preview   # serve the production build locally
npm test          # run the vitest test suite
```

Tested with Node 22 and npm 10.

## What you can do

- **Pick a preset** from the dropdown (linear spiral, saddle, center, damped
  pendulum, Lotka–Volterra, van der Pol, harmonic oscillator). Each preset
  seeds a few sample trajectories.
- **Click anywhere in the phase plane** to launch a new trajectory passing
  through that point. The trajectory is integrated both forward and
  backward from the click, so you see the full local orbit segment.
- **Click an equilibrium** (the colored dots) to inspect its Jacobian,
  trace/determinant/discriminant, eigenvalues, and classification.
- **Edit the RHS** of `dx/dt` and `dy/dt` directly. Parameter names are
  auto-detected and exposed as sliders.
- **Drag parameter sliders** to see equilibria migrate and trajectories
  reshape in real time.
- **Adjust the view window** and integration step / count in the
  Display & Integration panel.

## Architecture

```
src/
├── engine/
│   ├── parser.js        compileSystem, extractParameters, validateSystem
│   ├── integrator.js    rk4Step, integrate, integrateBoth
│   ├── equilibria.js    findEquilibria (grid + damped Newton), jacobian
│   └── classify.js      eigenvalues2x2, classifyJacobian
├── store/
│   └── systemStore.js   Zustand store; the single source of truth
├── presets/
│   └── index.js         canonical 2D systems with sensible defaults
├── components/
│   ├── PhasePlane.jsx   canvas: field + trajectories + equilibria + pointer
│   ├── TimeSeries.jsx   canvas: x(t) and y(t) stacked
│   ├── SystemEditor.jsx RHS inputs + parameter sliders
│   ├── PresetPicker.jsx dropdown
│   ├── Controls.jsx     view bounds, integration, vector-field toggle
│   └── JacobianPanel.jsx KaTeX rendering of J, eigenvalues, classification
├── App.jsx              layout
├── main.jsx             entry
└── styles.css           single stylesheet
```

The store holds the compiled RHS functions (`f`, `g`) as well as
the symbolic source. Anytime the expression or a parameter changes, the
store recompiles or just retargets parameters via its single shared scope
object, then re-integrates all existing trajectories and re-detects
equilibria within the current view.

### Performance notes

- `math.js` expressions are compiled once per system change (not per
  integration step). The compiled scope object is allocated once and
  mutated per call to avoid GC pressure during RK4. With ~10 trajectories
  of ~2000 points each, integration completes well under a frame on a
  modern laptop.
- Trajectories are stored as `Float64Array`s with explicit valid-length
  counters to support early termination on escape.
- Equilibrium finding uses a 14×14 seed grid with damped Newton refinement
  and `1e-3` proximity de-duplication. Coarse, but more than enough for
  the canonical 2D systems students will type in.

## Extending toward v2 / v3

The store and the rendering primitives are deliberately mode-agnostic.
Adding **Linear Systems mode** is mostly a matter of:

1. A new component that replaces `SystemEditor` with a 2×2 matrix input
   and writes `a*x + b*y` / `c*x + d*y` into the store via `setExpressions`.
2. A `TraceDetPlane` component reading `paramValues.a, b, c, d` and
   plotting a movable dot on the (tr, det) plane.

Adding **Stability mode** is similarly an additional view: it reads
`equilibria` from the store, takes the user's selected one, and draws a
small `J · (Δx, Δy)` linear flow on top of the existing phase plane.

A `mode` field in the store plus a `ModeShell` component that swaps which
right-hand panels are mounted is all the routing this needs.

## Testing

```sh
npm test
```

The suite covers the four pure-logic modules: integrator accuracy on
analytic test cases, eigenvalue classification on every archetype matrix,
math-expression compilation and parameter extraction, and equilibrium
detection on Lotka–Volterra and the pendulum. Component tests are
intentionally omitted in v1; add them if you change rendering invariants.

## Deployment

This is a stock Vite/React project, so any static host works. To deploy on
Netlify:

```sh
npm run build
# upload dist/ — or point Netlify at this repo with build command
# "npm run build" and publish directory "dist"
```
