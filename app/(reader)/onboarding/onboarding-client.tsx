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
    <div className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-12 text-zinc-100 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <header className="text-center">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Welcome to NovelViz
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Before you start, let&apos;s set up your profile
          </p>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-zinc-600">Step 1 of 1</p>
        </header>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="mt-10 space-y-8 rounded-2xl border border-zinc-800/90 bg-zinc-950/60 p-6 shadow-xl shadow-black/40 backdrop-blur-sm sm:p-8"
        >
          <div>
            <label htmlFor="onb-username" className="block text-sm font-medium text-zinc-200">
              Choose a username <span className="text-amber-400">*</span>
            </label>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
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
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 pr-10 text-sm text-zinc-100 outline-none ring-amber-500/0 transition placeholder:text-zinc-600 focus:border-amber-600/50 focus:ring-2 focus:ring-amber-500/25"
                placeholder="novel_reader"
                maxLength={20}
                aria-invalid={checkState === "invalid" || checkState === "taken"}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-lg leading-none">
                {checkState === "checking" ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-400" />
                ) : checkState === "available" ? (
                  <span className="text-emerald-400" aria-label="Available">
                    ✓
                  </span>
                ) : checkState === "taken" ? (
                  <span className="text-red-400" aria-label="Taken">
                    ✕
                  </span>
                ) : checkState === "invalid" ? (
                  <span className="text-red-400/80" aria-label="Invalid">
                    ✕
                  </span>
                ) : (
                  <span className="text-zinc-600" aria-hidden>
                    ·
                  </span>
                )}
              </span>
            </div>
            {checkState === "taken" ? (
              <p className="mt-1.5 text-xs text-red-400/90">That username is already taken.</p>
            ) : null}
            {checkState === "invalid" && normalized.length > 0 ? (
              <p className="mt-1.5 text-xs text-red-400/90">Use 3–20 characters: letters, numbers, underscores only.</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="onb-age" className="block text-sm font-medium text-zinc-200">
              How old are you? (optional)
            </label>
            <select
              id="onb-age"
              name="ageRange"
              value={ageRange}
              onChange={(e) => setAgeRange(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-500/25"
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
            <label htmlFor="onb-gender" className="block text-sm font-medium text-zinc-200">
              Gender (optional)
            </label>
            <select
              id="onb-gender"
              name="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-500/25"
            >
              <option value="">Prefer not to say</option>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3">
            <input
              type="checkbox"
              checked={subscribedToMailingList}
              onChange={(e) => setSubscribedToMailingList(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-600 text-amber-600 focus:ring-amber-500/40"
            />
            <span className="text-sm leading-snug text-zinc-300">
              Keep me updated about new books, features and early access offers
            </span>
          </label>

          {submitErr ? (
            <p className="text-sm text-red-400" role="alert">
              {submitErr}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-900/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Get Started"}
          </button>
        </form>
      </div>
    </div>
  );
}
