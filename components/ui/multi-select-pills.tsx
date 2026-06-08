"use client";

import { useMemo, useState } from "react";

export type MultiSelectPillsProps = {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  helperText?: string;
};

export function MultiSelectPills({
  options,
  selected,
  onChange,
  placeholder = "All",
  searchable = false,
  disabled = false,
  helperText,
}: MultiSelectPillsProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query, searchable]);

  function toggle(value: string) {
    if (disabled) return;
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  }

  return (
    <div className={disabled ? "opacity-60" : undefined}>
      {searchable ? (
        <label className="mb-2 block text-sm">
          <span className="sr-only">Filter options</span>
          <input
            type="search"
            disabled={disabled}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => setQuery("")}
            placeholder="Search…"
            className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50"
          />
        </label>
      ) : null}
      {selected.length === 0 ? (
        <p className="mb-2 text-xs text-text-muted">{placeholder}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {filtered.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => toggle(opt.value)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
                active
                  ? "border-accent bg-accent text-text-on-accent"
                  : "border-border bg-transparent text-text-secondary hover:border-accent/40"
              } disabled:cursor-not-allowed`}
            >
              {opt.label}
              {active ? <span aria-hidden>×</span> : null}
            </button>
          );
        })}
      </div>
      {helperText ? <p className="mt-2 text-xs text-text-muted">{helperText}</p> : null}
    </div>
  );
}
