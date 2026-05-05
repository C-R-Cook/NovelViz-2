"use client";

import { ONBOARDING_AGE_RANGE_OPTIONS } from "@/lib/age-range";
import { GENDER_OPTIONS } from "@/lib/gender";
import { isValidUsernameFormat } from "@/lib/username";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type CheckState = "idle" | "checking" | "available" | "taken" | "invalid";

export function OnboardingClient() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [ageRange, setAgeRange] = useState("");
  const [gender, setGender] = useState("");
  const [subscribedToMailingList, setSubscribedToMailingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

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
  }, [normalized, runCheck]);

  const canSubmit = formatOk && checkState === "available" && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitErr(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalized,
          ageRange: ageRange || null,
          gender: gender || null,
          subscribedToMailingList,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean };
      if (!res.ok) {
        setSubmitErr(data.error ?? "Something went wrong");
        if (res.status === 409) setCheckState("taken");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-bg-base px-4 py-12 text-text-primary sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <header className="text-center">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            Welcome to NovelViz
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">
            Before you start, let&apos;s set up your profile
          </p>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-text-muted">Step 1 of 1</p>
        </header>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="mt-10 space-y-8 rounded-2xl border border-border bg-bg-base/60 p-6 shadow-xl shadow-bg-overlay/40 backdrop-blur-sm sm:p-8"
        >
          <div>
            <label htmlFor="onb-username" className="block text-sm font-medium text-text-primary">
              Choose a username <span className="text-accent-text">*</span>
            </label>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              This is how you&apos;ll appear publicly in the gallery. 3–20 characters, letters, numbers and
              underscores only.
            </p>
            <div className="relative mt-2">
              <input
                id="onb-username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                className="w-full rounded-lg border border-border bg-bg-surface/80 px-3 py-2.5 pr-10 text-sm text-text-primary outline-none ring-accent/0 transition placeholder:text-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
                placeholder="novel_reader"
                maxLength={20}
                aria-invalid={checkState === "invalid" || checkState === "taken"}
              />
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
            </div>
            {checkState === "taken" ? (
              <p className="mt-1.5 text-xs text-error/90">That username is already taken.</p>
            ) : null}
            {checkState === "invalid" && normalized.length > 0 ? (
              <p className="mt-1.5 text-xs text-error/90">Use 3–20 characters: letters, numbers, underscores only.</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="onb-age" className="block text-sm font-medium text-text-primary">
              How old are you? (optional)
            </label>
            <select
              id="onb-age"
              name="ageRange"
              value={ageRange}
              onChange={(e) => setAgeRange(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-bg-surface/80 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
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
            <label htmlFor="onb-gender" className="block text-sm font-medium text-text-primary">
              Gender (optional)
            </label>
            <select
              id="onb-gender"
              name="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-bg-surface/80 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
            >
              <option value="">Prefer not to say</option>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-bg-surface/40 p-3">
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
            <p className="text-sm text-error" role="alert">
              {submitErr}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-text-inverse shadow-lg shadow-bg-overlay/20 transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Get Started"}
          </button>
        </form>
      </div>
    </div>
  );
}
