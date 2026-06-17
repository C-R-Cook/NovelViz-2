"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import {
  accountInputClass,
  accountLabelClass,
  accountReadOnlyInputClass,
} from "@/lib/account-form-styles";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type FlowState = "default" | "enter-email" | "verify-code";

type ClerkUserResource = NonNullable<ReturnType<typeof useUser>["user"]>;
type PendingEmailAddress = Awaited<ReturnType<ClerkUserResource["createEmailAddress"]>>;

type Props = {
  fallbackEmail: string;
};

function clerkErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "errors" in err) {
    const errors = (err as { errors?: Array<{ message?: string; longMessage?: string }> }).errors;
    const first = errors?.[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

function primaryEmailAddress(user: ClerkUserResource): string {
  return (
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? ""
  );
}

export function EmailChangeSection({ fallbackEmail }: Props) {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { user, isLoaded } = useUser();

  const [flow, setFlow] = useState<FlowState>("default");
  const [newEmail, setNewEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingEmailAddress, setPendingEmailAddress] = useState<PendingEmailAddress | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canChangeEmail = isSignedIn === true && isLoaded && !!user;
  const displayEmail = useMemo(() => {
    if (user) {
      const fromClerk = primaryEmailAddress(user);
      if (fromClerk) return fromClerk;
    }
    return fallbackEmail;
  }, [user, fallbackEmail]);

  function resetFlow() {
    setFlow("default");
    setNewEmail("");
    setVerificationCode("");
    setPendingEmailAddress(null);
    setError(null);
  }

  async function sendVerificationCode() {
    if (!user || !canChangeEmail) return;

    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) {
      setError("Enter a new email address.");
      return;
    }
    if (trimmed === displayEmail.trim().toLowerCase()) {
      setError("That is already your current email.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const emailAddress = await user.createEmailAddress({ email: trimmed });
      await emailAddress.prepareVerification({ strategy: "email_code" });
      setPendingEmailAddress(emailAddress);
      setFlow("verify-code");
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndPromote() {
    if (!user || !pendingEmailAddress || !canChangeEmail) return;

    const code = verificationCode.trim();
    if (code.length !== 6) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const verified = await pendingEmailAddress.attemptVerification({ code });
      if (verified.verification?.status !== "verified") {
        setError("Verification failed. Check the code and try again.");
        return;
      }

      const oldPrimaryId = user.primaryEmailAddressId;
      await user.update({ primaryEmailAddressId: pendingEmailAddress.id });

      const oldPrimary = user.emailAddresses.find((e) => e.id === oldPrimaryId);
      if (oldPrimary && oldPrimary.id !== pendingEmailAddress.id) {
        await oldPrimary.destroy();
      }

      await user.reload();
      setSuccessMessage("Email updated successfully.");
      resetFlow();
      router.refresh();
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const linkButtonClass =
    "text-sm font-medium text-accent-text underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline";

  return (
    <div>
      <span className={accountLabelClass}>Email</span>

      {flow === "default" ? (
        <div className="mt-1">
          <input
            type="email"
            readOnly
            value={displayEmail}
            className={accountReadOnlyInputClass}
            aria-readonly
          />
          {successMessage ? (
            <p className="mt-2 text-sm text-success" role="status">
              {successMessage}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              className={linkButtonClass}
              disabled={!canChangeEmail}
              onClick={() => {
                setError(null);
                setSuccessMessage(null);
                setFlow("enter-email");
              }}
            >
              Change email
            </button>
            {!canChangeEmail ? (
              <span className="text-xs text-text-muted">
                Sign in with your Clerk account to change email.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {flow === "enter-email" ? (
        <div className="mt-1 space-y-3">
          <input
            id="account-new-email"
            type="email"
            autoFocus
            autoComplete="email"
            className={accountInputClass}
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void sendVerificationCode();
              }
            }}
            placeholder="New email address"
            disabled={busy}
          />
          {error ? (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendVerificationCode()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text-inverse shadow transition hover:bg-accent disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send verification code"}
            </button>
            <button
              type="button"
              className={linkButtonClass}
              disabled={busy}
              onClick={() => resetFlow()}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {flow === "verify-code" && pendingEmailAddress ? (
        <div className="mt-1 space-y-3">
          <p className="text-sm text-text-secondary">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-text-primary">{newEmail.trim()}</span>
          </p>
          <input
            id="account-email-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            className={accountInputClass}
            value={verificationCode}
            onChange={(e) => {
              setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void verifyAndPromote();
              }
            }}
            placeholder="000000"
            disabled={busy}
          />
          {error ? (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void verifyAndPromote()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text-inverse shadow transition hover:bg-accent disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              className={linkButtonClass}
              disabled={busy}
              onClick={() => {
                setVerificationCode("");
                setError(null);
                setFlow("enter-email");
              }}
            >
              Use a different email
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
