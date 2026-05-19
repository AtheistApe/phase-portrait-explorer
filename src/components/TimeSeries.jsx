import { useEffect, useRef, useState } from 'react';
import { useSystemStore } from '../store/systemStore.js';

const TRAJ_COLORS = [
  '#d4ff4a', '#5ee2ff', '#ff7a59', '#bd93ff',
  '#ffd166', '#06d6a0', '#ff5ec4', '#73e8ff',
];

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
  // Add a 5% pad.
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

function drawSubplot(ctx, x0, y0, w, h, label, trajectories, accessor, tBounds, vBounds) {
  // Frame.
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);

  // Axes labels.
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText(label, x0 + 8, y0 + 16);

  // Zero line.
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
      else {
        ctx.moveTo(px, py);
        started = true;
      }
    }
    ctx.stroke();
  }
}

export function TimeSeries() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 600, h: 200 });
  const trajectories = useSystemStore((s) => s.trajectories);

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
      return;
    }

    const bounds = computeBounds(trajectories);
    const gap = 6;
    const subH = (size.h - gap) / 2;
    drawSubplot(ctx, 0, 0, size.w, subH, 'x(t)', trajectories, (tr, k) => tr.xs[k], bounds.t, bounds.x);
    drawSubplot(ctx, 0, subH + gap, size.w, subH, 'y(t)', trajectories, (tr, k) => tr.ys[k], bounds.t, bounds.y);
  }, [size, trajectories]);

  return (
    <div ref={containerRef} className="time-series-container">
      <canvas ref={canvasRef} className="time-series-canvas" />
    </div>
  );
}
