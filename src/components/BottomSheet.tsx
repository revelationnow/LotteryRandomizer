import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

/**
 * Mobile bottom sheet.
 *
 * The luck controls live here on a phone so the draw stage keeps the whole screen.
 * On md+ the parent renders the same content inline and never mounts this.
 *
 * Hand-rolled rather than pulled from an animation library: the whole behaviour is
 * a CSS keyframe plus a pointer handler for drag-to-dismiss, which is a fraction
 * of the cost of shipping a general-purpose motion runtime to do the same thing.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Kept mounted briefly after `open` goes false so the exit animation can run.
  const [present, setPresent] = useState(open);
  const [closing, setClosing] = useState(false);
  const drag = useRef<{ startY: number; startT: number } | null>(null);

  useEffect(() => {
    if (open) {
      setPresent(true);
      setClosing(false);
      return;
    }
    if (!present) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setPresent(false);
      setClosing(false);
    }, 240);
    return () => window.clearTimeout(t);
  }, [open, present]);

  // Escape closes, and the page behind must not scroll while the sheet is up.
  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [present, onClose]);

  if (!present) return null;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Only start a drag from the grab handle area, so the scrollable body below
    // still scrolls normally.
    if (!(e.target as HTMLElement).closest('[data-sheet-handle]')) return;
    drag.current = { startY: e.clientY, startT: Date.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !panelRef.current) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    panelRef.current.style.transform = `translateY(${dy}px)`;
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !panelRef.current) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    const velocity = dy / Math.max(1, Date.now() - drag.current.startT);
    drag.current = null;
    panelRef.current.style.transform = '';
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    // Far enough, or fast enough, counts as a dismiss.
    if (dy > 120 || velocity > 0.6) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-void/70 backdrop-blur-sm ${closing ? 'opacity-0' : 'fade-in'} transition-opacity duration-200`}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`safe-bottom absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-white/12 bg-void-2/95 backdrop-blur-2xl ${
          closing ? 'sheet-out' : 'sheet-in'
        }`}
        style={{ touchAction: 'pan-y' }}
      >
        <div
          data-sheet-handle
          className="sticky top-0 z-10 flex items-center justify-between border-b border-white/8 bg-void-2/95 px-4 pt-3 pb-3"
        >
          <div aria-hidden className="absolute inset-x-0 top-1 mx-auto h-1 w-10 rounded-full bg-white/25" />
          <h2 className="mt-2 font-display text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="mt-2 grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-white/8 hover:text-ink"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-4 pt-4 pb-8">{children}</div>
      </div>
    </div>
  );
}
