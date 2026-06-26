"use client";

import { UsernameField } from "@/components/auth/username-field";
import { clearPlanStepCompleteCookie } from "@/lib/onboarding-cookies";
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from "@/lib/display-name";
import { formatGenre, GENRE_OPTIONS } from "@/lib/genre";
import { GENDERS, USER_AGE_RANGE_OPTIONS } from "@/lib/user-profile-options";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import "./preferences.css";

countries.registerLocale(enLocale);

type Props = {
  initialName: string;
  showUsernameField: boolean;
  previewMode?: boolean;
};

const COUNTRY_OPTIONS = Object.entries(countries.getNames("en", { select: "official" }))
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function PreferencesClient({
  initialName,
  showUsernameField,
  previewMode = false,
}: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialName);
  const [username, setUsername] = useState("");
  const [usernameReady, setUsernameReady] = useState(!showUsernameField);
  const [normalizedUsername, setNormalizedUsername] = useState("");
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

  const handleUsernameAvailability = useCallback(
    (state: { ready: boolean; normalized: string }) => {
      setUsernameReady(state.ready);
      setNormalizedUsername(state.normalized);
    },
    [],
  );

  const toggleGenre = (value: string) => {
    setGenreError(null);
    setGenrePreferences((prev) =>
      prev.includes(value) ? prev.filter((g) => g !== value) : [...prev, value],
    );
  };

  const canSubmit =
    nameOk && usernameReady && genrePreferences.length > 0 && !submitting;

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
          ...(showUsernameField ? { username: normalizedUsername } : {}),
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

      <form onSubmit={(e) => void onSubmit(e)} className="onboarding-preferences__form">
        <div>
          <label htmlFor="onb-full-name" className="onboarding-preferences__label">
            Your full name <span className="text-accent-text">*</span>
          </label>
          <p className="onboarding-preferences__hint">
            Your real name for account and partnership enquiries. This is private and never shown to
            other users on NovelViz.
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

        {showUsernameField ? (
          <UsernameField
            id="onb-username"
            value={username}
            onChange={setUsername}
            inputClassName="onboarding-preferences__input pr-10"
            hintClassName="onboarding-preferences__hint"
            onAvailabilityChange={handleUsernameAvailability}
          />
        ) : null}

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
            {USER_AGE_RANGE_OPTIONS.map((o) => (
              <option key={o.value || "prefer-not-to-say"} value={o.value}>
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
