import { useEffect, useRef, useState, useCallback } from 'react';
import { useSystemStore } from '../store/systemStore.js';

// Perceptually distinct trajectory colors, cycled by index.
const TRAJ_COLORS = [
  '#d4ff4a', '#5ee2ff', '#ff7a59', '#bd93ff',
  '#ffd166', '#06d6a0', '#ff5ec4', '#73e8ff',
];

const EQ_COLOR = {
  stable: '#06d6a0',
  unstable: '#ff5e7e',
  neutral: '#73e8ff',
  unknown: '#a0a0a0',
};

function colorForTraj(i) {
  return TRAJ_COLORS[i % TRAJ_COLORS.length];
}

// World ↔ screen transforms given a view rect and canvas size.
function makeTransforms(view, width, height) {
  const sx = width / (view.xMax - view.xMin);
  const sy = height / (view.yMax - view.yMin);
  return {
    toScreenX: (x) => (x - view.xMin) * sx,
    toScreenY: (y) => height - (y - view.yMin) * sy,
    toWorldX: (px) => view.xMin + px / sx,
    toWorldY: (py) => view.yMin + (height - py) / sy,
    sx,
    sy,
  };
}

function drawGrid(ctx, view, t, width, height) {
  // Choose a grid spacing such that there are ~8–12 lines across the view.
  const span = Math.max(view.xMax - view.xMin, view.yMax - view.yMin);
  const target = span / 10;
  const mag = Math.pow(10, Math.floor(Math.log10(target)));
  const choices = [1, 2, 5, 10];
  let step = mag;
  for (const c of choices) {
    if (mag * c >= target) {
      step = mag * c;
      break;
    }
  }

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  for (let gx = Math.ceil(view.xMin / step) * step; gx <= view.xMax; gx += step) {
    const px = t.toScreenX(gx);
    ctx.moveTo(px, 0);
    ctx.lineTo(px, height);
  }
  for (let gy = Math.ceil(view.yMin / step) * step; gy <= view.yMax; gy += step) {
    const py = t.toScreenY(gy);
    ctx.moveTo(0, py);
    ctx.lineTo(width, py);
  }
  ctx.stroke();

  // Axes.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  if (view.xMin <= 0 && view.xMax >= 0) {
    const px = t.toScreenX(0);
    ctx.moveTo(px, 0);
    ctx.lineTo(px, height);
  }
  if (view.yMin <= 0 && view.yMax >= 0) {
    const py = t.toScreenY(0);
    ctx.moveTo(0, py);
    ctx.lineTo(width, py);
  }
  ctx.stroke();

  // Tick labels (sparse).
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace';
  for (let gx = Math.ceil(view.xMin / step) * step; gx <= view.xMax; gx += step) {
    if (Math.abs(gx) < 1e-9) continue;
    const px = t.toScreenX(gx);
    const py = t.toScreenY(0);
    const yClamped = Math.min(Math.max(py + 12, 12), height - 4);
    ctx.fillText(formatTick(gx, step), px + 3, yClamped);
  }
  for (let gy = Math.ceil(view.yMin / step) * step; gy <= view.yMax; gy += step) {
    if (Math.abs(gy) < 1e-9) continue;
    const py = t.toScreenY(gy);
    const px = t.toScreenX(0);
    const xClamped = Math.min(Math.max(px + 4, 4), width - 30);
    ctx.fillText(formatTick(gy, step), xClamped, py - 3);
  }
}

function formatTick(v, step) {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return v.toFixed(decimals);
}

function drawVectorField(ctx, f, g, params, view, density, width, height, transforms) {
  const cellW = width / density;
  const cellH = height / density;
  const arrowLen = Math.min(cellW, cellH) * 0.42;

  // Two passes: first compute all magnitudes for normalization, then draw.
  const vectors = [];
  let maxMag = 0;
  for (let i = 0; i < density; i++) {
    for (let j = 0; j < density; j++) {
      const cx = (i + 0.5) * cellW;
      const cy = (j + 0.5) * cellH;
      const wx = transforms.toWorldX(cx);
      const wy = transforms.toWorldY(cy);
      let dx, dy;
      try {
        dx = f(wx, wy, params);
        dy = g(wx, wy, params);
      } catch {
        continue;
      }
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;
      const mag = Math.hypot(dx, dy);
      if (mag > maxMag) maxMag = mag;
      vectors.push({ cx, cy, dx, dy, mag });
    }
  }
  if (maxMag === 0) return;

  ctx.lineCap = 'round';
  for (const v of vectors) {
    if (v.mag < 1e-9) continue;
    // Unit direction in screen coords. Note y flips.
    const ux = v.dx / v.mag;
    const uy = -v.dy / v.mag;
    // Length scaled by log of magnitude relative to max; keeps fast and
    // slow regions both visible without one swamping the other.
    const lenScale = 0.3 + 0.7 * Math.log1p(v.mag / (maxMag * 0.2 + 1e-9)) / Math.log1p(5);
    const L = arrowLen * Math.min(1, Math.max(0.2, lenScale));
    const x0 = v.cx - ux * L * 0.5;
    const y0 = v.cy - uy * L * 0.5;
    const x1 = v.cx + ux * L * 0.5;
    const y1 = v.cy + uy * L * 0.5;

    // Color encodes magnitude: a cool→warm ramp.
    const t = Math.min(1, v.mag / (maxMag * 0.6));
    const hue = 200 - 160 * t; // 200 (blue) → 40 (amber)
    ctx.strokeStyle = `hsla(${hue}, 70%, 60%, 0.55)`;
    ctx.lineWidth = 1.1;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    // Arrowhead.
    const ah = L * 0.32;
    const aAng = 0.5;
    const cosA = Math.cos(aAng);
    const sinA = Math.sin(aAng);
    const hx1 = x1 - ah * (ux * cosA - uy * sinA);
    const hy1 = y1 - ah * (uy * cosA + ux * sinA);
    const hx2 = x1 - ah * (ux * cosA + uy * sinA);
    const hy2 = y1 - ah * (uy * cosA - ux * sinA);
    ctx.moveTo(hx1, hy1);
    ctx.lineTo(x1, y1);
    ctx.lineTo(hx2, hy2);
    ctx.stroke();
  }
}

function drawTrajectories(ctx, trajectories, view, transforms) {
  for (let i = 0; i < trajectories.length; i++) {
    const tr = trajectories[i];
    if (!tr || tr.n < 2) continue;
    const color = colorForTraj(i);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.7;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let drawing = false;
    for (let k = 0; k < tr.n; k++) {
      const x = tr.xs[k];
      const y = tr.ys[k];
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        drawing = false;
        continue;
      }
      const px = transforms.toScreenX(x);
      const py = transforms.toScreenY(y);
      if (drawing) ctx.lineTo(px, py);
      else {
        ctx.moveTo(px, py);
        drawing = true;
      }
    }
    ctx.stroke();

    // Initial-condition marker.
    if (tr.icIndex != null && tr.icIndex < tr.n) {
      const ix = transforms.toScreenX(tr.xs[tr.icIndex]);
      const iy = transforms.toScreenY(tr.ys[tr.icIndex]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ix, iy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawEquilibria(ctx, equilibria, selected, transforms) {
  for (const eq of equilibria) {
    const px = transforms.toScreenX(eq.x);
    const py = transforms.toScreenY(eq.y);
    const stab = eq.classification?.stability ?? 'unknown';
    const color = EQ_COLOR[stab] ?? EQ_COLOR.unknown;
    const isSelected = selected && Math.hypot(selected.x - eq.x, selected.y - eq.y) < 1e-6;

    // Outer ring for selection.
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 11, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Saddle: open ring.
    if (eq.classification?.label === 'Saddle') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
}

export function PhasePlane() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 600, h: 600 });
  const [hover, setHover] = useState(null);

  const f = useSystemStore((s) => s.f);
  const g = useSystemStore((s) => s.g);
  const view = useSystemStore((s) => s.view);
  const paramValues = useSystemStore((s) => s.paramValues);
  const showField = useSystemStore((s) => s.showField);
  const fieldDensity = useSystemStore((s) => s.fieldDensity);
  const trajectories = useSystemStore((s) => s.trajectories);
  const equilibria = useSystemStore((s) => s.equilibria);
  const selectedEquilibrium = useSystemStore((s) => s.selectedEquilibrium);
  const addTrajectory = useSystemStore((s) => s.addTrajectory);
  const selectEquilibrium = useSystemStore((s) => s.selectEquilibrium);

  // Resize observer keeps the canvas responsive without React thrash.
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        setSize({ w: Math.max(200, Math.floor(width)), h: Math.max(200, Math.floor(height)) });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Render.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = size.w + 'px';
    canvas.style.height = size.h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#0e1118';
    ctx.fillRect(0, 0, size.w, size.h);

    const t = makeTransforms(view, size.w, size.h);
    drawGrid(ctx, view, t, size.w, size.h);
    if (showField) {
      drawVectorField(ctx, f, g, paramValues, view, fieldDensity, size.w, size.h, t);
    }
    drawTrajectories(ctx, trajectories, view, t);
    drawEquilibria(ctx, equilibria, selectedEquilibrium, t);

    // Hover crosshair with world-coord readout.
    if (hover) {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hover.px, 0);
      ctx.lineTo(hover.px, size.h);
      ctx.moveTo(0, hover.py);
      ctx.lineTo(size.w, hover.py);
      ctx.stroke();
      ctx.setLineDash([]);

      const wx = t.toWorldX(hover.px);
      const wy = t.toWorldY(hover.py);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace';
      const label = `(${wx.toFixed(2)}, ${wy.toFixed(2)})`;
      const tw = ctx.measureText(label).width;
      const lx = hover.px + 10;
      const ly = hover.py - 8;
      const clampX = Math.min(lx, size.w - tw - 4);
      ctx.fillStyle = 'rgba(14,17,24,0.85)';
      ctx.fillRect(clampX - 3, ly - 11, tw + 6, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(label, clampX, ly);
    }
  }, [size, view, f, g, paramValues, showField, fieldDensity, trajectories, equilibria, selectedEquilibrium, hover]);

  // Pointer handling.
  const onPointerMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    setHover({ px: e.clientX - rect.left, py: e.clientY - rect.top });
  }, []);

  const onPointerLeave = useCallback(() => setHover(null), []);

  const onClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const t = makeTransforms(view, size.w, size.h);
    const wx = t.toWorldX(px);
    const wy = t.toWorldY(py);

    // If clicking near an equilibrium, select it instead of seeding.
    let nearestEq = null;
    let nearestDist = Infinity;
    for (const eq of equilibria) {
      const epx = t.toScreenX(eq.x);
      const epy = t.toScreenY(eq.y);
      const d = Math.hypot(epx - px, epy - py);
      if (d < nearestDist) {
        nearestDist = d;
        nearestEq = eq;
      }
    }
    if (nearestEq && nearestDist < 12) {
      selectEquilibrium(nearestEq);
      return;
    }
    addTrajectory(wx, wy);
  }, [view, size, equilibria, addTrajectory, selectEquilibrium]);

  return (
    <div ref={containerRef} className="phase-plane-container">
      <canvas
        ref={canvasRef}
        className="phase-plane-canvas"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
      />
      <div className="phase-plane-hint">
        Click to seed a trajectory. Click an equilibrium to inspect.
      </div>
    </div>
  );
}
