"use client";

import {
  allLegalConsentChecksComplete,
  SignUpLegalConsentFields,
  type LegalConsentChecks,
} from "@/components/auth/sign-up-legal-consent";
import { useSignUp } from "@clerk/nextjs/legacy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "./register-with-consent.css";

type Step = "form" | "verify";

const initialChecks: LegalConsentChecks = {
  over18Confirmed: false,
  termsAccepted: false,
  privacyAccepted: false,
};

const inputClass =
  "mt-1 w-full rounded-md border border-border-default bg-bg-elevated/80 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

function clerkErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "errors" in err) {
    const errors = (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    if (errors?.[0]?.longMessage) return errors[0].longMessage;
    if (errors?.[0]?.message) return errors[0].message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

async function waitForSessionReady(): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch("/api/auth/session-ready", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { ready?: boolean; redirectTo?: string };
      if (data.ready && data.redirectTo) return data.redirectTo;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(500 + attempt * 100, 2000)));
  }
  return "/onboarding/plan";
}

export function CustomEmailSignUp() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();

  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [checks, setChecks] = useState<LegalConsentChecks>(initialChecks);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmitForm =
    isLoaded &&
    isValidEmail(email) &&
    isValidPassword(password) &&
    allLegalConsentChecksComplete(checks) &&
    !busy;

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp || !canSubmitForm) return;

    setError(null);
    setBusy(true);
    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err: unknown) {
      setError(clerkErrorMessage(err, "Could not create account. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp || !setActive || !code.trim()) return;

    setError(null);
    setBusy(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status !== "complete") {
        setError("Verification incomplete. Please check the code and try again.");
        return;
      }

      await setActive({ session: result.createdSessionId });

      const consentRes = await fetch("/api/legal-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checks),
      });
      if (!consentRes.ok) {
        const body = (await consentRes.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not save your agreements.");
        return;
      }

      const redirectTo = await waitForSessionReady();
      router.replace(redirectTo);
      router.refresh();
    } catch (err: unknown) {
      setError(clerkErrorMessage(err, "Verification failed. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="register-flow">
      <header className="register-flow__header">
        <p className="register-flow__eyebrow">NovelViz</p>
        <h1 className="register-flow__title">Create account</h1>
        <p className="register-flow__lede">
          A spoiler-safe AI reading companion for readers aged 18 and over.
        </p>
      </header>

      <div className="register-flow__panel">
        {step === "form" ? (
          <form onSubmit={(e) => void handleCreateAccount(e)} className="space-y-4">
            <label className="block text-sm">
              <span className="text-text-secondary">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                className={inputClass}
                placeholder="you@example.com"
              />
            </label>

            <label className="block text-sm">
              <span className="text-text-secondary">Password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                className={inputClass}
                placeholder="At least 8 characters"
              />
            </label>

            <SignUpLegalConsentFields
              variant="integrated"
              value={checks}
              onChange={setChecks}
              disabled={busy}
            />

            {error ? (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmitForm}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-text-on-accent transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void handleVerify(e)} className="space-y-4">
            <p className="text-sm text-text-secondary">
              We sent a verification code to{" "}
              <span className="font-medium text-text-primary">{email.trim()}</span>.
            </p>

            <label className="block text-sm">
              <span className="text-text-secondary">Verification code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={busy}
                className={inputClass}
                placeholder="Enter code from email"
              />
            </label>

            {error ? (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-text-on-accent transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify and continue"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStep("form");
                setCode("");
                setError(null);
              }}
              className="w-full text-sm text-text-muted hover:text-text-primary disabled:opacity-50"
            >
              Use a different email
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent-text hover:text-text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
