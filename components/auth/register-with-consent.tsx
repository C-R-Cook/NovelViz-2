"use client";

import { ClerkThemedSignUp } from "@/components/clerk-themed-auth";
import {
  allLegalConsentChecksComplete,
  SignUpLegalConsentFields,
  type LegalConsentChecks,
} from "@/components/auth/sign-up-legal-consent";
import {
  PRIVACY_DOCUMENT_VERSION,
  TERMS_DOCUMENT_VERSION,
} from "@/lib/legal-consent-constants";
import { useEffect, useState } from "react";
import "./register-with-consent.css";

const initialChecks: LegalConsentChecks = {
  over18Confirmed: false,
  termsAccepted: false,
  privacyAccepted: false,
};

export function RegisterWithConsent() {
  const [checks, setChecks] = useState<LegalConsentChecks>(initialChecks);
  const [intentReady, setIntentReady] = useState(false);
  const [intentSaving, setIntentSaving] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);

  const checksComplete = allLegalConsentChecksComplete(checks);
  const clerkUnlocked = checksComplete && intentReady && !intentSaving;

  useEffect(() => {
    if (!checksComplete) {
      setIntentReady(false);
      setIntentSaving(false);
      setIntentError(null);
      return;
    }

    let cancelled = false;
    setIntentSaving(true);
    setIntentError(null);
    setIntentReady(false);

    void (async () => {
      try {
        const res = await fetch("/api/legal-consent-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            over18Confirmed: true,
            termsAccepted: true,
            privacyAccepted: true,
            termsDocumentVersion: TERMS_DOCUMENT_VERSION,
            privacyDocumentVersion: PRIVACY_DOCUMENT_VERSION,
          }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setIntentError("Couldn\u2019t save your agreements \u2014 try again.");
          return;
        }
        setIntentReady(true);
      } catch {
        if (!cancelled) {
          setIntentError("Couldn\u2019t save your agreements \u2014 try again.");
        }
      } finally {
        if (!cancelled) {
          setIntentSaving(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checksComplete]);

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
        <p className="register-flow__section-label">Before you continue</p>
        <SignUpLegalConsentFields
          variant="integrated"
          value={checks}
          onChange={setChecks}
          disabled={intentSaving}
        />

        {intentError ? (
          <p className="mt-3 text-sm text-error" role="alert">
            {intentError}
          </p>
        ) : null}

        <div className="register-flow__divider" aria-hidden>
          Account details
        </div>

        <div
          className={
            clerkUnlocked
              ? "register-flow__clerk-wrap"
              : "register-flow__clerk-wrap register-flow__clerk-wrap--locked"
          }
          aria-hidden={!clerkUnlocked}
        >
          {!clerkUnlocked ? (
            <p className="register-flow__lock-hint">
              {intentSaving
                ? "Saving your agreements\u2026"
                : "Confirm the agreements above to unlock email sign-up and social options."}
            </p>
          ) : null}
          <div className="register-flow__clerk-inner">
            <ClerkThemedSignUp
              embedded
              path="/register"
              routing="path"
              signInUrl="/login"
              forceRedirectUrl="/auth/after"
              fallbackRedirectUrl="/auth/after"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
