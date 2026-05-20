import { useCallback, useRef } from 'react';

/**
 * Drag-to-resize splitter.
 *
 *   <Splitter axis="col" onResize={(dx) => ...} />   // vertical bar, drags ←→
 *   <Splitter axis="row" onResize={(dy) => ...} />   // horizontal bar, drags ↕
 *
 * onResize receives the *delta* in pixels since the last move event. The
 * parent decides how to apply it (which side grows, what bounds to clamp).
 *
 * Implementation notes:
 *  - Uses setPointerCapture so move/up events stay attached to the splitter
 *    even when the cursor leaves it. No need for window-level listeners.
 *  - During drag we lock the document cursor and disable text selection by
 *    toggling a body class; otherwise dragging over text in the side panel
 *    flickers the cursor and starts spurious selections.
 */
export function Splitter({ axis, onResize, ariaLabel }) {
  const dragRef = useRef(null);

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return; // primary button only
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
    document.body.classList.add(axis === 'col' ? 'is-resizing-col' : 'is-resizing-row');
  }, [axis]);

  const handlePointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    onResize(axis === 'col' ? dx : dy);
  }, [axis, onResize]);

  const handlePointerUp = useCallback((e) => {
    dragRef.current = null;
    document.body.classList.remove('is-resizing-col', 'is-resizing-row');
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  return (
    <div
      className={`splitter splitter-${axis}`}
      role="separator"
      aria-orientation={axis === 'col' ? 'vertical' : 'horizontal'}
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
