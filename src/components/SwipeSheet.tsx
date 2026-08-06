import { useRef, useState, type PointerEvent, type ReactNode } from "react";

export function SwipeSheet({ children, className, ariaLabel, onDismiss }: { children: ReactNode; className: string; ariaLabel?: string; onDismiss: () => void }) {
  const startY = useRef(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  function start(event: PointerEvent<HTMLDivElement>) {
    startY.current = event.clientY;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setOffset(Math.max(0, event.clientY - startY.current));
  }
  function finish() {
    if (!dragging) return;
    setDragging(false);
    if (offset >= 90) onDismiss();
    else setOffset(0);
  }

  return <section className={`${className} swipe-sheet${dragging ? " dragging" : ""}`} aria-label={ariaLabel} style={{ transform: `translateY(${offset}px)` }}>
    <div className="swipe-sheet-handle" role="button" tabIndex={0} aria-label="גרירה מטה לסגירה" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onKeyDown={event => { if (event.key === "Escape" || event.key === "Enter" || event.key === " ") onDismiss(); }}><span /></div>
    {children}
  </section>;
}
