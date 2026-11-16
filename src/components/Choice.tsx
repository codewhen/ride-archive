import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { Check, ChevronDown } from "./Icons";

type Option = { value: string; label: string };
/** Select-only combobox with an opaque, theme-controlled menu on every OS. */
export function Choice({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const selected = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(selected),
    [position, setPosition] = useState<CSSProperties>({});
  const search = useRef({ text: "", time: 0 });
  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  const show = (index = selected) => {
    setActive(index);
    setOpen(true);
  };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trigger.current!.getBoundingClientRect();
      const gap = 6,
        padding = 8;
      const width = Math.min(
        innerWidth - padding * 2,
        Math.max(
          r.width,
          144,
          Math.min(
            280,
            Math.max(...options.map((o) => o.label.length)) * 7 + 50,
          ),
        ),
      );
      const above = r.top - padding - gap,
        below = innerHeight - r.bottom - padding - gap;
      const desired = Math.min(
        320,
        options.length * (innerWidth <= 720 ? 44 : 38) + 12,
      );
      const down = below >= desired || below >= above;
      const height = Math.max(40, Math.min(desired, down ? below : above));
      setPosition({
        width,
        left: Math.max(padding, Math.min(r.left, innerWidth - width - padding)),
        top: down ? r.bottom + gap : Math.max(padding, r.top - gap - height),
        maxHeight: height,
      });
    };
    place();
    const outside = (e: PointerEvent) => {
      if (
        !trigger.current?.contains(e.target as Node) &&
        !menu.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const scroll = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) place();
    };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [open, options]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        className={`choice-trigger ${className}`}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        title={options[selected]?.label}
        onClick={() => (open ? setOpen(false) : show())}
        onBlur={(e) => {
          if (!menu.current?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            return;
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const delta = e.key === "ArrowDown" ? 1 : -1;
            if (open)
              setActive((i) =>
                Math.max(0, Math.min(options.length - 1, i + delta)),
              );
            else show(selected);
            return;
          }
          if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            show(e.key === "Home" ? 0 : options.length - 1);
            return;
          }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (open) choose(active);
            else show();
            return;
          }
          if (e.key === "Tab" && open) {
            onChange(options[active].value);
            setOpen(false);
            return;
          }
          if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
            const now = Date.now();
            search.current = {
              text:
                now - search.current.time < 750
                  ? search.current.text + e.key
                  : e.key,
              time: now,
            };
            const index = options.findIndex((o) =>
              o.label
                .toLowerCase()
                .startsWith(search.current.text.toLowerCase()),
            );
            if (index >= 0) {
              e.preventDefault();
              show(index);
            }
          }
        }}
      >
        <span>{options[selected]?.label}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="listbox"
            aria-label={label}
            className="choice-menu"
            style={position}
            onPointerDown={(e) => e.preventDefault()}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={option.value === value}
                className={`choice-option ${active === index ? "highlighted" : ""}`}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
              >
                <span className="choice-check">
                  {option.value === value && <Check aria-hidden="true" />}
                </span>
                <span title={option.label}>{option.label}</span>
              </div>
            ))}
          </div>,
          document.fullscreenElement || document.body,
        )}
    </>
  );
}
