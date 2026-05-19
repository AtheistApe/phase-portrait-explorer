import { PhasePlane } from './components/PhasePlane.jsx';
import { TimeSeries } from './components/TimeSeries.jsx';
import { SystemEditor } from './components/SystemEditor.jsx';
import { PresetPicker } from './components/PresetPicker.jsx';
import { JacobianPanel } from './components/JacobianPanel.jsx';
import { Controls } from './components/Controls.jsx';

export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" fill="currentColor" />
              <path d="M3 21 Q 7 14 12 12 T 21 3" stroke="currentColor" strokeWidth="1.6" fill="none" opacity="0.7" />
              <path d="M3 12 Q 9 18 12 12 T 21 12" stroke="currentColor" strokeWidth="1.6" fill="none" opacity="0.45" />
            </svg>
          </span>
          <div className="brand-text">
            <h1>Phase Portrait Explorer</h1>
            <p>2D systems of ODEs — Explore mode</p>
          </div>
        </div>
        <PresetPicker />
      </header>

      <main className="app-main">
        <div className="col-left">
          <div className="phase-pane">
            <PhasePlane />
          </div>
          <div className="time-pane">
            <TimeSeries />
          </div>
        </div>
        <aside className="col-right">
          <SystemEditor />
          <Controls />
          <JacobianPanel />
        </aside>
      </main>

      <footer className="app-footer">
        <span>v0.1 · click the phase plane to seed trajectories · click an equilibrium to inspect</span>
      </footer>
    </div>
  );
}
