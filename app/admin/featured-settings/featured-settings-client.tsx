"use client";

import "./featured-settings.css";
import "react-calendar/dist/Calendar.css";

import {
  scoreBookDimensions,
  qualitativeMatchTag,
  type FeaturedBookWithTargeting,
  type LibraryAddedRecency,
  type LibraryBookEntry,
  type LibraryProgress,
  type UserScoringProfile,
} from "@/lib/featured-book-scoring";
import type { ScoringWeights } from "@/lib/featured-scoring-weights";
import { DEFAULT_SCORING_WEIGHTS } from "@/lib/featured-scoring-weights";
import {
  SCORING_FIELD_GROUPS,
  SCORING_FIELD_LABELS,
  SCORING_FIELD_META,
} from "@/lib/scoring-field-labels";
import { buildRadarPoints } from "@/lib/scoring-radar";
import { MultiSelectListbox } from "@/components/ui/multi-select-listbox";
import { AGE_RANGES, GENDERS, GENRE_OPTIONS } from "@/lib/user-profile-options";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Calendar from "react-calendar";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

countries.registerLocale(enLocale);

const COUNTRY_OPTIONS = Object.entries(countries.getNames("en", { select: "official" }))
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25";

type UploadAge = "fresh" | "recent" | "warm" | "old";

type TestReaderState = {
  ageRange: string;
  gender: string;
  country: string;
  genrePreferences: string[];
  libraryBooks: LibraryBookEntry[];
};

type TestBookState = {
  genre: string;
  uploadAge: UploadAge;
  isPublicDomain: boolean;
  featuredTargetAgeRanges: string[];
  featuredTargetGenders: string[];
  featuredTargetCountries: string[];
  featuredTargetGenres: string[];
};

type HistoryChange = {
  id: string;
  savedAt: string;
  savedByName: string;
  weights: ScoringWeights;
  diff: Partial<Record<keyof ScoringWeights, { from: number; to: number }>>;
};

type HistoryDay = {
  date: string;
  changes: HistoryChange[];
};

const EMPTY_READER: TestReaderState = {
  ageRange: "",
  gender: "",
  country: "",
  genrePreferences: [],
  libraryBooks: [],
};

const EMPTY_BOOK: TestBookState = {
  genre: "fantasy",
  uploadAge: "fresh",
  isPublicDomain: false,
  featuredTargetAgeRanges: [],
  featuredTargetGenders: [],
  featuredTargetCountries: [],
  featuredTargetGenres: [],
};

function uploadAgeToDate(uploadAge: UploadAge): Date {
  const days =
    uploadAge === "fresh" ? 3 : uploadAge === "recent" ? 15 : uploadAge === "warm" ? 60 : 120;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function testBookToFeatured(book: TestBookState): FeaturedBookWithTargeting {
  return {
    id: "test-book",
    title: "Test Book",
    author: "Test Author",
    coverImageUrl: "",
    genre: book.genre,
    readerCount: 0,
    isPublicDomain: book.isPublicDomain,
    createdAt: uploadAgeToDate(book.uploadAge),
    featuredTargetAgeRanges: book.featuredTargetAgeRanges,
    featuredTargetGenders: book.featuredTargetGenders,
    featuredTargetCountries: book.featuredTargetCountries,
    featuredTargetGenres: book.featuredTargetGenres,
  };
}

function readerToProfile(reader: TestReaderState): UserScoringProfile {
  return {
    ageRange: reader.ageRange || null,
    gender: reader.gender || null,
    country: reader.country || null,
    genrePreferences: reader.genrePreferences,
    libraryBooks: reader.libraryBooks,
  };
}

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function PillToggle({
  options,
  selected,
  onChange,
  searchable,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchable?: boolean;
}) {
  const [q, setQ] = useState("");
  const filtered = searchable
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q.trim().toLowerCase()) ||
          o.value.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : options;

  return (
    <div className="space-y-2">
      {searchable ? (
        <input
          className={inputClass}
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {filtered.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(toggleInList(selected, opt.value))}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                active
                  ? "border-accent/50 bg-accent text-text-on-accent"
                  : "border-border bg-bg-raised text-text-secondary hover:border-accent/35"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ConfirmModal({
  open,
  onCancel,
  onConfirm,
  busy,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="max-w-md rounded-xl border border-border bg-bg-surface p-6 shadow-lg"
      >
        <p className="text-sm leading-relaxed text-text-primary">
          This will update the scoring weights immediately across the entire site. All featured book
          recommendations will reflect the new weights within 60 seconds. Are you sure?
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-bg-raised"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent hover:brightness-110 disabled:opacity-60"
          >
            Save weights
          </button>
        </div>
      </div>
    </div>
  );
}

export function FeaturedSettingsClient() {
  const liveWeightsRef = useRef<HTMLDivElement>(null);
  const [weights, setWeights] = useState<ScoringWeights>({ ...DEFAULT_SCORING_WEIGHTS });
  const [defaults, setDefaults] = useState<ScoringWeights>({ ...DEFAULT_SCORING_WEIGHTS });
  const [testReader, setTestReader] = useState<TestReaderState>(EMPTY_READER);
  const [testBook, setTestBook] = useState<TestBookState>(EMPTY_BOOK);
  const [snapshotBanner, setSnapshotBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDays, setHistoryDays] = useState<HistoryDay[]>([]);
  const [historyDates, setHistoryDates] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    const res = await fetch("/api/admin/featured-scoring/config");
    const data = (await res.json()) as {
      current?: ScoringWeights;
      defaults?: ScoringWeights;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error || "Failed to load config");
    if (data.current) setWeights(data.current);
    if (data.defaults) setDefaults(data.defaults);
  }, []);

  const loadHistory = useCallback(async (date: Date) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/admin/featured-scoring/history?year=${date.getFullYear()}&month=${date.getMonth() + 1}`,
      );
      const data = (await res.json()) as { entries?: HistoryDay[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load history");
      const entries = data.entries ?? [];
      setHistoryDays(entries);
      setHistoryDates(new Set(entries.map((e) => e.date)));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadConfig();
      } catch (e) {
        setSaveErr(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadConfig]);

  useEffect(() => {
    void loadHistory(calendarDate);
  }, [calendarDate, loadHistory]);

  const profile = useMemo(() => readerToProfile(testReader), [testReader]);
  const featuredBook = useMemo(() => testBookToFeatured(testBook), [testBook]);

  const liveDimensions = useMemo(
    () => scoreBookDimensions(profile, featuredBook, weights),
    [profile, featuredBook, weights],
  );
  const defaultDimensions = useMemo(
    () => scoreBookDimensions(profile, featuredBook, defaults),
    [profile, featuredBook, defaults],
  );

  const radarData = useMemo(() => {
    const live = buildRadarPoints(liveDimensions, weights);
    const def = buildRadarPoints(defaultDimensions, defaults);
    return live.map((p, i) => ({
      label: p.label,
      live: p.normalized,
      defaults: def[i]?.normalized ?? 50,
      liveRaw: p.raw,
    }));
  }, [liveDimensions, defaultDimensions, weights, defaults]);

  const saveWeights = useCallback(async () => {
    setSaveBusy(true);
    setSaveErr(null);
    setSaveOk(false);
    try {
      const res = await fetch("/api/admin/featured-scoring/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(weights),
      });
      const data = (await res.json()) as { current?: ScoringWeights; error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (data.current) setWeights(data.current);
      setSaveOk(true);
      void loadHistory(calendarDate);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaveBusy(false);
      setConfirmOpen(false);
    }
  }, [weights, calendarDate, loadHistory]);

  const selectedDayChanges = useMemo(() => {
    if (!selectedDay) return [];
    return historyDays.find((d) => d.date === selectedDay)?.changes ?? [];
  }, [historyDays, selectedDay]);

  const selectedChange = useMemo(() => {
    if (!selectedChangeId) return selectedDayChanges[0] ?? null;
    return selectedDayChanges.find((c) => c.id === selectedChangeId) ?? null;
  }, [selectedChangeId, selectedDayChanges]);

  function restoreSnapshot(change: HistoryChange) {
    setWeights(change.weights);
    const when = new Date(change.savedAt).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    setSnapshotBanner(`Loaded from snapshot: ${when} — saved by ${change.savedByName}`);
    liveWeightsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearSnapshotOnEdit() {
    if (snapshotBanner) setSnapshotBanner(null);
  }

  function updateWeight(key: keyof ScoringWeights, raw: string) {
    clearSnapshotOnEdit();
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    setWeights((prev) => ({ ...prev, [key]: n }));
  }

  if (loading) {
    return <p className="text-sm text-text-muted">Loading scoring settings…</p>;
  }

  return (
    <div className="space-y-10 pb-16">
      <ConfirmModal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void saveWeights()}
        busy={saveBusy}
      />

      <section ref={liveWeightsRef} className="rounded-xl border border-border bg-bg-surface/90 p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-muted">
          Live weights
        </h2>
        <div className="mt-5 space-y-6">
          {SCORING_FIELD_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-3 text-sm font-semibold text-text-primary">{group.title}</h3>
              <div className="featured-settings-weights-grid">
                {group.keys.map((key) => {
                  const isCustom = weights[key] !== defaults[key];
                  const { short, full } = SCORING_FIELD_META[key];
                  return (
                    <label key={key} className="featured-settings-weight-field">
                      <span className="featured-settings-weight-label" title={full}>
                        {short}
                      </span>
                      <div className="featured-settings-weight-control">
                        <input
                          type="number"
                          min={1}
                          title={full}
                          className={`featured-settings-weight-input${isCustom ? " featured-settings-weight-input--custom" : ""}`}
                          value={weights[key]}
                          onChange={(e) => updateWeight(key, e.target.value)}
                        />
                        <span className="featured-settings-weight-default" title={`Default: ${defaults[key]}`}>
                          {defaults[key]}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saveBusy}
            onClick={() => setConfirmOpen(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent hover:brightness-110 disabled:opacity-60"
          >
            Save weights
          </button>
          {saveOk ? <span className="text-sm text-success">Saved ✓</span> : null}
          {saveErr ? <span className="text-sm text-error">{saveErr}</span> : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg-surface/90 p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-muted">
          Radar chart preview
        </h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:items-center">
          <div className="mx-auto h-[400px] w-full max-w-[500px] lg:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Live weights"
                  dataKey="live"
                  stroke="var(--accent)"
                  fill="var(--accent)"
                  fillOpacity={0.25}
                />
                <Radar
                  name="Defaults"
                  dataKey="defaults"
                  stroke="var(--text-muted)"
                  fill="transparent"
                  strokeDasharray="4 4"
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="min-w-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted">
                  <th className="pb-2 font-medium">Dimension</th>
                  <th className="pb-2 font-medium">Raw score</th>
                </tr>
              </thead>
              <tbody>
                {radarData.map((row) => (
                  <tr key={row.label} className="border-t border-border/60">
                    <td className="py-2 text-text-secondary">{row.label}</td>
                    <td className="py-2 font-mono text-text-primary">{row.liveRaw}</td>
                  </tr>
                ))}
                <tr className="border-t border-border font-semibold">
                  <td className="py-2 text-text-primary">Total</td>
                  <td className="py-2 font-mono text-text-primary">
                    {liveDimensions.total}{" "}
                    <span className="ml-2 text-xs font-normal text-accent-text">
                      {qualitativeMatchTag(liveDimensions.total)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg-surface/90 p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-muted">
          Test scenario builder
        </h2>
        {snapshotBanner ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent-muted/40 px-4 py-2 text-sm text-text-primary">
            <span>{snapshotBanner}</span>
            <button
              type="button"
              aria-label="Dismiss snapshot banner"
              onClick={() => setSnapshotBanner(null)}
              className="text-text-muted hover:text-text-primary"
            >
              ✕
            </button>
          </div>
        ) : null}
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border/80 p-4">
            <h3 className="text-sm font-semibold text-text-primary">Test reader</h3>
            <div className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="text-text-muted">Age range</span>
                <select
                  className={inputClass}
                  value={testReader.ageRange}
                  onChange={(e) => {
                    clearSnapshotOnEdit();
                    setTestReader((p) => ({ ...p, ageRange: e.target.value }));
                  }}
                >
                  <option value="">—</option>
                  {AGE_RANGES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-text-muted">Gender</span>
                <select
                  className={inputClass}
                  value={testReader.gender}
                  onChange={(e) => {
                    clearSnapshotOnEdit();
                    setTestReader((p) => ({ ...p, gender: e.target.value }));
                  }}
                >
                  <option value="">—</option>
                  {GENDERS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-text-muted">Country</span>
                <select
                  className={inputClass}
                  value={testReader.country}
                  onChange={(e) => {
                    clearSnapshotOnEdit();
                    setTestReader((p) => ({ ...p, country: e.target.value }));
                  }}
                >
                  <option value="">—</option>
                  {COUNTRY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className="text-sm text-text-muted">Genre preferences</p>
                <PillToggle
                  options={GENRE_OPTIONS}
                  selected={testReader.genrePreferences}
                  onChange={(genrePreferences) => {
                    clearSnapshotOnEdit();
                    setTestReader((p) => ({ ...p, genrePreferences }));
                  }}
                />
              </div>
              <div>
                <p className="mb-2 text-sm text-text-muted">Library books</p>
                {testReader.libraryBooks.map((entry, idx) => (
                  <div key={idx} className="mb-3 grid gap-2 rounded border border-border/70 p-3 sm:grid-cols-3">
                    <select
                      className={inputClass}
                      value={entry.genre}
                      onChange={(e) => {
                        clearSnapshotOnEdit();
                        setTestReader((p) => {
                          const libraryBooks = [...p.libraryBooks];
                          libraryBooks[idx] = { ...libraryBooks[idx]!, genre: e.target.value };
                          return { ...p, libraryBooks };
                        });
                      }}
                    >
                      {GENRE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className={inputClass}
                      value={entry.progress}
                      onChange={(e) => {
                        clearSnapshotOnEdit();
                        setTestReader((p) => {
                          const libraryBooks = [...p.libraryBooks];
                          libraryBooks[idx] = {
                            ...libraryBooks[idx]!,
                            progress: e.target.value as LibraryProgress,
                          };
                          return { ...p, libraryBooks };
                        });
                      }}
                    >
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="more_than_halfway">More than halfway</option>
                    </select>
                    <select
                      className={inputClass}
                      value={entry.addedRecency}
                      onChange={(e) => {
                        clearSnapshotOnEdit();
                        setTestReader((p) => {
                          const libraryBooks = [...p.libraryBooks];
                          libraryBooks[idx] = {
                            ...libraryBooks[idx]!,
                            addedRecency: e.target.value as LibraryAddedRecency,
                          };
                          return { ...p, libraryBooks };
                        });
                      }}
                    >
                      <option value="recent">Within last 90 days</option>
                      <option value="stale">Older than 90 days</option>
                    </select>
                    <button
                      type="button"
                      className="text-xs text-error sm:col-span-3"
                      onClick={() => {
                        clearSnapshotOnEdit();
                        setTestReader((p) => ({
                          ...p,
                          libraryBooks: p.libraryBooks.filter((_, i) => i !== idx),
                        }));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {testReader.libraryBooks.length < 6 ? (
                  <button
                    type="button"
                    className="text-sm text-accent-text hover:underline"
                    onClick={() => {
                      clearSnapshotOnEdit();
                      setTestReader((p) => ({
                        ...p,
                        libraryBooks: [
                          ...p.libraryBooks,
                          {
                            genre: "fantasy",
                            progress: "not_started",
                            addedRecency: "recent",
                          },
                        ],
                      }));
                    }}
                  >
                    + Add library book
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/80 p-4">
            <h3 className="text-sm font-semibold text-text-primary">Test book</h3>
            <div className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="text-text-muted">Genre</span>
                <select
                  className={inputClass}
                  value={testBook.genre}
                  onChange={(e) => {
                    clearSnapshotOnEdit();
                    setTestBook((p) => ({ ...p, genre: e.target.value }));
                  }}
                >
                  {GENRE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-text-muted">Upload date</span>
                <select
                  className={inputClass}
                  value={testBook.uploadAge}
                  onChange={(e) => {
                    clearSnapshotOnEdit();
                    setTestBook((p) => ({ ...p, uploadAge: e.target.value as UploadAge }));
                  }}
                >
                  <option value="fresh">Within 7 days</option>
                  <option value="recent">8–30 days</option>
                  <option value="warm">31–90 days</option>
                  <option value="old">90+ days</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={testBook.isPublicDomain}
                  onChange={(e) => {
                    clearSnapshotOnEdit();
                    setTestBook((p) => ({ ...p, isPublicDomain: e.target.checked }));
                  }}
                />
                Public domain (disables recency scoring)
              </label>
              <div>
                <p className="text-sm text-text-muted">Target age ranges</p>
                <PillToggle
                  options={AGE_RANGES}
                  selected={testBook.featuredTargetAgeRanges}
                  onChange={(featuredTargetAgeRanges) => {
                    clearSnapshotOnEdit();
                    setTestBook((p) => ({ ...p, featuredTargetAgeRanges }));
                  }}
                />
              </div>
              <div>
                <p className="text-sm text-text-muted">Target genders</p>
                <PillToggle
                  options={GENDERS}
                  selected={testBook.featuredTargetGenders}
                  onChange={(featuredTargetGenders) => {
                    clearSnapshotOnEdit();
                    setTestBook((p) => ({ ...p, featuredTargetGenders }));
                  }}
                />
              </div>
              <div>
                <p className="text-sm text-text-muted">Target countries</p>
                <MultiSelectListbox
                  searchable
                  placeholder="All countries"
                  options={COUNTRY_OPTIONS}
                  selected={testBook.featuredTargetCountries}
                  onChange={(featuredTargetCountries) => {
                    clearSnapshotOnEdit();
                    setTestBook((p) => ({ ...p, featuredTargetCountries }));
                  }}
                />
              </div>
              <div>
                <p className="text-sm text-text-muted">Additional target genres</p>
                <PillToggle
                  options={GENRE_OPTIONS}
                  selected={testBook.featuredTargetGenres}
                  onChange={(featuredTargetGenres) => {
                    clearSnapshotOnEdit();
                    setTestBook((p) => ({ ...p, featuredTargetGenres }));
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <button
            type="button"
            disabled={saveBusy}
            onClick={() => setConfirmOpen(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent hover:brightness-110 disabled:opacity-60"
          >
            Publish weights
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg-surface/90 p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-muted">
          History calendar
        </h2>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row">
          <div className="featured-settings-calendar shrink-0">
            {historyLoading ? (
              <p className="mb-2 text-xs text-text-muted">Loading history…</p>
            ) : null}
            <Calendar
              value={selectedDay ? new Date(`${selectedDay}T12:00:00`) : null}
              onChange={(value) => {
                if (!(value instanceof Date)) return;
                const date = value.toISOString().slice(0, 10);
                setSelectedDay(date);
                setSelectedChangeId(null);
              }}
              onActiveStartDateChange={({ activeStartDate }) => {
                if (activeStartDate) setCalendarDate(activeStartDate);
              }}
              tileClassName={({ date, view }) => {
                if (view !== "month") return null;
                const key = date.toISOString().slice(0, 10);
                return historyDates.has(key) ? "react-calendar__tile--has-history" : null;
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            {!selectedDay ? (
              <p className="text-sm text-text-muted">Select a date to view changes.</p>
            ) : selectedDayChanges.length === 0 ? (
              <p className="text-sm text-text-muted">No changes on this date.</p>
            ) : (
              <div className="space-y-4">
                {selectedDayChanges.length > 1 ? (
                  <label className="block text-sm">
                    <span className="text-text-muted">
                      {selectedDayChanges.length} changes on{" "}
                      {new Date(`${selectedDay}T12:00:00`).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <select
                      className={inputClass}
                      value={selectedChange?.id ?? ""}
                      onChange={(e) => setSelectedChangeId(e.target.value)}
                    >
                      {selectedDayChanges.map((c) => (
                        <option key={c.id} value={c.id}>
                          {new Date(c.savedAt).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          — {c.savedByName}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {selectedChange ? (
                  <div className="space-y-4">
                    <div className="text-sm text-text-secondary">
                      <p>
                        Saved at{" "}
                        {new Date(selectedChange.savedAt).toLocaleString("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      <p>Saved by {selectedChange.savedByName}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">Changes</h4>
                      {Object.keys(selectedChange.diff).length === 0 ? (
                        <p className="mt-2 text-sm text-text-muted">
                          No changes from previous snapshot.
                        </p>
                      ) : (
                        <table className="mt-2 w-full text-sm">
                          <thead>
                            <tr className="text-left text-text-muted">
                              <th className="pb-1">Field</th>
                              <th className="pb-1">Change</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(selectedChange.diff).map(([key, d]) => (
                              <tr key={key} className="border-t border-border/60">
                                <td className="py-2 text-text-secondary">
                                  {SCORING_FIELD_LABELS[key as keyof ScoringWeights]}
                                </td>
                                <td className="py-2 font-mono text-accent-text">
                                  {d!.from} → {d!.to}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">Full snapshot</h4>
                      <ul className="mt-2 space-y-1 text-sm">
                        {(Object.keys(SCORING_FIELD_LABELS) as (keyof ScoringWeights)[]).map(
                          (key) => {
                            const changed = key in (selectedChange.diff ?? {});
                            return (
                              <li
                                key={key}
                                className={changed ? "text-accent-text" : "text-text-muted"}
                              >
                                {SCORING_FIELD_LABELS[key]}: {selectedChange.weights[key]}
                              </li>
                            );
                          },
                        )}
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreSnapshot(selectedChange)}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg-raised"
                    >
                      Restore
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
