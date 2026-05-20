import { useEffect, useRef, useState, useCallback } from 'react';
import { useSystemStore } from '../store/systemStore.js';
import { sampleTrajectoryAtT } from '../utils/trajectory.js';

const TRAJ_COLORS = [
  '#d4ff4a', '#5ee2ff', '#ff7a59', '#bd93ff',
  '#ffd166', '#06d6a0', '#ff5ec4', '#73e8ff',
];

const LEFT_MARGIN = 6;
const RIGHT_MARGIN = 6;
const TOP_MARGIN = 4;
const BOTTOM_MARGIN = 4;
const GAP = 6;

function computeBounds(trajectories) {
  let tMin = Infinity, tMax = -Infinity;
  let xMin = Infinity, xMax = -Infinity;
  let yMin = Infinity, yMax = -Infinity;
  for (const tr of trajectories) {
    for (let k = 0; k < tr.n; k++) {
      const t = tr.ts[k];
      const x = tr.xs[k];
      const y = tr.ys[k];
      if (!Number.isFinite(t) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (t < tMin) tMin = t;
      if (t > tMax) tMax = t;
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
  }
  function pad(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return [-1, 1];
    if (a === b) return [a - 1, b + 1];
    const r = (b - a) * 0.08;
    return [a - r, b + r];
  }
  return {
    t: pad(tMin, tMax),
    x: pad(xMin, xMax),
    y: pad(yMin, yMax),
  };
}

function drawSubplot(ctx, x0, y0, w, h, label, trajectories, field, tBounds, vBounds, scrubT) {
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText(label, x0 + 8, y0 + 16);

  if (vBounds[0] < 0 && vBounds[1] > 0) {
    const zeroY = y0 + h - ((0 - vBounds[0]) / (vBounds[1] - vBounds[0])) * h;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(x0, zeroY);
    ctx.lineTo(x0 + w, zeroY);
    ctx.stroke();
  }

  const tSpan = tBounds[1] - tBounds[0];
  const vSpan = vBounds[1] - vBounds[0];
  if (tSpan <= 0 || vSpan <= 0) return;

  const accessor = field === 'x' ? (tr, k) => tr.xs[k] : (tr, k) => tr.ys[k];
  for (let i = 0; i < trajectories.length; i++) {
    const tr = trajectories[i];
    if (tr.n < 2) continue;
    ctx.strokeStyle = TRAJ_COLORS[i % TRAJ_COLORS.length];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let k = 0; k < tr.n; k++) {
      const t = tr.ts[k];
      const v = accessor(tr, k);
      if (!Number.isFinite(t) || !Number.isFinite(v)) {
        started = false;
        continue;
      }
      const px = x0 + ((t - tBounds[0]) / tSpan) * w;
      const py = y0 + h - ((v - vBounds[0]) / vSpan) * h;
      if (started) ctx.lineTo(px, py);
      else { ctx.moveTo(px, py); started = true; }
    }
    ctx.stroke();
  }

  // Scrub line + per-trajectory markers.
  if (scrubT !== null && scrubT !== undefined && scrubT >= tBounds[0] && scrubT <= tBounds[1]) {
    const px = x0 + ((scrubT - tBounds[0]) / tSpan) * w;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(px, y0);
    ctx.lineTo(px, y0 + h);
    ctx.stroke();
    ctx.setLineDash([]);

    const tLabel = `t = ${scrubT.toFixed(2)}`;
    ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace';
    const tw = ctx.measureText(tLabel).width;
    const lx = Math.min(px + 6, x0 + w - tw - 4);
    ctx.fillStyle = 'rgba(10,12,18,0.85)';
    ctx.fillRect(lx - 3, y0 + 2, tw + 6, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(tLabel, lx, y0 + 12);

    for (let i = 0; i < trajectories.length; i++) {
      const tr = trajectories[i];
      const sample = sampleTrajectoryAtT(tr, scrubT);
      if (!sample) continue;
      const v = field === 'x' ? sample.x : sample.y;
      if (!Number.isFinite(v)) continue;
      const py = y0 + h - ((v - vBounds[0]) / vSpan) * h;
      const color = TRAJ_COLORS[i % TRAJ_COLORS.length];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0e1118';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

export function TimeSeries() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  // Geometry kept in a ref so the pointer handler reads it without
  // forcing a re-render on every move.
  const geomRef = useRef(null);
  const [size, setSize] = useState({ w: 600, h: 200 });
  const trajectories = useSystemStore((s) => s.trajectories);
  const scrubT = useSystemStore((s) => s.scrubT);
  const setScrubT = useSystemStore((s) => s.setScrubT);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        setSize({ w: Math.max(200, Math.floor(width)), h: Math.max(120, Math.floor(height)) });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

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

    if (!trajectories.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '13px "IBM Plex Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click in the phase plane to seed a trajectory', size.w / 2, size.h / 2);
      ctx.textAlign = 'left';
      geomRef.current = null;
      return;
    }

    const bounds = computeBounds(trajectories);
    const innerW = size.w - LEFT_MARGIN - RIGHT_MARGIN;
    const innerH = size.h - TOP_MARGIN - BOTTOM_MARGIN - GAP;
    const subH = innerH / 2;

    drawSubplot(ctx, LEFT_MARGIN, TOP_MARGIN, innerW, subH, 'x(t)', trajectories, 'x', bounds.t, bounds.x, scrubT);
    drawSubplot(ctx, LEFT_MARGIN, TOP_MARGIN + subH + GAP, innerW, subH, 'y(t)', trajectories, 'y', bounds.t, bounds.y, scrubT);

    geomRef.current = {
      tBounds: bounds.t,
      plotX: LEFT_MARGIN,
      plotW: innerW,
    };
  }, [size, trajectories, scrubT]);

  const onPointerMove = useCallback((e) => {
    const g = geomRef.current;
    if (!g) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (px < g.plotX || px > g.plotX + g.plotW) {
      setScrubT(null);
      return;
    }
    const frac = (px - g.plotX) / g.plotW;
    const t = g.tBounds[0] + frac * (g.tBounds[1] - g.tBounds[0]);
    setScrubT(t);
  }, [setScrubT]);

  const onPointerLeave = useCallback(() => {
    setScrubT(null);
  }, [setScrubT]);

  return (
    <div ref={containerRef} className="time-series-container">
      <canvas
        ref={canvasRef}
        className="time-series-canvas"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      />
    </div>
  );
}
