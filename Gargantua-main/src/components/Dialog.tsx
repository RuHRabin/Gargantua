import { useEffect, useId, useRef, type ReactNode } from "react";

export function Dialog({ title, eyebrow, onClose, children, wide = false }: {
  title: string; eyebrow: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key !== "Tab") return;
      const elements = ref.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, select, a[href], [tabindex="0"]'
      );
      if (!elements?.length) { event.preventDefault(); return; }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); previous?.focus(); };
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`dialog-shell ${wide ? "dialog-wide" : ""}`}>
        <header className="dialog-header">
          <div><p className="micro-label">{eyebrow}</p><h2 id={titleId}>{title}</h2></div>
          <button className="close-button" onClick={onClose} aria-label="Close dialog">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}