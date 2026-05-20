import { useEffect, useRef, useState, useCallback } from 'react';
import { useSystemStore } from '../store/systemStore.js';
import { sampleTrajectoryAtT } from '../utils/trajectory.js';
import { TRAJ_COLORS, BG } from '../utils/constants.js';

const LEFT_MARGIN = 6;
const RIGHT_MARGIN = 6;
const TOP_MARGIN = 4;
const BOTTOM_MARGIN = 4;
const GAP = 6;

/**
 * The time range across all trajectories. The y-axis ranges, in contrast,
 * are anchored to the phase-plane view (see drawSubplot) so the scales
 * match between the two panes and don't get dominated by trajectory tails
 * that escape toward ±∞ during backward integration from unstable points.
 */
function computeTimeRange(trajectories) {
  let tMin = Infinity, tMax = -Infinity;
  for (const tr of trajectories) {
    for (let k = 0; k < tr.n; k++) {
      const t = tr.ts[k];
      if (!Number.isFinite(t)) continue;
      if (t < tMin) tMin = t;
      if (t > tMax) tMax = t;
    }
  }
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax)) return [-1, 1];
  if (tMin === tMax) return [tMin - 1, tMax + 1];
  const pad = (tMax - tMin) * 0.04;
  return [tMin - pad, tMax + pad];
}

function drawSubplot(ctx, x0, y0, w, h, label, trajectories, field, tBounds, vBounds, scrubT) {
  // Frame & background.
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText(label, x0 + 8, y0 + 16);

  // Range readout in the top-right so students can see what scale they're on.
  ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  const rangeLabel = `[${vBounds[0].toFixed(2)}, ${vBounds[1].toFixed(2)}]`;
  const rlw = ctx.measureText(rangeLabel).width;
  ctx.fillText(rangeLabel, x0 + w - rlw - 8, y0 + 14);

  // Zero line if 0 is inside the value range.
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

  // Clip to the subplot rectangle so trajectory segments that escape the
  // visible range don't bleed into the neighboring subplot or label.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();

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

  // Scrub line and per-trajectory markers (also inside the clip).
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

    for (let i = 0; i < trajectories.length; i++) {
      const tr = trajectories[i];
      const sample = sampleTrajectoryAtT(tr, scrubT);
      if (!sample) continue;
      const v = field === 'x' ? sample.x : sample.y;
      if (!Number.isFinite(v)) continue;
      // Only draw the dot if the value is inside the visible range; otherwise
      // the marker would sit on the clip edge and read as misleading.
      if (v < vBounds[0] || v > vBounds[1]) continue;
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

  ctx.restore();

  // t-readout drawn OUTSIDE the clip so it never gets cropped, and only on
  // the upper subplot's scrub line (we'll detect "upper" by drawing it here
  // unconditionally; the second call would double-draw, so the caller
  // handles which subplot draws it — see TimeSeries below).
}

function drawScrubTReadout(ctx, x0, y0, w, scrubT, tBounds) {
  if (scrubT === null || scrubT === undefined) return;
  const tSpan = tBounds[1] - tBounds[0];
  if (tSpan <= 0) return;
  if (scrubT < tBounds[0] || scrubT > tBounds[1]) return;
  const px = x0 + ((scrubT - tBounds[0]) / tSpan) * w;
  const label = `t = ${scrubT.toFixed(2)}`;
  ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace';
  const tw = ctx.measureText(label).width;
  const lx = Math.min(px + 6, x0 + w - tw - 4);
  ctx.fillStyle = 'rgba(10,12,18,0.85)';
  ctx.fillRect(lx - 3, y0 + 2, tw + 6, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(label, lx, y0 + 12);
}

export function TimeSeries() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const geomRef = useRef(null);
  const [size, setSize] = useState({ w: 600, h: 200 });
  const trajectories = useSystemStore((s) => s.trajectories);
  const view = useSystemStore((s) => s.view);
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

    ctx.fillStyle = BG;
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

    const tBounds = computeTimeRange(trajectories);
    // The two subplots inherit their y-axis ranges from the phase plane view.
    // This keeps the time-series vertical scale comparable to the phase plane
    // and prevents escaping trajectory tails from compressing the visible
    // dynamics into a flat line.
    const xBounds = [view.xMin, view.xMax];
    const yBounds = [view.yMin, view.yMax];

    const innerW = size.w - LEFT_MARGIN - RIGHT_MARGIN;
    const innerH = size.h - TOP_MARGIN - BOTTOM_MARGIN - GAP;
    const subH = innerH / 2;

    const xRect = { x0: LEFT_MARGIN, y0: TOP_MARGIN, w: innerW, h: subH };
    const yRect = { x0: LEFT_MARGIN, y0: TOP_MARGIN + subH + GAP, w: innerW, h: subH };

    drawSubplot(ctx, xRect.x0, xRect.y0, xRect.w, xRect.h, 'x(t)', trajectories, 'x', tBounds, xBounds, scrubT);
    drawSubplot(ctx, yRect.x0, yRect.y0, yRect.w, yRect.h, 'y(t)', trajectories, 'y', tBounds, yBounds, scrubT);

    // t-readout on the upper subplot only, drawn after the subplots so it
    // sits on top of everything.
    drawScrubTReadout(ctx, xRect.x0, xRect.y0, xRect.w, scrubT, tBounds);

    geomRef.current = {
      tBounds,
      plotX: LEFT_MARGIN,
      plotW: innerW,
    };
  }, [size, trajectories, view, scrubT]);

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
