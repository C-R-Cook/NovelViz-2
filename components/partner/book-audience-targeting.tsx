"use client";

import { MultiSelectListbox } from "@/components/ui/multi-select-listbox";
import { MultiSelectPills } from "@/components/ui/multi-select-pills";
import { formatGenre } from "@/lib/genre";
import { AGE_RANGES, GENDERS, GENRE_OPTIONS, sanitizeTargetingAgeRanges } from "@/lib/user-profile-options";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { useCallback, useEffect, useRef, useState } from "react";

countries.registerLocale(enLocale);

const COUNTRY_OPTIONS = Object.entries(countries.getNames("en", { select: "official" }))
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

export type BookTargetingState = {
  featuredTargetAgeRanges: string[];
  featuredTargetGenders: string[];
  featuredTargetCountries: string[];
  featuredTargetGenres: string[];
};

type Props = {
  bookId: string;
  bookGenre: string | null;
  initial: BookTargetingState;
  showPreview?: boolean;
  editingLabel?: string;
};

export function BookAudienceTargeting({
  bookId,
  bookGenre,
  initial,
  showPreview = false,
  editingLabel,
}: Props) {
  const [targeting, setTargeting] = useState<BookTargetingState>(() => ({
    ...initial,
    featuredTargetAgeRanges: sanitizeTargetingAgeRanges(initial.featuredTargetAgeRanges),
  }));
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    genrePreferenceReaders: number;
    libraryGenreReaders: number;
    ageLabel: string;
    genderLabel: string;
    countryLabel: string;
    combinedReach: number;
  } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTargeting({
      ...initial,
      featuredTargetAgeRanges: sanitizeTargetingAgeRanges(initial.featuredTargetAgeRanges),
    });
  }, [initial]);

  const persist = useCallback(
    async (next: BookTargetingState) => {
      setSaveErr(null);
      try {
        const res = await fetch(`/api/partner/books/${bookId}/targeting`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Save failed");
        setSavedFlash(true);
        if (flashRef.current) clearTimeout(flashRef.current);
        flashRef.current = setTimeout(() => setSavedFlash(false), 2000);
      } catch (e) {
        setSaveErr(e instanceof Error ? e.message : "Save failed");
      }
    },
    [bookId],
  );

  function updateTargeting(patch: Partial<BookTargetingState>) {
    const next = { ...targeting, ...patch };
    setTargeting(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void persist(next), 800);
  }

  const loadPreview = useCallback(async () => {
    if (!showPreview) return;
    setPreviewBusy(true);
    try {
      const res = await fetch(`/api/admin/books/${bookId}/targeting-preview`);
      const data = (await res.json()) as typeof preview & { error?: string };
      if (!res.ok) throw new Error(data?.error || "Preview failed");
      setPreview(data);
    } catch {
      setPreview(null);
    } finally {
      setPreviewBusy(false);
    }
  }, [bookId, showPreview]);

  useEffect(() => {
    if (showPreview) void loadPreview();
  }, [showPreview, loadPreview]);

  const genreHelper = bookGenre
    ? `This book's genre (${formatGenre(bookGenre)}) is always included. Add genres here to also reach readers with different preferences.`
    : "Add genres to reach readers with matching preferences.";

  return (
    <section className="rounded-xl border border-border bg-bg-surface/85 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
          Audience targeting
        </p>
        {savedFlash ? <span className="text-xs text-success">Saved ✓</span> : null}
        {editingLabel ? (
          <span className="text-xs text-text-muted">{editingLabel}</span>
        ) : null}
      </div>
      <p className="mt-2 max-w-2xl text-sm text-text-secondary">
        Define the audience most likely to enjoy this book. Leave a field empty to reach all readers
        in that group. Your book remains visible to everyone — targeting determines priority
        placement.
      </p>
      {saveErr ? <p className="mt-2 text-sm text-error">{saveErr}</p> : null}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-text-primary">Age ranges</p>
          <MultiSelectPills
            options={AGE_RANGES}
            selected={targeting.featuredTargetAgeRanges}
            onChange={(featuredTargetAgeRanges) => updateTargeting({ featuredTargetAgeRanges })}
            placeholder="All ages"
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-text-primary">Genders</p>
          <MultiSelectPills
            options={GENDERS}
            selected={targeting.featuredTargetGenders}
            onChange={(featuredTargetGenders) => updateTargeting({ featuredTargetGenders })}
            placeholder="All genders"
          />
        </div>
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-text-primary">Countries</p>
          <MultiSelectListbox
            searchable
            options={COUNTRY_OPTIONS}
            selected={targeting.featuredTargetCountries}
            onChange={(featuredTargetCountries) => updateTargeting({ featuredTargetCountries })}
            placeholder="All countries"
          />
        </div>
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-text-primary">Additional genres</p>
          <MultiSelectPills
            options={GENRE_OPTIONS}
            selected={targeting.featuredTargetGenres}
            onChange={(featuredTargetGenres) => updateTargeting({ featuredTargetGenres })}
            placeholder="Book's own genre only"
            helperText={genreHelper}
          />
        </div>
      </div>
      {showPreview ? (
        <div className="mt-6 rounded-lg border border-border/80 bg-bg-raised/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary">Targeting preview</h3>
            <button
              type="button"
              disabled={previewBusy}
              onClick={() => void loadPreview()}
              className="text-sm text-accent-text hover:underline disabled:opacity-60"
            >
              Refresh
            </button>
          </div>
          <p className="mt-1 text-xs text-text-muted">Approximate, rounded to nearest 5</p>
          {preview ? (
            <ul className="mt-3 space-y-1 text-sm text-text-secondary">
              <li>Genre signal: ~{preview.genrePreferenceReaders} readers have matching genre preferences</li>
              <li>Library signal: ~{preview.libraryGenreReaders} readers have this genre in their active library</li>
              <li>Age range: {preview.ageLabel}</li>
              <li>Gender: {preview.genderLabel}</li>
              <li>Country: {preview.countryLabel}</li>
              <li className="pt-2 font-medium text-text-primary">
                Estimated combined reach: ~{preview.combinedReach} readers
              </li>
            </ul>
          ) : (
            <p className="mt-3 text-sm text-text-muted">
              {previewBusy ? "Loading preview…" : "Preview unavailable."}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
