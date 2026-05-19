import { useSystemStore } from '../store/systemStore.js';

export function Controls() {
  const showField = useSystemStore((s) => s.showField);
  const setShowField = useSystemStore((s) => s.setShowField);
  const fieldDensity = useSystemStore((s) => s.fieldDensity);
  const setFieldDensity = useSystemStore((s) => s.setFieldDensity);
  const view = useSystemStore((s) => s.view);
  const setView = useSystemStore((s) => s.setView);
  const dt = useSystemStore((s) => s.dt);
  const steps = useSystemStore((s) => s.steps);
  const setIntegrationStep = useSystemStore((s) => s.setIntegrationStep);
  const setIntegrationSteps = useSystemStore((s) => s.setIntegrationSteps);
  const trajectories = useSystemStore((s) => s.trajectories);
  const clearTrajectories = useSystemStore((s) => s.clearTrajectories);

  const updateView = (key, value) => {
    const v = parseFloat(value);
    if (Number.isNaN(v)) return;
    setView({ ...view, [key]: v });
  };

  return (
    <section className="panel">
      <h2 className="panel-title">Display & Integration</h2>

      <div className="control-row">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={showField}
            onChange={(e) => setShowField(e.target.checked)}
          />
          <span>Vector field</span>
        </label>
        <div className="density-control">
          <span className="density-label">density</span>
          <input
            type="range"
            min={8}
            max={40}
            step={1}
            value={fieldDensity}
            onChange={(e) => setFieldDensity(parseInt(e.target.value, 10))}
            disabled={!showField}
          />
          <span className="density-readout">{fieldDensity}</span>
        </div>
      </div>

      <div className="view-grid">
        <label>x min<input type="number" value={view.xMin} step="0.5" onChange={(e) => updateView('xMin', e.target.value)} /></label>
        <label>x max<input type="number" value={view.xMax} step="0.5" onChange={(e) => updateView('xMax', e.target.value)} /></label>
        <label>y min<input type="number" value={view.yMin} step="0.5" onChange={(e) => updateView('yMin', e.target.value)} /></label>
        <label>y max<input type="number" value={view.yMax} step="0.5" onChange={(e) => updateView('yMax', e.target.value)} /></label>
      </div>

      <div className="integration-grid">
        <label>
          <span>step Δt</span>
          <input
            type="number"
            step="0.001"
            min="0.0001"
            value={dt}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v) && v > 0) setIntegrationStep(v);
            }}
          />
        </label>
        <label>
          <span>steps</span>
          <input
            type="number"
            step="100"
            min="100"
            value={steps}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (Number.isFinite(v) && v >= 100) setIntegrationSteps(v);
            }}
          />
        </label>
      </div>

      <div className="control-row">
        <button
          className="btn"
          onClick={clearTrajectories}
          disabled={trajectories.length === 0}
        >
          Clear trajectories ({trajectories.length})
        </button>
      </div>
    </section>
  );
}
