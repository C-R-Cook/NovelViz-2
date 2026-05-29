"use client";

import { clearDevIdentityOnClient } from "@/lib/clear-dev-identity-client";
import { useEffect, useState } from "react";

const RETRY_MS = 700;
const MAX_RETRIES = 20;

/** Shown when Clerk is signed in but the DB user row is not ready yet. */
export function AuthAfterProvisioning() {
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      clearDevIdentityOnClient();
    }
  }, []);

  useEffect(() => {
    if (attempts >= MAX_RETRIES) return;
    const t = window.setTimeout(() => {
      setAttempts((n) => n + 1);
      window.location.replace("/auth/after");
    }, RETRY_MS);
    return () => window.clearTimeout(t);
  }, [attempts]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg-base px-6 text-center text-sm text-text-muted">
      <p>Setting up your account…</p>
      {attempts >= MAX_RETRIES ? (
        <p className="text-xs text-text-muted">
          This is taking longer than expected.{" "}
          <a href="/login" className="text-accent-text underline">
            Try signing in again
          </a>
          .
        </p>
      ) : (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
      )}
    </div>
  );
}
