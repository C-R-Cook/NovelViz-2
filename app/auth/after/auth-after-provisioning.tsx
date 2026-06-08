"use client";

import { ImageGenerationLoader } from "@/components/ui/image-generation-loader";
import { clearDevIdentityOnClient } from "@/lib/clear-dev-identity-client";
import { useEffect, useState } from "react";
import "./auth-after-provisioning.css";
const RETRY_MS = 700;
const MAX_RETRIES = 20;

type Props = {
  /** Dev preview: show UI only, no polling redirects or dev cookie clearing. */
  previewMode?: boolean;
  /** Standalone /auth/after page: fill app shell for vertical centering. */
  fullPage?: boolean;
};
/** Shown when Clerk is signed in but the DB user row is not ready yet. */
export function AuthAfterProvisioning({ previewMode = false, fullPage = false }: Props) {  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (previewMode) return;
    if (process.env.NODE_ENV !== "production") {
      clearDevIdentityOnClient();
    }
  }, [previewMode]);

  useEffect(() => {
    if (previewMode) return;
    if (attempts >= MAX_RETRIES) return;
    const t = window.setTimeout(() => {
      setAttempts((n) => n + 1);
      window.location.replace("/auth/after");
    }, RETRY_MS);
    return () => window.clearTimeout(t);
  }, [attempts, previewMode]);

  return (
    <div
      className={`auth-after-provisioning${fullPage ? " auth-after-provisioning--page" : ""}`}
    >      {attempts >= MAX_RETRIES ? (
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
