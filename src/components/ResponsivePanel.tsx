import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/** A docked desktop panel becomes a native modal drawer on smaller screens. */
export function ResponsivePanel({
  query,
  open = true,
  className,
  label,
  onClose,
  children,
}: {
  query: string;
  open?: boolean;
  className: string;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [modal, setModal] = useState(
    () => window.matchMedia(query).matches || !!document.fullscreenElement,
  );
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () =>
      setModal(media.matches || !!document.fullscreenElement);
    update();
    media.addEventListener("change", update);
    document.addEventListener("fullscreenchange", update);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("fullscreenchange", update);
    };
  }, [query]);
  useEffect(() => {
    const dialog = ref.current;
    if (!modal || !open || !dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [modal, open]);
  if (!modal)
    return (
      <aside className={className} aria-label={label}>
        {children}
      </aside>
    );
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      className={`${className} modal-panel`}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const focusable = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not([type="hidden"]),select,textarea,summary,[tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (el) => el.getClientRects().length > 0 && !el.hasAttribute("hidden"),
        );
        const first = focusable[0],
          last = focusable.at(-1);
        if (!first || !last) return;
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === e.currentTarget)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          close.current();
      }}
    >
      {children}
    </dialog>
  );
}
