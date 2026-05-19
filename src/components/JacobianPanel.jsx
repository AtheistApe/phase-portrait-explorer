import { useEffect, useRef } from 'react';
import katex from 'katex';
import { useSystemStore } from '../store/systemStore.js';

function fmt(v, p = 3) {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) < 1e-9) return '0';
  if (Math.abs(v) >= 1e4 || Math.abs(v) < 1e-3) return v.toExponential(2);
  return v.toFixed(p);
}

function jacobianLatex(J) {
  return `J = \\begin{bmatrix} ${fmt(J.a)} & ${fmt(J.b)} \\\\ ${fmt(J.c)} & ${fmt(J.d)} \\end{bmatrix}`;
}

function eigenvalueLatex(ev) {
  if (ev.type === 'real') {
    return `\\lambda_{1} = ${fmt(ev.l1, 4)},\\quad \\lambda_{2} = ${fmt(ev.l2, 4)}`;
  }
  const re = fmt(ev.l1.re, 4);
  const im = fmt(Math.abs(ev.l1.im), 4);
  const sign = ev.l1.im >= 0 ? '+' : '-';
  return `\\lambda_{1,2} = ${re} ${sign} ${im}\\,i`;
}

function summaryLatex(ev) {
  return `\\mathrm{tr}(J) = ${fmt(ev.trace, 4)},\\quad \\det(J) = ${fmt(ev.det, 4)},\\quad \\Delta = ${fmt(ev.discriminant, 4)}`;
}

function Tex({ src, display = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(src, ref.current, { displayMode: display, throwOnError: false });
      } catch {
        ref.current.textContent = src;
      }
    }
  }, [src, display]);
  return <span ref={ref} />;
}

const STABILITY_BADGE = {
  stable: { className: 'badge-stable', label: 'stable' },
  unstable: { className: 'badge-unstable', label: 'unstable' },
  neutral: { className: 'badge-neutral', label: 'neutral' },
  unknown: { className: 'badge-unknown', label: 'non-hyperbolic' },
};

export function JacobianPanel() {
  const equilibria = useSystemStore((s) => s.equilibria);
  const selected = useSystemStore((s) => s.selectedEquilibrium);
  const selectEquilibrium = useSystemStore((s) => s.selectEquilibrium);

  if (equilibria.length === 0) {
    return (
      <section className="panel">
        <h2 className="panel-title">Equilibria</h2>
        <p className="muted">No equilibria found in the current view.</p>
      </section>
    );
  }

  const target = selected ?? equilibria[0];

  return (
    <section className="panel">
      <h2 className="panel-title">Equilibria</h2>
      <div className="eq-list">
        {equilibria.map((eq, i) => {
          const isActive = eq.x === target.x && eq.y === target.y;
          const badge = STABILITY_BADGE[eq.classification?.stability ?? 'unknown'];
          return (
            <button
              key={i}
              className={`eq-chip ${isActive ? 'active' : ''}`}
              onClick={() => selectEquilibrium(eq)}
            >
              <span className="eq-coord">({fmt(eq.x, 3)}, {fmt(eq.y, 3)})</span>
              <span className={`eq-badge ${badge.className}`}>{eq.classification?.label ?? '—'}</span>
            </button>
          );
        })}
      </div>

      <div className="eq-detail">
        <div className="tex-block">
          <Tex src={jacobianLatex(target.J)} display />
        </div>
        <div className="tex-block">
          <Tex src={summaryLatex(target.classification.eigenvalues)} />
        </div>
        <div className="tex-block">
          <Tex src={eigenvalueLatex(target.classification.eigenvalues)} />
        </div>
        <p className="eq-detail-text">{target.classification.detail}</p>
      </div>
    </section>
  );
}
