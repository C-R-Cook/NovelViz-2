"use client";

type SpoilerVisibility = "show" | "hide";

export type GallerySpoilerSelectProps = {
  value: SpoilerVisibility;
  onChange: (value: SpoilerVisibility) => void;
  pending?: boolean;
  disabled?: boolean;
  className?: string;
};

export function GallerySpoilerSelect({
  value,
  onChange,
  pending = false,
  disabled = false,
  className,
}: GallerySpoilerSelectProps) {
  return (
    <div className={["shrink-0", className].filter(Boolean).join(" ")}>
      <label className="sr-only" htmlFor="gallery-spoiler-visibility">
        Spoiler visibility
      </label>
      <select
        id="gallery-spoiler-visibility"
        value={value}
        disabled={disabled || pending}
        onChange={(event) => onChange(event.target.value as SpoilerVisibility)}
        aria-busy={pending}
        className="w-fit min-w-[17ch] max-w-full cursor-pointer rounded-md border border-border bg-bg-surface px-2 py-1 text-xs font-medium leading-tight text-text-primary [field-sizing:content] transition hover:border-accent/45 focus-visible:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="hide">Hiding spoilers</option>
        <option value="show">Showing spoilers</option>
      </select>
    </div>
  );
}
