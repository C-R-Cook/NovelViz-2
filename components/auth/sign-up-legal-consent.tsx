"use client";

import Link from "next/link";
import { useId, useState } from "react";

export type LegalConsentChecks = {
  over18Confirmed: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};

type Props = {
  value: LegalConsentChecks;
  onChange: (next: LegalConsentChecks) => void;
  disabled?: boolean;
  className?: string;
  /** Card-style options for the register page shell. */
  variant?: "default" | "integrated";
};

const checkboxClass =
  "mt-0.5 h-4 w-4 shrink-0 rounded border-border text-accent-text focus:ring-accent/40";
const labelClass = "flex cursor-pointer items-start gap-3 text-sm leading-snug text-text-secondary";
const linkClass = "text-accent-text underline-offset-2 hover:text-text-primary hover:underline";

export function SignUpLegalConsentFields({
  value,
  onChange,
  disabled = false,
  className,
  variant = "default",
}: Props) {
  const baseId = useId();
  const legalDocumentsAccepted = value.termsAccepted && value.privacyAccepted;
  const integrated = variant === "integrated";

  function setLegalDocumentsAccepted(checked: boolean) {
    onChange({
      ...value,
      termsAccepted: checked,
      privacyAccepted: checked,
    });
  }

  if (integrated) {
    return (
      <fieldset
        className={className}
        disabled={disabled}
        aria-label="Required agreements before creating an account"
      >
        <legend className="sr-only">Required agreements</legend>
        <ul className="register-consent__list">
          <li>
            <label htmlFor={`${baseId}-over18`} className="register-consent__option">
              <input
                id={`${baseId}-over18`}
                type="checkbox"
                className="register-consent__checkbox"
                checked={value.over18Confirmed}
                onChange={(e) => onChange({ ...value, over18Confirmed: e.target.checked })}
                required
              />
              <span className="register-consent__label-text">I am 18 years of age or older</span>
            </label>
          </li>
          <li>
            <label htmlFor={`${baseId}-legal`} className="register-consent__option">
              <input
                id={`${baseId}-legal`}
                type="checkbox"
                className="register-consent__checkbox"
                checked={legalDocumentsAccepted}
                onChange={(e) => setLegalDocumentsAccepted(e.target.checked)}
                required
              />
              <span className="register-consent__label-text">
                I agree to the{" "}
                <Link href="/terms" target="_blank" rel="noopener noreferrer" className="register-consent__link">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="register-consent__link">
                  Privacy Policy
                </Link>
              </span>
            </label>
          </li>
        </ul>
      </fieldset>
    );
  }

  return (
    <fieldset
      className={className}
      disabled={disabled}
      aria-label="Required agreements before creating an account"
    >
      <legend className="sr-only">Required agreements</legend>
      <ul className="space-y-3">
        <li>
          <label htmlFor={`${baseId}-over18`} className={labelClass}>
            <input
              id={`${baseId}-over18`}
              type="checkbox"
              className={checkboxClass}
              checked={value.over18Confirmed}
              onChange={(e) => onChange({ ...value, over18Confirmed: e.target.checked })}
              required
            />
            <span>I am 18 years of age or older</span>
          </label>
        </li>
        <li>
          <label htmlFor={`${baseId}-legal`} className={labelClass}>
            <input
              id={`${baseId}-legal`}
              type="checkbox"
              className={checkboxClass}
              checked={legalDocumentsAccepted}
              onChange={(e) => setLegalDocumentsAccepted(e.target.checked)}
              required
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" target="_blank" rel="noopener noreferrer" className={linkClass}>
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>
                Privacy Policy
              </Link>
            </span>
          </label>
        </li>
      </ul>
    </fieldset>
  );
}

export function allLegalConsentChecksComplete(value: LegalConsentChecks): boolean {
  return value.over18Confirmed && value.termsAccepted && value.privacyAccepted;
}

const emptyChecks: LegalConsentChecks = {
  over18Confirmed: false,
  termsAccepted: false,
  privacyAccepted: false,
};

type SubmitProps = {
  submitLabel?: string;
  onSuccess?: () => void;
};

export function LegalConsentSubmitForm({
  submitLabel = "Continue",
  onSuccess,
}: SubmitProps) {
  const [checks, setChecks] = useState<LegalConsentChecks>(emptyChecks);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!allLegalConsentChecksComplete(checks)) {
      setError("Please confirm all required agreements to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/legal-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checks),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save your agreements");
        return;
      }
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      <SignUpLegalConsentFields value={checks} onChange={setChecks} disabled={submitting} />
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting || !allLegalConsentChecksComplete(checks)}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-text-on-accent transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
