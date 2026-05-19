import { useSystemStore } from '../store/systemStore.js';
import { PRESETS, PRESET_BY_ID } from '../presets/index.js';

export function PresetPicker() {
  const fExpr = useSystemStore((s) => s.fExpr);
  const gExpr = useSystemStore((s) => s.gExpr);
  const loadPreset = useSystemStore((s) => s.loadPreset);

  // Identify current preset by expression match (best-effort).
  const current = PRESETS.find((p) => p.fExpr === fExpr && p.gExpr === gExpr);
  const value = current?.id ?? '';

  const description = value ? PRESET_BY_ID[value]?.description : null;

  return (
    <div className="preset-picker">
      <select
        className="preset-select"
        value={value}
        onChange={(e) => loadPreset(e.target.value)}
      >
        <option value="" disabled>(custom system)</option>
        {PRESETS.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      {description && <p className="preset-desc">{description}</p>}
    </div>
  );
}
