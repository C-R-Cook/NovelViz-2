"use client";

import {
  AUTH_SSO_CALLBACK_PATH,
  AUTH_SSO_COMPLETE_PATH,
  authInputClass,
  clerkErrorMessage,
  isValidEmail,
  waitForSessionReady,
} from "@/components/auth/auth-form-utils";
import { AuthOAuthDivider, GoogleOAuthButton } from "@/components/auth/google-oauth-button";
import { PasswordInput } from "@/components/auth/password-input";
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

function isValidPassword(password: string): boolean {
  return password.length >= 8;
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
  const [oauthBusy, setOauthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consentComplete = allLegalConsentChecksComplete(checks);
  const canSubmitForm =
    isLoaded &&
    isValidEmail(email) &&
    isValidPassword(password) &&
    consentComplete &&
    !busy &&
    !oauthBusy;

  async function handleGoogleSignUp() {
    if (!isLoaded || !signUp || !consentComplete || oauthBusy || busy) return;

    setError(null);
    setOauthBusy(true);
    try {
      const intentRes = await fetch("/api/legal-consent-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checks),
      });
      if (!intentRes.ok) {
        const body = (await intentRes.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not save your agreements. Please try again.");
        return;
      }

      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: AUTH_SSO_CALLBACK_PATH,
        redirectUrlComplete: AUTH_SSO_COMPLETE_PATH,
      });
    } catch (err: unknown) {
      setError(clerkErrorMessage(err, "Could not continue with Google. Please try again."));
      setOauthBusy(false);
    }
  }

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

      const redirectTo = await waitForSessionReady("/onboarding/plan");
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
          <>
            <GoogleOAuthButton
              label="Continue with Google"
              busy={oauthBusy}
              disabled={!isLoaded || !consentComplete}
              onClick={() => void handleGoogleSignUp()}
            />
            {!consentComplete ? (
              <p className="mt-2 text-center text-xs text-text-muted">
                Accept the agreements below to use Google sign-up.
              </p>
            ) : null}

            <AuthOAuthDivider />

            <form onSubmit={(e) => void handleCreateAccount(e)} className="space-y-4">
              <label className="block text-sm">
                <span className="text-text-secondary">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy || oauthBusy}
                  className={authInputClass}
                  placeholder="you@example.com"
                />
              </label>

              <label className="block text-sm">
                <span className="text-text-secondary">Password</span>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  disabled={busy || oauthBusy}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </label>

              <SignUpLegalConsentFields
                variant="integrated"
                value={checks}
                onChange={setChecks}
                disabled={busy || oauthBusy}
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
          </>
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
                className={authInputClass}
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
