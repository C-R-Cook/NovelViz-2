"use client";

import { clearPlanStepCompleteCookie } from "@/lib/onboarding-cookies";
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from "@/lib/display-name";
import { formatGenre, GENRE_OPTIONS } from "@/lib/genre";
import { GENDERS, ONBOARDING_AGE_RANGE_OPTIONS } from "@/lib/user-profile-options";
import { isValidUsernameFormat } from "@/lib/username";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./preferences.css";

countries.registerLocale(enLocale);

type CheckState = "idle" | "checking" | "available" | "taken" | "invalid";

type Props = {
  initialName: string;
  initialUsername: string;
  legacyGenresOnly: boolean;
  previewMode?: boolean;
};

const COUNTRY_OPTIONS = Object.entries(countries.getNames("en", { select: "official" }))
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function PreferencesClient({
  initialName,
  initialUsername,
  legacyGenresOnly,
  previewMode = false,
}: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [checkState, setCheckState] = useState<CheckState>(
    legacyGenresOnly ? "available" : "idle",
  );
  const [genrePreferences, setGenrePreferences] = useState<string[]>([]);
  const [genreError, setGenreError] = useState<string | null>(null);
  const [ageRange, setAgeRange] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");
  const [subscribedToMailingList, setSubscribedToMailingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const trimmedName = fullName.trim().replace(/\s+/g, " ");
  const nameOk =
    trimmedName.length >= DISPLAY_NAME_MIN && trimmedName.length <= DISPLAY_NAME_MAX;

  const trimmed = username.trim();
  const normalized = trimmed.toLowerCase();
  const formatOk = useMemo(
    () => normalized.length > 0 && isValidUsernameFormat(normalized),
    [normalized],
  );

  const runCheck = useCallback(async (value: string) => {
    if (!isValidUsernameFormat(value)) {
      setCheckState("invalid");
      return;
    }
    setCheckState("checking");
    try {
      const res = await fetch(
        `/api/onboarding/check-username?username=${encodeURIComponent(value)}`,
      );
      const data = (await res.json()) as { available?: boolean; valid?: boolean };
      if (!data.valid) {
        setCheckState("invalid");
        return;
      }
      setCheckState(data.available ? "available" : "taken");
    } catch {
      setCheckState("idle");
    }
  }, []);

  useEffect(() => {
    if (legacyGenresOnly) return;
    if (!normalized) {
      setCheckState("idle");
      return;
    }
    if (!isValidUsernameFormat(normalized)) {
      setCheckState("invalid");
      return;
    }
    const t = window.setTimeout(() => {
      void runCheck(normalized);
    }, 500);
    return () => window.clearTimeout(t);
  }, [normalized, runCheck, legacyGenresOnly]);

  const toggleGenre = (value: string) => {
    setGenreError(null);
    setGenrePreferences((prev) =>
      prev.includes(value) ? prev.filter((g) => g !== value) : [...prev, value],
    );
  };

  const canSubmit =
    nameOk &&
    formatOk &&
    (legacyGenresOnly || checkState === "available") &&
    genrePreferences.length > 0 &&
    !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (genrePreferences.length === 0) {
      setGenreError(
        "Please select at least one genre so we can personalise your experience.",
      );
      return;
    }
    if (!canSubmit) return;
    if (previewMode) return;
    setSubmitErr(null);
    setGenreError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          username: normalized,
          genrePreferences,
          ageRange: ageRange || null,
          gender: gender || null,
          country: country || null,
          subscribedToMailingList,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean };
      if (!res.ok) {
        setSubmitErr(data.error ?? "Something went wrong");
        if (res.status === 409) setCheckState("taken");
        return;
      }
      clearPlanStepCompleteCookie();
      router.push("/library");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="onboarding-preferences px-4">
      <header className="onboarding-preferences__header">
        <h1 className="onboarding-preferences__headline">Setup your Profile</h1>
      </header>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="onboarding-preferences__form"
      >
        <div>
          <label htmlFor="onb-full-name" className="onboarding-preferences__label">
            Your full name <span className="text-accent-text">*</span>
          </label>
          <p className="onboarding-preferences__hint">
            Your real name for account and partnership enquiries. This is private and not shown in the
            gallery.
          </p>
          <input
            id="onb-full-name"
            name="name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="onboarding-preferences__input mt-2"
            placeholder="Jane Smith"
            maxLength={DISPLAY_NAME_MAX}
            required
            aria-invalid={fullName.trim().length > 0 && !nameOk}
          />
          {fullName.trim().length > 0 && !nameOk ? (
            <p className="mt-1.5 text-xs text-error/90">
              Enter {DISPLAY_NAME_MIN}–{DISPLAY_NAME_MAX} characters.
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="onb-username" className="onboarding-preferences__label">
            Choose a username <span className="text-accent-text">*</span>
          </label>
          <p className="onboarding-preferences__hint">
            This is how you&apos;ll appear publicly in the gallery. 3–20 characters, letters,
            numbers and underscores only.
          </p>
          <div className="relative mt-2">
            <input
              id="onb-username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              readOnly={legacyGenresOnly}
              className="onboarding-preferences__input pr-10"
              placeholder="novel_reader"
              maxLength={20}
              aria-invalid={checkState === "invalid" || checkState === "taken"}
            />
            {!legacyGenresOnly ? (
              <span className="pointer-events-none absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-lg leading-none">
                {checkState === "checking" ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-accent" />
                ) : checkState === "available" ? (
                  <span className="text-success" aria-label="Available">
                    ✓
                  </span>
                ) : checkState === "taken" ? (
                  <span className="text-error" aria-label="Taken">
                    ✕
                  </span>
                ) : checkState === "invalid" ? (
                  <span className="text-error/80" aria-label="Invalid">
                    ✕
                  </span>
                ) : (
                  <span className="text-text-muted" aria-hidden>
                    ·
                  </span>
                )}
              </span>
            ) : null}
          </div>
          {checkState === "taken" ? (
            <p className="mt-1.5 text-xs text-error/90">That username is already taken.</p>
          ) : null}
          {checkState === "invalid" && normalized.length > 0 ? (
            <p className="mt-1.5 text-xs text-error/90">
              Use 3–20 characters: letters, numbers, underscores only.
            </p>
          ) : null}
        </div>

        <div>
          <span className="onboarding-preferences__label">
            What do you like to read? <span className="text-accent-text">*</span>
          </span>
          <p className="onboarding-preferences__hint">Select all that apply.</p>
          <div className="onboarding-preferences__genres" role="group" aria-label="Genre preferences">
            {GENRE_OPTIONS.map(({ value }) => {
              const selected = genrePreferences.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleGenre(value)}
                  className={`onboarding-preferences__genre-pill ${
                    selected ? "onboarding-preferences__genre-pill--active" : ""
                  }`}
                  aria-pressed={selected}
                >
                  {formatGenre(value)}
                </button>
              );
            })}
          </div>
          {genreError ? (
            <p className="mt-2 text-xs text-error/90" role="alert">
              {genreError}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="onb-gender" className="onboarding-preferences__label">
            Gender (optional)
          </label>
          <select
            id="onb-gender"
            name="gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="onboarding-preferences__input"
          >
            <option value="">Prefer not to say</option>
            {GENDERS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="onb-age" className="onboarding-preferences__label">
            How old are you? (optional)
          </label>
          <select
            id="onb-age"
            name="ageRange"
            value={ageRange}
            onChange={(e) => setAgeRange(e.target.value)}
            className="onboarding-preferences__input"
          >
            <option value="">Prefer not to say</option>
            {ONBOARDING_AGE_RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="onb-country" className="onboarding-preferences__label">
            Country (optional)
          </label>
          <select
            id="onb-country"
            name="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="onboarding-preferences__input"
          >
            <option value="">Prefer not to say</option>
            {COUNTRY_OPTIONS.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <label className="onboarding-preferences__checkbox">
          <input
            type="checkbox"
            checked={subscribedToMailingList}
            onChange={(e) => setSubscribedToMailingList(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border text-accent-text focus:ring-accent/40"
          />
          <span className="text-sm leading-snug text-text-secondary">
            Keep me updated about new books, features and early access offers
          </span>
        </label>

        {submitErr ? (
          <p className="onboarding-preferences__error" role="alert">
            {submitErr}
          </p>
        ) : null}

        <button type="submit" disabled={!canSubmit} className="onboarding-preferences__submit">
          {submitting ? "Saving…" : "Get Started"}
        </button>
        {previewMode ? (
          <p className="text-center text-xs text-text-muted">
            Preview — use the toolbar above to continue; form won&apos;t save.
          </p>
        ) : null}
      </form>
    </div>
  );
}
