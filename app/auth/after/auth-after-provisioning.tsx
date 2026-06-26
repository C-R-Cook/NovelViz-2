"use client";

import { ImageGenerationLoader } from "@/components/ui/image-generation-loader";
import { clearDevIdentityOnClient } from "@/lib/clear-dev-identity-client";
import { useEffect, useState } from "react";
import "./auth-after-provisioning.css";

const MAX_ATTEMPTS = 30;

type Props = {
  /** Dev preview: show UI only, no polling redirects or dev cookie clearing. */
  previewMode?: boolean;
  /** Standalone /auth/after page: fill app shell for vertical centering. */
  fullPage?: boolean;
};

function pollDelayMs(attempt: number): number {
  return Math.min(500 + attempt * 100, 2000);
}

/** Shown when Clerk is signed in but the DB user row is not ready yet. */
export function AuthAfterProvisioning({ previewMode = false, fullPage = false }: Props) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (previewMode) return;
    if (process.env.NODE_ENV !== "production") {
      clearDevIdentityOnClient();
    }
  }, [previewMode]);

  useEffect(() => {
    if (previewMode) return;

    let cancelled = false;
    let attempt = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      if (cancelled) return;
      attempt += 1;

      try {
        const res = await fetch("/api/auth/session-ready", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { ready?: boolean; redirectTo?: string };
          if (data.ready && data.redirectTo) {
            window.location.replace(data.redirectTo);
            return;
          }
        }
      } catch {
        // retry
      }

      if (attempt >= MAX_ATTEMPTS) {
        setTimedOut(true);
        return;
      }

      timeoutId = setTimeout(() => void poll(), pollDelayMs(attempt));
    }

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [previewMode]);

  return (
    <div
      className={`auth-after-provisioning${fullPage ? " auth-after-provisioning--page" : ""}`}
    >
      {timedOut ? (
        <>
          <p className="text-sm text-text-muted">Setting up your account…</p>
          <p className="text-xs text-text-muted">
            This is taking longer than expected.{" "}
            <a href="/login" className="text-accent-text underline">
              Try signing in again
            </a>
            .
          </p>
        </>
      ) : (
        <ImageGenerationLoader
          label="Setting up your account…"
          ariaLabel="Setting up your account"
        />
      )}
    </div>
  );
}
