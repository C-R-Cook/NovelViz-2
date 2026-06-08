"use client";

import { useMemo, useState } from "react";

export type MultiSelectListboxProps = {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  helperText?: string;
  listHeight?: string;
};

export function MultiSelectListbox({
  options,
  selected,
  onChange,
  placeholder = "All",
  searchable = false,
  disabled = false,
  helperText,
  listHeight = "11rem",
}: MultiSelectListboxProps) {
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

  const summary =
    selected.length === 0 ? placeholder : `${selected.length} selected`;

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
            placeholder="Search…"
            className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50"
          />
        </label>
      ) : null}
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-text-muted">
        <span>{summary}</span>
        {selected.length > 0 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([])}
            className="text-accent-text hover:underline disabled:cursor-not-allowed"
          >
            Clear
          </button>
        ) : null}
      </div>
      <div
        className="overflow-y-auto rounded-lg border border-border bg-bg-surface"
        style={{ maxHeight: listHeight }}
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-text-muted">No matches</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {filtered.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <li key={opt.value}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-bg-raised/80">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(opt.value)}
                      className="h-3.5 w-3.5 shrink-0 rounded border-border accent-accent"
                    />
                    <span
                      className={
                        checked ? "text-text-primary" : "text-text-secondary"
                      }
                    >
                      {opt.label}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {helperText ? <p className="mt-2 text-xs text-text-muted">{helperText}</p> : null}
    </div>
  );
}
