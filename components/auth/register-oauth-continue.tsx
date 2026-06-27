"use client";

import {
  AUTH_SSO_COMPLETE_PATH,
  clerkErrorMessage,
  formatSignUpIncompleteMessage,
  resolveSignUpMissingRequirements,
} from "@/components/auth/auth-form-utils";
import { UsernameField } from "@/components/auth/username-field";
import { useSignUp } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import "./register-with-consent.css";

type OauthIntent = {
  username: string | null;
  consentComplete: boolean;
};

type ContinuePhase = "loading" | "manual" | "failed";

async function readOauthIntent(): Promise<OauthIntent | null> {
  try {
    const res = await fetch("/api/register/oauth-intent", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as OauthIntent;
  } catch {
    return null;
  }
}

export function RegisterOAuthContinue() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();
  const autoAttempted = useRef(false);

  const [phase, setPhase] = useState<ContinuePhase>("loading");
  const [username, setUsername] = useState("");
  const [usernameReady, setUsernameReady] = useState(false);
  const [normalizedUsername, setNormalizedUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUsernameAvailability = useCallback(
    (state: { ready: boolean; normalized: string }) => {
      setUsernameReady(state.ready);
      setNormalizedUsername(state.normalized);
    },
    [],
  );

  async function finalizeSignUp(sessionId: string) {
    if (!setActive) return;
    await setActive({ session: sessionId });
    router.replace(AUTH_SSO_COMPLETE_PATH);
    router.refresh();
  }

  useEffect(() => {
    if (!isLoaded || autoAttempted.current) return;
    if (!signUp?.id) {
      router.replace("/register");
      return;
    }

    autoAttempted.current = true;

    async function run() {
      if (!signUp) {
        router.replace("/register");
        return;
      }

      setError(null);

      if (signUp.status === "complete" && signUp.createdSessionId) {
        await finalizeSignUp(signUp.createdSessionId);
        return;
      }

      if (signUp.status !== "missing_requirements") {
        router.replace("/register");
        return;
      }

      const intent = await readOauthIntent();
      let state = await resolveSignUpMissingRequirements(signUp, {
        consentComplete: intent?.consentComplete ?? false,
        username: intent?.username ?? undefined,
      });

      if (state.status === "complete" && state.createdSessionId) {
        await finalizeSignUp(state.createdSessionId);
        return;
      }

      const stillMissingUsername = state.missingFields?.includes("username") ?? false;
      if (stillMissingUsername) {
        if (intent?.username) {
          setUsername(intent.username);
        }
        setPhase("manual");
        setError(
          intent?.username
            ? "We couldn't apply your username automatically. Please confirm it below."
            : null,
        );
        return;
      }

      setPhase("failed");
      setError(formatSignUpIncompleteMessage(state));
    }

    void run();
  }, [isLoaded, router, setActive, signUp]);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp || !usernameReady || busy) return;

    setBusy(true);
    setError(null);
    try {
      const intent = await readOauthIntent();

      let state = await signUp.update({ username: normalizedUsername });
      state = await resolveSignUpMissingRequirements(state, {
        consentComplete: intent?.consentComplete ?? false,
        username: normalizedUsername,
      });

      if (state.status === "complete" && state.createdSessionId) {
        await finalizeSignUp(state.createdSessionId);
        return;
      }

      setPhase("failed");
      setError(formatSignUpIncompleteMessage(state));
    } catch (err: unknown) {
      setError(clerkErrorMessage(err, "Could not finish sign-up. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  if (phase === "loading") {
    return (
      <div className="register-flow">
        <header className="register-flow__header">
          <p className="register-flow__eyebrow">NovelViz</p>
          <h1 className="register-flow__title">Finishing sign-up…</h1>
          <p className="register-flow__lede">Completing your Google account setup.</p>
        </header>
        <div className="register-flow__panel">
          <div id="clerk-captcha" className="register-flow__captcha" />
          <p className="text-center text-sm text-text-muted">One moment…</p>
        </div>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="register-flow">
        <header className="register-flow__header">
          <p className="register-flow__eyebrow">NovelViz</p>
          <h1 className="register-flow__title">Could not finish sign-up</h1>
        </header>
        <div className="register-flow__panel">
          <div id="clerk-captcha" className="register-flow__captcha" />
          {error ? (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => router.replace("/register")}
            className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-text-on-accent transition hover:opacity-90"
          >
            Back to register
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="register-flow">
      <header className="register-flow__header">
        <p className="register-flow__eyebrow">NovelViz</p>
        <h1 className="register-flow__title">Almost there</h1>
        <p className="register-flow__lede">Confirm your username to finish creating your account.</p>
      </header>

      <div className="register-flow__panel">
        <div id="clerk-captcha" className="register-flow__captcha" />

        <form onSubmit={(e) => void handleManualSubmit(e)} className="space-y-4">
          <UsernameField
            variant="integrated"
            value={username}
            onChange={setUsername}
            disabled={busy}
            onAvailabilityChange={handleUsernameAvailability}
          />

          {error ? (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!usernameReady || busy}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-text-on-accent transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Finishing…" : "Continue"}
          </button>
        </form>

        <button
          type="button"
          disabled={busy}
          onClick={() => router.replace("/register")}
          className="mt-4 w-full text-sm text-text-muted hover:text-text-primary disabled:opacity-50"
        >
          Back to register
        </button>
      </div>
    </div>
  );
}
