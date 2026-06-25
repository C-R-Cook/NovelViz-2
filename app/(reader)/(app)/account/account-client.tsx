"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { HelpCircle } from "lucide-react";
import { EmailChangeSection } from "@/components/account/email-change-section";
import { ageRangeToSelectValue, USER_AGE_RANGE_OPTIONS, type AgeRange } from "@/lib/age-range";
import { accountInputClass, accountLabelClass } from "@/lib/account-form-styles";
import { signOutFromApp } from "@/lib/sign-out-client";
import { COUNTRY_CODES, COUNTRY_OPTIONS } from "@/lib/countries";
import { formatGenre, GENRE_OPTIONS } from "@/lib/genre";
import { GENDER_OPTIONS, type Gender } from "@/lib/gender";
import { isValidUsernameFormat } from "@/lib/username";
import { userInitials } from "@/lib/user-initials";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const inputClass = accountInputClass;
const labelClass = accountLabelClass;

const sectionClass =
  "rounded-xl border border-border bg-bg-surface/90 p-6 shadow-sm";

const SPOILER_PROTECTION_TOOLTIP =
  "When enabled, hide gallery images and comments from chapters you have not reached yet. Books in your library can still override this per book from the gallery.";

export type AccountPageClientProps = {
  viewerId: string;
  user: {
    name: string | null;
    username: string | null;
    email: string;
    country: string | null;
    ageRange: AgeRange | null;
    gender: Gender | null;
    genrePreferences: string[];
    subscribedToMailingList: boolean;
    globalSpoilerProtection: boolean;
  };
  stats: {
    libraryBookCount: number;
    queryCount: number;
    generatedImageCount: number;
  };
  memberSinceLabel: string;
  isProduction: boolean;
  /** When true, omits page title (e.g. dashboard account tab). */
  embedded?: boolean;
};

export function AccountPageClient({
  viewerId,
  user: initialUser,
  stats,
  memberSinceLabel,
  isProduction,
  embedded = false,
}: AccountPageClientProps) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();

  const [name, setName] = useState(initialUser.name ?? "");
  const [publicUsername, setPublicUsername] = useState(initialUser.username ?? "");
  const [usernameCheck, setUsernameCheck] = useState<"idle" | "checking" | "ok" | "bad">("idle");
  const [country, setCountry] = useState(initialUser.country ?? "");
  const [ageRange, setAgeRange] = useState<string>(ageRangeToSelectValue(initialUser.ageRange));
  const [gender, setGender] = useState<string>(initialUser.gender ?? "");
  const [subscribedToMailingList, setSubscribedToMailingList] = useState(
    initialUser.subscribedToMailingList,
  );
  const [globalSpoilerProtection, setGlobalSpoilerProtection] = useState(
    initialUser.globalSpoilerProtection,
  );
  const [genrePreferences, setGenrePreferences] = useState<string[]>(initialUser.genrePreferences);

  const [profileSaving, setProfileSaving] = useState(false);
  const [aboutSaving, setAboutSaving] = useState(false);
  const [readingPrefsSaving, setReadingPrefsSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [aboutError, setAboutError] = useState<string | null>(null);
  const [readingPrefsError, setReadingPrefsError] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState(false);
  const [aboutOk, setAboutOk] = useState(false);
  const [readingPrefsOk, setReadingPrefsOk] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialUser.name ?? "");
    setPublicUsername(initialUser.username ?? "");
    setCountry(initialUser.country ?? "");
    setAgeRange(ageRangeToSelectValue(initialUser.ageRange));
    setGender(initialUser.gender ?? "");
    setSubscribedToMailingList(initialUser.subscribedToMailingList);
    setGenrePreferences(initialUser.genrePreferences);
    setUsernameCheck("idle");
  }, [initialUser]);

  const normalizedPublicUsername = publicUsername.trim().toLowerCase();
  const initialUsernameNorm = (initialUser.username ?? "").trim().toLowerCase();
  const unchangedUsername =
    normalizedPublicUsername.length > 0 &&
    normalizedPublicUsername === initialUsernameNorm;

  useEffect(() => {
    if (!normalizedPublicUsername) {
      setUsernameCheck("idle");
      return;
    }
    if (unchangedUsername) {
      setUsernameCheck("ok");
      return;
    }
    if (!isValidUsernameFormat(normalizedPublicUsername)) {
      setUsernameCheck("bad");
      return;
    }
    const t = window.setTimeout(() => {
      setUsernameCheck("checking");
      void (async () => {
        try {
          const res = await fetch(
            `/api/onboarding/check-username?username=${encodeURIComponent(normalizedPublicUsername)}&excludeUserId=${encodeURIComponent(viewerId)}`,
          );
          const data = (await res.json()) as { available?: boolean; valid?: boolean };
          if (!data.valid) {
            setUsernameCheck("bad");
            return;
          }
          setUsernameCheck(data.available ? "ok" : "bad");
        } catch {
          setUsernameCheck("idle");
        }
      })();
    }, 500);
    return () => window.clearTimeout(t);
  }, [normalizedPublicUsername, unchangedUsername, viewerId]);

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
    () => userInitials(initialUser.name ?? initialUser.username, initialUser.email),
    [initialUser.email, initialUser.name, initialUser.username],
  );

  const toggleGenre = useCallback((value: string) => {
    setGenrePreferences((prev) =>
      prev.includes(value) ? prev.filter((g) => g !== value) : [...prev, value],
    );
    setReadingPrefsOk(false);
  }, []);

  const canSaveProfile =
    isValidUsernameFormat(normalizedPublicUsername) &&
    (unchangedUsername || usernameCheck === "ok") &&
    !profileSaving;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileOk(false);
    if (!canSaveProfile) return;
    setProfileSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          username: normalizedPublicUsername,
        }),
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

  async function saveAboutYou(e: React.FormEvent) {
    e.preventDefault();
    setAboutError(null);
    setAboutOk(false);
    setAboutSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: country || null,
          ageRange: ageRange || null,
          gender: gender || null,
          subscribedToMailingList,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setAboutError(data.error ?? "Could not save details");
        return;
      }
      setAboutOk(true);
      router.refresh();
    } finally {
      setAboutSaving(false);
    }
  }

  async function saveReadingPreferences(e: React.FormEvent) {
    e.preventDefault();
    setReadingPrefsError(null);
    setReadingPrefsOk(false);
    setReadingPrefsSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          globalSpoilerProtection,
          genrePreferences,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setReadingPrefsError(data.error ?? "Could not save preferences");
        return;
      }
      setReadingPrefsOk(true);
      router.refresh();
    } finally {
      setReadingPrefsSaving(false);
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
      await signOutFromApp({
        isProduction,
        isClerkSignedIn: isSignedIn,
        clerkSignOut: signOut,
      });
    } catch {
      setDeleteError("Something went wrong");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div
      className={
        embedded
          ? "min-w-0"
          : "mx-auto max-w-5xl px-4 py-10 sm:px-6 xl:max-w-6xl"
      }
    >
      {!embedded ? (
        <>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">
            My Account
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Manage your profile and reading preferences.
          </p>
        </>
      ) : null}

      <div
        className={`grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-8${embedded ? "" : " mt-10"}`}
      >
        <section
          className={`${sectionClass} min-w-0 lg:col-span-2`}
          aria-labelledby="profile-heading"
        >
          <h2 id="profile-heading" className="text-lg font-semibold text-text-primary">
            Profile
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Your name and email are private. Your username is how you appear in the gallery and
            other public areas.
          </p>
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-accent text-2xl font-semibold text-text-inverse shadow-inner"
              aria-hidden
            >
              {avatarInitials}
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <form className="space-y-4" onSubmit={(e) => void saveProfile(e)}>
                <div>
                  <label htmlFor="account-username" className={labelClass}>
                    Username
                  </label>
                <div className="relative mt-1">
                  <input
                    id="account-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    className={`${inputClass} pr-10`}
                    value={publicUsername}
                    onChange={(e) => {
                      setPublicUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""));
                      setProfileOk(false);
                    }}
                    maxLength={20}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-sm">
                    {usernameCheck === "checking" ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-accent" />
                    ) : usernameCheck === "ok" ? (
                      <span className="text-success">✓</span>
                    ) : usernameCheck === "bad" && normalizedPublicUsername.length > 0 ? (
                      <span className="text-error">✕</span>
                    ) : null}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  3–20 characters: letters, numbers, and underscores only.
                </p>
              </div>
              <div>
                <label htmlFor="account-name" className={labelClass}>
                  Full name
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
              {profileError ? (
                <p className="text-sm text-error" role="alert">
                  {profileError}
                </p>
              ) : null}
              {profileOk ? (
                <p className="text-sm text-success">Profile saved.</p>
              ) : null}
              <button
                type="submit"
                disabled={!canSaveProfile}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text-inverse shadow transition hover:bg-accent disabled:opacity-60"
              >
                {profileSaving ? "Saving…" : "Save profile"}
              </button>
              </form>
              <EmailChangeSection fallbackEmail={initialUser.email} />
            </div>
          </div>
        </section>

        <section className={`${sectionClass} min-w-0`} aria-labelledby="about-you-heading">
          <h2 id="about-you-heading" className="text-lg font-semibold text-text-primary">
            About you
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Optional — helps us tailor book picks and featured titles to you.
          </p>
          <form className="mt-6 space-y-4" onSubmit={(e) => void saveAboutYou(e)}>
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
                  setAboutOk(false);
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
                  setAboutOk(false);
                }}
              >
                {USER_AGE_RANGE_OPTIONS.map((o) => (
                  <option key={o.value || "prefer-not-to-say"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="account-gender" className={labelClass}>
                Gender
              </label>
              <select
                id="account-gender"
                className={inputClass}
                value={gender}
                onChange={(e) => {
                  setGender(e.target.value);
                  setAboutOk(false);
                }}
              >
                <option value="">Prefer not to say</option>
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={subscribedToMailingList}
                onChange={(e) => {
                  setSubscribedToMailingList(e.target.checked);
                  setAboutOk(false);
                }}
                className="mt-1 h-4 w-4 rounded border-border text-accent-text focus:ring-accent/30"
              />
              <span className="text-sm text-text-primary">
                Keep me updated about new books, features and early access offers
              </span>
            </label>
            {aboutError ? (
              <p className="text-sm text-error" role="alert">
                {aboutError}
              </p>
            ) : null}
            {aboutOk ? (
              <p className="text-sm text-success">Details saved.</p>
            ) : null}
            <button
              type="submit"
              disabled={aboutSaving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text-inverse shadow transition hover:bg-accent disabled:opacity-60"
            >
              {aboutSaving ? "Saving…" : "Save details"}
            </button>
          </form>
        </section>

        <section className={`${sectionClass} min-w-0`} aria-labelledby="prefs-heading">
          <h2 id="prefs-heading" className="text-lg font-semibold text-text-primary">
            Reading preferences
          </h2>
          <form className="mt-6 space-y-6" onSubmit={(e) => void saveReadingPreferences(e)}>
            <div>
              <span className={labelClass}>Genre preferences</span>
              <p className="mt-1 text-xs text-text-muted">Select all that apply.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {GENRE_OPTIONS.map(({ value }) => {
                  const selected = genrePreferences.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleGenre(value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:text-sm ${
                        selected
                          ? "border-accent bg-accent text-text-inverse"
                          : "border-border bg-bg-raised text-text-secondary hover:border-border hover:text-text-primary"
                      }`}
                      aria-pressed={selected}
                    >
                      {formatGenre(value)}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={globalSpoilerProtection}
                onChange={(e) => {
                  setGlobalSpoilerProtection(e.target.checked);
                  setReadingPrefsOk(false);
                }}
                className="h-4 w-4 rounded border-border text-accent-text focus:ring-accent/30"
              />
              <span className="flex items-center gap-1.5 text-sm text-text-primary">
                <span className="font-medium">Public gallery spoiler protection</span>
                <span
                  className="inline-flex text-text-muted"
                  title={SPOILER_PROTECTION_TOOLTIP}
                  aria-label={SPOILER_PROTECTION_TOOLTIP}
                >
                  <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </span>
              </span>
            </label>
            {readingPrefsError ? (
              <p className="text-sm text-error" role="alert">
                {readingPrefsError}
              </p>
            ) : null}
            {readingPrefsOk ? (
              <p className="text-sm text-success">Preferences saved.</p>
            ) : null}
            <button
              type="submit"
              disabled={readingPrefsSaving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text-inverse shadow transition hover:bg-accent disabled:opacity-60"
            >
              {readingPrefsSaving ? "Saving…" : "Save preferences"}
            </button>
          </form>
        </section>

        <section className={`${sectionClass} lg:col-span-2`} aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="text-lg font-semibold text-text-primary">
            Reading stats
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
            <div className="rounded-lg border border-border/80 bg-bg-base/80 px-4 py-3">
              <dt className="text-text-muted">Member since</dt>
              <dd className="mt-1 font-medium text-text-primary">{memberSinceLabel}</dd>
            </div>
            <div className="rounded-lg border border-border/80 bg-bg-base/80 px-4 py-3">
              <dt className="text-text-muted">Books in library</dt>
              <dd className="mt-1 font-medium text-text-primary">{stats.libraryBookCount}</dd>
            </div>
            <div className="rounded-lg border border-border/80 bg-bg-base/80 px-4 py-3">
              <dt className="text-text-muted">Questions asked</dt>
              <dd className="mt-1 font-medium text-text-primary">{stats.queryCount}</dd>
            </div>
            <div className="rounded-lg border border-border/80 bg-bg-base/80 px-4 py-3">
              <dt className="text-text-muted">Images generated</dt>
              <dd className="mt-1 font-medium text-text-primary">{stats.generatedImageCount}</dd>
            </div>
          </dl>
        </section>

        <section
          className={`${sectionClass} border-error/30 lg:col-span-2`}
          aria-labelledby="danger-heading"
        >
          <h2 id="danger-heading" className="text-lg font-semibold text-error">
            Danger zone
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Permanently delete your NovelViz account and associated reading data.
          </p>
          <button
            type="button"
            className="mt-4 rounded-md border border-error/40 bg-transparent px-4 py-2 text-sm font-medium text-error transition hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/30"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => (deletePending ? null : setDeleteOpen(false))}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="max-w-md rounded-xl border border-border bg-bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-dialog-title" className="text-lg font-semibold text-text-primary">
              Delete account?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              Are you sure? This will permanently delete your account and all your data. This cannot be undone.
            </p>
            {deleteError ? (
              <p className="mt-3 text-sm text-error" role="alert">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-base"
                disabled={deletePending}
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-error px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-error/100 disabled:opacity-60"
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
