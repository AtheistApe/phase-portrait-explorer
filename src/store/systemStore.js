import { create } from 'zustand';
import { parseAndCompile } from '../engine/parser.js';
import { integrateBoth } from '../engine/integrator.js';
import { findEquilibria, jacobian } from '../engine/equilibria.js';
import { classifyJacobian } from '../engine/classify.js';
import { PRESETS, PRESET_BY_ID } from '../presets/index.js';

let nextTrajId = 1;

// Distance under which we consider an equilibrium "the same one" across a
// parameter change. Anchored to the typical view size; coarse but adequate.
const SELECTION_PROXIMITY = 0.5;

function compileFromExprs(fExpr, gExpr, paramValues) {
  const r = parseAndCompile(fExpr, gExpr);
  if (!r.ok) return { ok: false, error: r.error };
  const values = {};
  for (const n of r.paramNames) {
    values[n] = n in paramValues ? paramValues[n] : 0;
  }
  return { ok: true, f: r.f, g: r.g, paramNames: r.paramNames, paramValues: values };
}

function integrateTrajectory(state, x0, y0) {
  return integrateBoth({
    f: state.f,
    g: state.g,
    x0,
    y0,
    dt: state.dt,
    forwardSteps: state.steps,
    backwardSteps: Math.floor(state.steps / 2),
    bound: state.escapeBound,
    params: state.paramValues,
  });
}

function computeEquilibria(state) {
  const eqs = findEquilibria({
    f: state.f,
    g: state.g,
    xRange: [state.view.xMin, state.view.xMax],
    yRange: [state.view.yMin, state.view.yMax],
    gridN: 14,
    params: state.paramValues,
  });
  return eqs.map((e) => {
    const J = jacobian(state.f, state.g, e.x, e.y, state.paramValues);
    return { ...e, J, classification: classifyJacobian(J) };
  });
}

function reintegrateAll(state) {
  return state.trajectories.map((tr) => ({
    ...tr,
    ...integrateTrajectory(state, tr.x0, tr.y0),
  }));
}

/**
 * After equilibria are recomputed, the previous selectedEquilibrium object
 * reference is stale. Find the nearest equilibrium in the new array; if
 * it's within SELECTION_PROXIMITY of the previous selection, keep the
 * selection alive. Otherwise drop it.
 */
function reattachSelection(prevSel, newEquilibria) {
  if (!prevSel || newEquilibria.length === 0) return null;
  let best = null;
  let bestDist = Infinity;
  for (const eq of newEquilibria) {
    const d = Math.hypot(eq.x - prevSel.x, eq.y - prevSel.y);
    if (d < bestDist) {
      bestDist = d;
      best = eq;
    }
  }
  return bestDist < SELECTION_PROXIMITY ? best : null;
}

// Initial state is built lazily by loadPreset after the store is created;
// we just need enough to satisfy the type shape until then.
const initialPreset = PRESETS[0];

export const useSystemStore = create((set, get) => ({
  // System definition (set by loadPreset call at the bottom of this file).
  fExpr: '',
  gExpr: '',
  paramNames: [],
  paramValues: {},
  f: () => 0,
  g: () => 0,
  parseError: null,

  // View.
  view: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },

  // Integration.
  dt: 0.02,
  steps: 2000,
  escapeBound: 1e4,

  // Options.
  showField: true,
  fieldDensity: 22,

  // State.
  trajectories: [],
  equilibria: [],
  selectedEquilibrium: null,
  scrubT: null,

  // ── Actions ──────────────────────────────────────────────────────────

  setExpressions: (fExpr, gExpr) => {
    const current = get();
    const compiled = compileFromExprs(fExpr, gExpr, current.paramValues);
    if (!compiled.ok) {
      set({ fExpr, gExpr, parseError: compiled.error });
      return;
    }
    const nextState = { ...current, ...compiled, fExpr, gExpr, parseError: null };
    const equilibria = computeEquilibria(nextState);
    set({
      fExpr,
      gExpr,
      f: compiled.f,
      g: compiled.g,
      paramNames: compiled.paramNames,
      paramValues: compiled.paramValues,
      parseError: null,
      trajectories: reintegrateAll(nextState),
      equilibria,
      selectedEquilibrium: reattachSelection(current.selectedEquilibrium, equilibria),
    });
  },

  setParam: (name, value) => {
    const current = get();
    const paramValues = { ...current.paramValues, [name]: value };
    const nextState = { ...current, paramValues };
    const equilibria = computeEquilibria(nextState);
    set({
      paramValues,
      trajectories: reintegrateAll(nextState),
      equilibria,
      selectedEquilibrium: reattachSelection(current.selectedEquilibrium, equilibria),
    });
  },

  loadPreset: (id) => {
    const preset = PRESET_BY_ID[id];
    if (!preset) return;
    const compiled = compileFromExprs(preset.fExpr, preset.gExpr, preset.paramValues);
    if (!compiled.ok) return;
    const nextState = {
      ...get(),
      fExpr: preset.fExpr,
      gExpr: preset.gExpr,
      f: compiled.f,
      g: compiled.g,
      paramNames: compiled.paramNames,
      paramValues: compiled.paramValues,
      view: { ...preset.view },
      dt: preset.dt,
      steps: preset.steps,
      parseError: null,
      trajectories: [],
    };
    const seeded = (preset.sampleICs ?? []).map(([x0, y0]) => ({
      id: nextTrajId++, x0, y0,
      ...integrateTrajectory(nextState, x0, y0),
    }));
    set({
      fExpr: preset.fExpr,
      gExpr: preset.gExpr,
      f: compiled.f,
      g: compiled.g,
      paramNames: compiled.paramNames,
      paramValues: compiled.paramValues,
      view: { ...preset.view },
      dt: preset.dt,
      steps: preset.steps,
      parseError: null,
      trajectories: seeded,
      equilibria: computeEquilibria(nextState),
      selectedEquilibrium: null,
      scrubT: null,
    });
  },

  addTrajectory: (x0, y0) => {
    const state = get();
    set({
      trajectories: [
        ...state.trajectories,
        { id: nextTrajId++, x0, y0, ...integrateTrajectory(state, x0, y0) },
      ],
    });
  },

  clearTrajectories: () => set({ trajectories: [], scrubT: null }),

  removeTrajectory: (id) =>
    set({ trajectories: get().trajectories.filter((t) => t.id !== id) }),

  setView: (view) => {
    const state = { ...get(), view };
    const equilibria = computeEquilibria(state);
    set({
      view,
      equilibria,
      selectedEquilibrium: reattachSelection(state.selectedEquilibrium, equilibria),
    });
  },

  setShowField: (showField) => set({ showField }),
  setFieldDensity: (fieldDensity) => set({ fieldDensity }),

  setIntegrationStep: (dt) => {
    const state = { ...get(), dt };
    set({ dt, trajectories: reintegrateAll(state) });
  },

  setIntegrationSteps: (steps) => {
    const state = { ...get(), steps };
    set({ steps, trajectories: reintegrateAll(state) });
  },

  selectEquilibrium: (eq) => set({ selectedEquilibrium: eq }),

  setScrubT: (t) => set({ scrubT: t }),
}));

// Seed the store with the first preset.
useSystemStore.getState().loadPreset(initialPreset.id);
