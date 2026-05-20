import { create } from 'zustand';
import { compileSystem, extractParameters, validateSystem } from '../engine/parser.js';
import { integrateBoth } from '../engine/integrator.js';
import { findEquilibria, jacobian } from '../engine/equilibria.js';
import { classifyJacobian } from '../engine/classify.js';
import { PRESETS, PRESET_BY_ID } from '../presets/index.js';

let nextTrajId = 1;

function compileFromExprs(fExpr, gExpr, paramValues) {
  const v = validateSystem(fExpr, gExpr);
  if (!v.ok) return { ok: false, error: v.error };
  const paramNames = extractParameters([fExpr, gExpr]);
  // Fill in missing params with current values or 0.
  const values = {};
  for (const n of paramNames) values[n] = n in paramValues ? paramValues[n] : 0;
  const { f, g } = compileSystem(fExpr, gExpr, paramNames);
  return { ok: true, f, g, paramNames, paramValues: values };
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

function recomputeEquilibria(state) {
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
    const cls = classifyJacobian(J);
    return { ...e, J, classification: cls };
  });
}

function reintegrateAll(state) {
  return state.trajectories.map((tr) => {
    const path = integrateTrajectory(state, tr.x0, tr.y0);
    return { ...tr, ...path };
  });
}

const initialPreset = PRESETS[0];
const initialCompile = compileFromExprs(
  initialPreset.fExpr,
  initialPreset.gExpr,
  initialPreset.paramValues,
);

export const useSystemStore = create((set, get) => ({
  // System definition.
  fExpr: initialPreset.fExpr,
  gExpr: initialPreset.gExpr,
  paramNames: initialCompile.paramNames,
  paramValues: initialCompile.paramValues,
  f: initialCompile.f,
  g: initialCompile.g,
  parseError: null,

  // View.
  view: { ...initialPreset.view },

  // Integration.
  dt: initialPreset.dt,
  steps: initialPreset.steps,
  escapeBound: 1e4,

  // Options.
  showField: true,
  fieldDensity: 22,

  // State.
  trajectories: [],
  equilibria: [],
  selectedEquilibrium: null,
  scrubT: null,

  // Actions.
  setExpressions: (fExpr, gExpr) => {
    const current = get();
    const compiled = compileFromExprs(fExpr, gExpr, current.paramValues);
    if (!compiled.ok) {
      set({ fExpr, gExpr, parseError: compiled.error });
      return;
    }
    const nextState = {
      ...current,
      fExpr,
      gExpr,
      f: compiled.f,
      g: compiled.g,
      paramNames: compiled.paramNames,
      paramValues: compiled.paramValues,
      parseError: null,
    };
    set({
      fExpr,
      gExpr,
      f: compiled.f,
      g: compiled.g,
      paramNames: compiled.paramNames,
      paramValues: compiled.paramValues,
      parseError: null,
      trajectories: reintegrateAll(nextState),
      equilibria: recomputeEquilibria(nextState),
      selectedEquilibrium: null,
    });
  },

  setParam: (name, value) => {
    const current = get();
    const paramValues = { ...current.paramValues, [name]: value };
    const nextState = { ...current, paramValues };
    set({
      paramValues,
      trajectories: reintegrateAll(nextState),
      equilibria: recomputeEquilibria(nextState),
      selectedEquilibrium: null,
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
    // Seed sample trajectories from the preset.
    const seeded = (preset.sampleICs ?? []).map(([x0, y0]) => {
      const path = integrateTrajectory(nextState, x0, y0);
      return { id: nextTrajId++, x0, y0, ...path };
    });
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
      equilibria: recomputeEquilibria(nextState),
      selectedEquilibrium: null,
    });
  },

  addTrajectory: (x0, y0) => {
    const state = get();
    const path = integrateTrajectory(state, x0, y0);
    set({
      trajectories: [
        ...state.trajectories,
        { id: nextTrajId++, x0, y0, ...path },
      ],
    });
  },

  clearTrajectories: () => set({ trajectories: [] }),

  removeTrajectory: (id) =>
    set({ trajectories: get().trajectories.filter((t) => t.id !== id) }),

  setView: (view) => {
    const state = { ...get(), view };
    set({ view, equilibria: recomputeEquilibria(state), selectedEquilibrium: null });
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

// Initialize equilibria & sample trajectories for the first preset on load.
{
  const store = useSystemStore.getState();
  store.loadPreset(initialPreset.id);
}
