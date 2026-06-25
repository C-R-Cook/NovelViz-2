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
  const ready = allLegalConsentChecksComplete(checks);

  useEffect(() => {
    if (!ready) return;

    void fetch("/api/legal-consent-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        over18Confirmed: true,
        termsAccepted: true,
        privacyAccepted: true,
        termsDocumentVersion: TERMS_DOCUMENT_VERSION,
        privacyDocumentVersion: PRIVACY_DOCUMENT_VERSION,
      }),
    }).catch(() => {
      /* UX bridge only — /auth/consent fallback handles failures */
    });
  }, [ready]);

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
        />

        <div className="register-flow__divider" aria-hidden>
          Account details
        </div>

        <div
          className={
            ready
              ? "register-flow__clerk-wrap"
              : "register-flow__clerk-wrap register-flow__clerk-wrap--locked"
          }
          aria-hidden={!ready}
        >
          {!ready ? (
            <p className="register-flow__lock-hint">
              Confirm the agreements above to unlock email sign-up and social options.
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
