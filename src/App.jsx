import { useCallback, useEffect, useState } from 'react';
import { PhasePlane } from './components/PhasePlane.jsx';
import { TimeSeries } from './components/TimeSeries.jsx';
import { SystemEditor } from './components/SystemEditor.jsx';
import { PresetPicker } from './components/PresetPicker.jsx';
import { JacobianPanel } from './components/JacobianPanel.jsx';
import { Controls } from './components/Controls.jsx';
import { Splitter } from './components/Splitter.jsx';

// Default panel dimensions in CSS pixels and hard bounds.
const RIGHT_DEFAULT = 440;
const RIGHT_MIN = 280;
const RIGHT_MAX = 720;
const TIME_DEFAULT = 240;
const TIME_MIN = 120;
const TIME_MAX = 560;

// Minimum room reserved for the phase plane after clamping side panels.
// At narrower viewports (including browser zoom-in), the side panels yield
// before the phase plane does.
const PHASE_MIN_W = 280;
const PHASE_MIN_H = 240;

const LS_KEYS = {
  right: 'ppe.rightWidth',
  time: 'ppe.timeHeight',
};

/**
 * Persist a numeric size value to localStorage. Reads on mount, writes on
 * change. Silently ignores quota errors and unparseable saved values.
 */
function usePersistedSize(key, fallback) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return fallback;
    try {
      const saved = window.localStorage.getItem(key);
      const n = parseFloat(saved);
      return Number.isFinite(n) ? n : fallback;
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // localStorage may be unavailable in private mode or full.
    }
  }, [key, value]);
  return [value, setValue];
}

/**
 * Track viewport dimensions in CSS pixels. window 'resize' fires for both
 * manual window resizes and browser zoom (which changes CSS-pixel viewport
 * size even though the device pixel count is unchanged).
 */
function useViewport() {
  const [vp, setVp] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1200,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return vp;
}

export function App() {
  // The user's *intended* sizes live in localStorage.
  const [savedRightWidth, setSavedRightWidth] = usePersistedSize(LS_KEYS.right, RIGHT_DEFAULT);
  const [savedTimeHeight, setSavedTimeHeight] = usePersistedSize(LS_KEYS.time, TIME_DEFAULT);

  const viewport = useViewport();

  // Applied sizes clamp against the viewport so the phase plane always has
  // at least PHASE_MIN_W × PHASE_MIN_H of breathing room. When the viewport
  // grows again (zoom out, window enlarge), the saved values restore
  // automatically since they're untouched.
  const rightWidth = Math.max(
    RIGHT_MIN,
    Math.min(RIGHT_MAX, Math.min(savedRightWidth, viewport.w - PHASE_MIN_W - 6)),
  );
  const timeHeight = Math.max(
    TIME_MIN,
    Math.min(TIME_MAX, Math.min(savedTimeHeight, viewport.h - PHASE_MIN_H - 6 - 70)),
    // -70 accounts for the header + footer height; rough but conservative.
  );

  // Drag handlers update the *displayed* position rather than the saved
  // one directly, so dragging works correctly even when the displayed value
  // has been clamped below the saved value.
  const handleColResize = useCallback((dx) => {
    setSavedRightWidth(Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, rightWidth - dx)));
  }, [rightWidth, setSavedRightWidth]);

  const handleRowResize = useCallback((dy) => {
    setSavedTimeHeight(Math.max(TIME_MIN, Math.min(TIME_MAX, timeHeight - dy)));
  }, [timeHeight, setSavedTimeHeight]);

  const styleVars = {
    '--right-width': `${rightWidth}px`,
    '--time-height': `${timeHeight}px`,
  };

  return (
    <div className="app" style={styleVars}>
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
          <Splitter axis="row" onResize={handleRowResize} ariaLabel="Resize time-series pane" />
          <div className="time-pane">
            <TimeSeries />
          </div>
        </div>
        <Splitter axis="col" onResize={handleColResize} ariaLabel="Resize side panel" />
        <aside className="col-right">
          <SystemEditor />
          <Controls />
          <JacobianPanel />
        </aside>
      </main>

      <footer className="app-footer">
        <span>v0.1 · click the phase plane to seed trajectories · drag dividers to resize · sizes persist across reloads</span>
      </footer>
    </div>
  );
}
