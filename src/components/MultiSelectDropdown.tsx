"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

type Option = { code: string; label: string };

type Props = {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  // If set, selecting `exclusiveCode` clears everything else; selecting any
  // other option clears `exclusiveCode`.
  exclusiveCode?: string;
  disabled?: boolean;
};

export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = "Select…",
  exclusiveCode,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(code: string) {
    const isOn = selected.includes(code);
    let next: string[];
    if (isOn) {
      next = selected.filter((c) => c !== code);
    } else if (exclusiveCode && code === exclusiveCode) {
      // Picking the exclusive option wipes all other selections.
      next = [exclusiveCode];
    } else if (exclusiveCode && selected.includes(exclusiveCode)) {
      // Picking any non-exclusive option drops the exclusive one.
      next = [...selected.filter((c) => c !== exclusiveCode), code];
    } else {
      next = [...selected, code];
    }
    onChange(next);
  }

  const selectedLabels = options
    .filter((o) => selected.includes(o.code))
    .map((o) => o.label);

  const summary =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2}`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(
          "w-full flex items-center justify-between gap-2 rounded-2xl border border-ink-200 bg-white/90 px-4 py-3 text-sm text-left transition",
          "focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100",
          disabled && "opacity-60 cursor-not-allowed",
          selectedLabels.length === 0 ? "text-ink-400" : "text-ink-900",
        )}
      >
        <span className="truncate">{summary}</span>
        <span
          className={clsx(
            "text-ink-400 transition-transform shrink-0",
            open && "rotate-180",
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-30 mt-1 w-full rounded-2xl border border-ink-200 bg-white shadow-pop max-h-64 overflow-auto py-1"
        >
          {options.map((o) => {
            const isOn = selected.includes(o.code);
            return (
              <button
                key={o.code}
                type="button"
                role="option"
                aria-selected={isOn}
                onClick={() => toggle(o.code)}
                className={clsx(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-ink-50 transition",
                  isOn && "bg-brand-50/60",
                )}
              >
                <span
                  aria-hidden
                  className={clsx(
                    "inline-flex items-center justify-center w-5 h-5 rounded-md border-2 shrink-0 transition",
                    isOn
                      ? "bg-brand-500 border-brand-500 text-white"
                      : "border-ink-300 bg-white",
                  )}
                >
                  {isOn ? "✓" : ""}
                </span>
                <span className="text-ink-800 flex-1">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
