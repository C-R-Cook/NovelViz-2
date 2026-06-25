"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type StrikeRow = {
  id: string;
  createdAt: string;
  aupCategory: string | null;
  summary: string | null;
  source: string;
};

export function SuspendedAccountClient({
  strikes,
  statusReason,
  hasPendingAppeal,
}: {
  strikes: StrikeRow[];
  statusReason: string | null;
  hasPendingAppeal: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(hasPendingAppeal);

  async function submitAppeal(e: React.FormEvent) {
    e.preventDefault();
    if (submitted) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not submit appeal");
        return;
      }
      setSubmitted(true);
      router.refresh();
    } catch {
      setError("Could not submit appeal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">
        Your account is suspended
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">
        An admin will review your account shortly. You cannot use NovelViz features while your
        account is suspended.
      </p>
      {statusReason ? (
        <p className="mt-2 text-sm text-text-secondary">
          <span className="font-medium text-text-primary">Reason:</span> {statusReason}
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">Your strike history</h2>
        {strikes.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">
            No detailed strike history is recorded yet. You can review our{" "}
            <Link href="/acceptable-use" className="text-accent-text underline-offset-2 hover:underline">
              Acceptable Use Policy
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {strikes.map((strike) => (
              <li
                key={strike.id}
                className="rounded-lg border border-border-subtle bg-bg-surface/60 px-4 py-3 text-sm text-text-muted"
              >
                <p className="font-medium text-text-primary">
                  {new Date(strike.createdAt).toLocaleString()}
                  {strike.aupCategory ? ` · ${strike.aupCategory}` : ""}
                </p>
                {strike.summary ? <p className="mt-1">{strike.summary}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">Submit an explanation</h2>
        {submitted ? (
          <p className="mt-2 text-sm text-success">
            Your information has been submitted. We&apos;ll review your account shortly.
          </p>
        ) : (
          <form onSubmit={(e) => void submitAppeal(e)} className="mt-3 space-y-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary"
              placeholder="Optional: explain your perspective on the flagged content or incidents."
              disabled={busy}
            />
            {error ? (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy || message.trim().length === 0}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text-inverse disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Submit appeal"}
            </button>
          </form>
        )}
        <p className="mt-4 text-sm text-text-muted">
          Need to add more later?{" "}
          <Link href="/contact" className="text-accent-text underline-offset-2 hover:underline">
            Contact us
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
