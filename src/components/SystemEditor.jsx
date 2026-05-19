import { useState, useEffect } from 'react';
import { useSystemStore } from '../store/systemStore.js';

export function SystemEditor() {
  const fExpr = useSystemStore((s) => s.fExpr);
  const gExpr = useSystemStore((s) => s.gExpr);
  const parseError = useSystemStore((s) => s.parseError);
  const setExpressions = useSystemStore((s) => s.setExpressions);
  const paramNames = useSystemStore((s) => s.paramNames);
  const paramValues = useSystemStore((s) => s.paramValues);
  const setParam = useSystemStore((s) => s.setParam);

  const [localF, setLocalF] = useState(fExpr);
  const [localG, setLocalG] = useState(gExpr);

  // Sync local on external preset load.
  useEffect(() => { setLocalF(fExpr); }, [fExpr]);
  useEffect(() => { setLocalG(gExpr); }, [gExpr]);

  const commit = () => {
    if (localF !== fExpr || localG !== gExpr) {
      setExpressions(localF, localG);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
  };

  return (
    <section className="panel">
      <h2 className="panel-title">System</h2>
      <div className="eqn-row">
        <label className="eqn-label">
          <span className="eqn-lhs">dx/dt =</span>
          <input
            className="eqn-input"
            value={localF}
            onChange={(e) => setLocalF(e.target.value)}
            onBlur={commit}
            onKeyDown={onKey}
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <label className="eqn-label">
          <span className="eqn-lhs">dy/dt =</span>
          <input
            className="eqn-input"
            value={localG}
            onChange={(e) => setLocalG(e.target.value)}
            onBlur={commit}
            onKeyDown={onKey}
            spellCheck={false}
            autoComplete="off"
          />
        </label>
      </div>
      {parseError && <div className="error">{parseError}</div>}

      {paramNames.length > 0 && (
        <div className="params">
          <div className="params-title">Parameters</div>
          {paramNames.map((name) => (
            <ParamSlider
              key={name}
              name={name}
              value={paramValues[name] ?? 0}
              onChange={(v) => setParam(name, v)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ParamSlider({ name, value, onChange }) {
  // Default range: scale around current value with a sensible band.
  const [range, setRange] = useState(() => defaultRange(value));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (value < range.min || value > range.max) {
      setRange(defaultRange(value));
    }
    if (!editing) setDraft(formatNum(value));
  }, [value, range.min, range.max, editing]);

  const onSlider = (e) => {
    onChange(parseFloat(e.target.value));
  };

  const commitDraft = () => {
    const v = parseFloat(draft);
    if (!Number.isNaN(v)) {
      onChange(v);
      setRange(defaultRange(v));
    } else {
      setDraft(formatNum(value));
    }
    setEditing(false);
  };

  return (
    <div className="param-row">
      <span className="param-name">{name}</span>
      <input
        className="param-slider"
        type="range"
        min={range.min}
        max={range.max}
        step={(range.max - range.min) / 200}
        value={value}
        onChange={onSlider}
      />
      <input
        className="param-value"
        type="text"
        value={draft}
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitDraft();
          if (e.key === 'Escape') {
            setDraft(formatNum(value));
            setEditing(false);
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

function defaultRange(v) {
  const mag = Math.max(1, Math.abs(v) * 2);
  return { min: -mag, max: mag };
}

function formatNum(v) {
  if (Math.abs(v) >= 100 || Math.abs(v) < 0.001) {
    return v.toExponential(2);
  }
  return v.toFixed(3).replace(/\.?0+$/, '');
}
