"use client";

import { useClerk } from "@clerk/nextjs";
import { AGE_RANGE_OPTIONS, type AgeRange } from "@/lib/age-range";
import { DEV_USER_COOKIE } from "@/lib/dev-users";
import { COUNTRY_CODES, COUNTRY_OPTIONS } from "@/lib/countries";
import { formatGenre, GENRE_OPTIONS } from "@/lib/genre";
import { userInitials } from "@/lib/user-initials";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-amber-500/80 focus:ring-2 focus:ring-amber-500/25 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-100 dark:focus:border-amber-400/70";

const labelClass = "block text-sm font-medium text-zinc-800 dark:text-zinc-200";

const sectionClass =
  "rounded-xl border border-zinc-200/90 bg-white/90 p-6 shadow-sm dark:border-zinc-800/90 dark:bg-zinc-900/40";

export type AccountPageClientProps = {
  user: {
    name: string | null;
    email: string;
    country: string | null;
    ageRange: AgeRange | null;
    genrePreferences: string[];
  };
  stats: {
    libraryBookCount: number;
    queryCount: number;
    generatedImageCount: number;
  };
  memberSinceLabel: string;
  isProduction: boolean;
};

export function AccountPageClient({
  user: initialUser,
  stats,
  memberSinceLabel,
  isProduction,
}: AccountPageClientProps) {
  const router = useRouter();
  const { signOut } = useClerk();

  const [name, setName] = useState(initialUser.name ?? "");
  const [country, setCountry] = useState(initialUser.country ?? "");
  const [ageRange, setAgeRange] = useState<string>(initialUser.ageRange ?? "");
  const [genrePreferences, setGenrePreferences] = useState<string[]>(initialUser.genrePreferences);

  const [profileSaving, setProfileSaving] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState(false);
  const [prefsOk, setPrefsOk] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const countrySelectOptions = useMemo(() => {
    const base = [...COUNTRY_OPTIONS];
    if (initialUser.country && !COUNTRY_CODES.has(initialUser.country)) {
      base.unshift({
        value: initialUser.country,
        label: `${initialUser.country} (saved)`,
      });
    }
    return base;
  }, [initialUser.country]);

  const avatarInitials = useMemo(
    () => userInitials(initialUser.name, initialUser.email),
    [initialUser.email, initialUser.name],
  );

  const toggleGenre = useCallback((value: string) => {
    setGenrePreferences((prev) =>
      prev.includes(value) ? prev.filter((g) => g !== value) : [...prev, value],
    );
    setPrefsOk(false);
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileOk(false);
    setProfileSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setProfileError(data.error ?? "Could not save profile");
        return;
      }
      setProfileOk(true);
      router.refresh();
    } finally {
      setProfileSaving(false);
    }
  }

  async function savePreferences(e: React.FormEvent) {
    e.preventDefault();
    setPrefsError(null);
    setPrefsOk(false);
    setPrefsSaving(true);
    try {
      const body = {
        country: country || null,
        ageRange: ageRange || null,
        genrePreferences,
      };
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPrefsError(data.error ?? "Could not save preferences");
        return;
      }
      setPrefsOk(true);
      router.refresh();
    } finally {
      setPrefsSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleteError(null);
    setDeletePending(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        setDeleteError(data.error ?? "Could not delete account");
        return;
      }
      setDeleteOpen(false);
      if (isProduction) {
        await signOut({ redirectUrl: "/" });
        return;
      }
      document.cookie = `${DEV_USER_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
      router.push("/");
      router.refresh();
    } catch {
      setDeleteError("Something went wrong");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        My Account
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Manage your profile and reading preferences.
      </p>

      <div className="mt-10 space-y-8">
        <section className={sectionClass} aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Profile
          </h2>
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-amber-400 text-2xl font-semibold text-zinc-950 shadow-inner dark:bg-amber-500 dark:text-zinc-950"
              aria-hidden
            >
              {avatarInitials}
            </div>
            <form className="min-w-0 flex-1 space-y-4" onSubmit={saveProfile}>
              <div>
                <label htmlFor="account-name" className={labelClass}>
                  Name
                </label>
                <input
                  id="account-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  className={inputClass}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setProfileOk(false);
                  }}
                />
              </div>
              <div>
                <span className={labelClass}>Email</span>
                <p className="mt-1 rounded-md border border-zinc-200/90 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-300">
                  {initialUser.email}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                  Email is managed by Clerk and cannot be changed here.
                </p>
              </div>
              {profileError ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {profileError}
                </p>
              ) : null}
              {profileOk ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-400/90">Profile saved.</p>
              ) : null}
              <button
                type="submit"
                disabled={profileSaving}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 shadow transition hover:bg-amber-500 disabled:opacity-60 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
              >
                {profileSaving ? "Saving…" : "Save profile"}
              </button>
            </form>
          </div>
        </section>

        <section className={sectionClass} aria-labelledby="prefs-heading">
          <h2 id="prefs-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Reading preferences
          </h2>
          <form className="mt-6 space-y-6" onSubmit={savePreferences}>
            <div>
              <label htmlFor="account-country" className={labelClass}>
                Country
              </label>
              <select
                id="account-country"
                className={inputClass}
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setPrefsOk(false);
                }}
              >
                <option value="">Prefer not to say</option>
                {countrySelectOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="account-age" className={labelClass}>
                Age range
              </label>
              <select
                id="account-age"
                className={inputClass}
                value={ageRange}
                onChange={(e) => {
                  setAgeRange(e.target.value);
                  setPrefsOk(false);
                }}
              >
                <option value="">Prefer not to say</option>
                {AGE_RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className={labelClass}>Genre preferences</span>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Select all that apply.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {GENRE_OPTIONS.map(({ value }) => {
                  const selected = genrePreferences.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleGenre(value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 sm:text-sm ${
                        selected
                          ? "border-amber-500/80 bg-amber-400/25 text-amber-950 dark:border-amber-400/60 dark:bg-amber-500/20 dark:text-amber-100"
                          : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:border-zinc-500"
                      }`}
                      aria-pressed={selected}
                    >
                      {formatGenre(value)}
                    </button>
                  );
                })}
              </div>
            </div>
            {prefsError ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {prefsError}
              </p>
            ) : null}
            {prefsOk ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400/90">Preferences saved.</p>
            ) : null}
            <button
              type="submit"
              disabled={prefsSaving}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 shadow transition hover:bg-amber-500 disabled:opacity-60 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
            >
              {prefsSaving ? "Saving…" : "Save preferences"}
            </button>
          </form>
        </section>

        <section className={sectionClass} aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Reading stats
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <dt className="text-zinc-500 dark:text-zinc-400">Member since</dt>
              <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{memberSinceLabel}</dd>
            </div>
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <dt className="text-zinc-500 dark:text-zinc-400">Books in library</dt>
              <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{stats.libraryBookCount}</dd>
            </div>
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <dt className="text-zinc-500 dark:text-zinc-400">Questions asked</dt>
              <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{stats.queryCount}</dd>
            </div>
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <dt className="text-zinc-500 dark:text-zinc-400">Images generated</dt>
              <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{stats.generatedImageCount}</dd>
            </div>
          </dl>
        </section>

        <section
          className={`${sectionClass} border-red-200/90 dark:border-red-900/50`}
          aria-labelledby="danger-heading"
        >
          <h2 id="danger-heading" className="text-lg font-semibold text-red-800 dark:text-red-300">
            Danger zone
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Permanently delete your NovelViz account and associated reading data.
          </p>
          <button
            type="button"
            className="mt-4 rounded-md border border-red-600/90 bg-transparent px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 dark:border-red-500/80 dark:text-red-300 dark:hover:bg-red-950/40"
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            Delete account
          </button>
        </section>
      </div>

      {deleteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => (deletePending ? null : setDeleteOpen(false))}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-dialog-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Delete account?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Are you sure? This will permanently delete your account and all your data. This cannot be undone.
            </p>
            {deleteError ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
                disabled={deletePending}
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-60"
                disabled={deletePending}
                onClick={() => void confirmDelete()}
              >
                {deletePending ? "Deleting…" : "Delete my account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
