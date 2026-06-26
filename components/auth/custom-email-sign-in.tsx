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
import { useSignIn } from "@clerk/nextjs/legacy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "./register-with-consent.css";

type Step = "form" | "second_factor" | "forgot_email" | "forgot_code" | "forgot_password";

export function CustomEmailSignIn() {
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmitForm =
    isLoaded && isValidEmail(email) && password.length >= 1 && !busy && !oauthBusy;

  async function finishSignIn(sessionId: string | null | undefined) {
    if (!sessionId || !setActive) {
      setError("Sign-in could not be completed. Please try again.");
      return;
    }

    await setActive({ session: sessionId });
    const redirectTo = await waitForSessionReady();
    router.replace(redirectTo);
    router.refresh();
  }

  async function handleGoogleSignIn() {
    if (!isLoaded || !signIn || oauthBusy || busy) return;

    setError(null);
    setOauthBusy(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: AUTH_SSO_CALLBACK_PATH,
        redirectUrlComplete: AUTH_SSO_COMPLETE_PATH,
      });
    } catch (err: unknown) {
      setError(clerkErrorMessage(err, "Could not continue with Google. Please try again."));
      setOauthBusy(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn || !canSubmitForm) return;

    setError(null);
    setBusy(true);
    try {
      const result = await signIn.create({
        strategy: "password",
        identifier: email.trim(),
        password,
      });

      if (result.status === "complete") {
        await finishSignIn(result.createdSessionId);
        return;
      }

      if (result.status === "needs_second_factor") {
        const emailFactor = result.supportedSecondFactors?.find(
          (factor) => factor.strategy === "email_code",
        );
        if (!emailFactor || !("emailAddressId" in emailFactor)) {
          setError("Additional verification is required. Please try again from a supported device.");
          return;
        }
        await signIn.prepareSecondFactor({
          strategy: "email_code",
          emailAddressId: emailFactor.emailAddressId,
        });
        setStep("second_factor");
        return;
      }

      setError("Sign-in could not be completed. Check your email and password.");
    } catch (err: unknown) {
      setError(clerkErrorMessage(err, "Could not sign in. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSecondFactor(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn || !code.trim()) return;

    setError(null);
    setBusy(true);
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code: code.trim(),
      });

      if (result.status !== "complete") {
        setError("Verification incomplete. Please check the code and try again.");
        return;
      }

      await finishSignIn(result.createdSessionId);
    } catch (err: unknown) {
      setError(clerkErrorMessage(err, "Verification failed. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSendResetCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn || !isValidEmail(email)) return;

    setError(null);
    setBusy(true);
    try {
      const result = await signIn.create({ identifier: email.trim() });
      const resetFactor = result.supportedFirstFactors?.find(
        (factor) => factor.strategy === "reset_password_email_code",
      );
      if (!resetFactor || !("emailAddressId" in resetFactor)) {
        setError("We could not start a password reset for that email.");
        return;
      }

      await signIn.prepareFirstFactor({
        strategy: "reset_password_email_code",
        emailAddressId: resetFactor.emailAddressId,
      });
      setCode("");
      setStep("forgot_code");
    } catch (err: unknown) {
      setError(clerkErrorMessage(err, "Could not send reset code. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyResetCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn || !code.trim()) return;

    setError(null);
    setBusy(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: code.trim(),
      });

      if (result.status !== "needs_new_password") {
        setError("Verification incomplete. Please check the code and try again.");
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setStep("forgot_password");
    } catch (err: unknown) {
      setError(clerkErrorMessage(err, "Verification failed. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const result = await signIn.resetPassword({ password: newPassword });
      if (result.status !== "complete") {
        setError("Could not reset password. Please try again.");
        return;
      }

      await finishSignIn(result.createdSessionId);
    } catch (err: unknown) {
      setError(clerkErrorMessage(err, "Could not reset password. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  function backToSignIn() {
    setStep("form");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  }

  return (
    <div className="register-flow">
      <header className="register-flow__header">
        <p className="register-flow__eyebrow">NovelViz</p>
        <h1 className="register-flow__title">
          {step.startsWith("forgot") ? "Reset password" : "Sign in"}
        </h1>
        <p className="register-flow__lede">
          A spoiler-safe AI reading companion for readers aged 18 and over.
        </p>
      </header>

      <div className="register-flow__panel">
        {step === "form" ? (
          <>
            <form onSubmit={(e) => void handleSignIn(e)} className="space-y-4">
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
                  autoComplete="current-password"
                  placeholder="Your password"
                  required
                />
                <button
                  type="button"
                  className="register-flow__forgot-link"
                  disabled={busy || oauthBusy}
                  onClick={() => {
                    setError(null);
                    setStep("forgot_email");
                  }}
                >
                  Forgot password?
                </button>
              </label>

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
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <AuthOAuthDivider />

            <GoogleOAuthButton
              label="Continue with Google"
              busy={oauthBusy}
              disabled={!isLoaded}
              onClick={() => void handleGoogleSignIn()}
            />
          </>
        ) : null}

        {step === "second_factor" ? (
          <form onSubmit={(e) => void handleSecondFactor(e)} className="space-y-4">
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
              onClick={backToSignIn}
              className="w-full text-sm text-text-muted hover:text-text-primary disabled:opacity-50"
            >
              Back to sign in
            </button>
          </form>
        ) : null}

        {step === "forgot_email" ? (
          <form onSubmit={(e) => void handleSendResetCode(e)} className="space-y-4">
            <p className="text-sm text-text-secondary">
              Enter your email and we&apos;ll send you a code to reset your password.
            </p>

            <label className="block text-sm">
              <span className="text-text-secondary">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                className={authInputClass}
                placeholder="you@example.com"
              />
            </label>

            {error ? (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !isValidEmail(email)}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-text-on-accent transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Sending code…" : "Send reset code"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={backToSignIn}
              className="w-full text-sm text-text-muted hover:text-text-primary disabled:opacity-50"
            >
              Back to sign in
            </button>
          </form>
        ) : null}

        {step === "forgot_code" ? (
          <form onSubmit={(e) => void handleVerifyResetCode(e)} className="space-y-4">
            <p className="text-sm text-text-secondary">
              We sent a reset code to{" "}
              <span className="font-medium text-text-primary">{email.trim()}</span>.
            </p>

            <label className="block text-sm">
              <span className="text-text-secondary">Reset code</span>
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
              {busy ? "Verifying…" : "Continue"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStep("forgot_email");
                setCode("");
                setError(null);
              }}
              className="w-full text-sm text-text-muted hover:text-text-primary disabled:opacity-50"
            >
              Use a different email
            </button>
          </form>
        ) : null}

        {step === "forgot_password" ? (
          <form onSubmit={(e) => void handleResetPassword(e)} className="space-y-4">
            <p className="text-sm text-text-secondary">Choose a new password for your account.</p>

            <label className="block text-sm">
              <span className="text-text-secondary">New password</span>
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                disabled={busy}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </label>

            <label className="block text-sm">
              <span className="text-text-secondary">Confirm password</span>
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                disabled={busy}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                minLength={8}
                required
              />
            </label>

            {error ? (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy || newPassword.length < 8 || confirmPassword.length < 8}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-text-on-accent transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Updating password…" : "Update password"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={backToSignIn}
              className="w-full text-sm text-text-muted hover:text-text-primary disabled:opacity-50"
            >
              Back to sign in
            </button>
          </form>
        ) : null}

        {step === "form" ? (
          <p className="mt-5 text-center text-sm text-text-muted">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-accent-text hover:text-text-primary hover:underline">
              Create account
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
