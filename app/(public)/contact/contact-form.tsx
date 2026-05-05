"use client";

import { useState } from "react";

const SUBJECTS = [
  { value: "general", label: "General enquiry" },
  { value: "technical", label: "Technical support" },
  { value: "partnership", label: "Partnership / publishing enquiry" },
  { value: "press", label: "Press enquiry" },
  { value: "issue", label: "Report an issue" },
] as const;

function PartnershipNote() {
  return (
    <p className="rounded-lg border border-accent/50 bg-accent-muted px-4 py-3 text-sm leading-relaxed text-text-primary">
      For publishing partnerships, you can also apply directly for a partner account.
    </p>
  );
}

export function ContactBlock() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECTS[0].value);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject,
          message: message.trim(),
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      if (data.success) {
        setDone(true);
        setName("");
        setEmail("");
        setSubject(SUBJECTS[0].value);
        setMessage("");
      }
    } catch {
      setError("Could not send your message. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div
        className="rounded-xl border border-accent/50 bg-accent-muted px-5 py-6 text-center text-sm leading-relaxed text-text-primary"
        role="status"
      >
        <p>Thanks for getting in touch. We&apos;ll get back to you within 2 business days.</p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-4 text-xs font-medium text-accent-text underline-offset-2 hover:text-text-primary hover:underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="contact-name"
            className="mb-1.5 block text-xs font-medium text-text-secondary"
          >
            Name
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-accent/0 transition placeholder:text-text-secondary focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
          />
        </div>
        <div>
          <label
            htmlFor="contact-email"
            className="mb-1.5 block text-xs font-medium text-text-secondary"
          >
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-accent/0 transition placeholder:text-text-secondary focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
          />
        </div>
        <div>
          <label
            htmlFor="contact-subject"
            className="mb-1.5 block text-xs font-medium text-text-secondary"
          >
            Subject
          </label>
          <select
            id="contact-subject"
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-accent/0 transition focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
          >
            {SUBJECTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="contact-message"
            className="mb-1.5 block text-xs font-medium text-text-secondary"
          >
            Message <span className="font-normal text-text-muted">(min. 20 characters)</span>
          </label>
          <textarea
            id="contact-message"
            name="message"
            required
            minLength={20}
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full resize-y rounded-lg border border-border bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-accent/0 transition placeholder:text-text-secondary focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
          />
        </div>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent/90 px-5 py-2.5 text-sm font-medium text-text-primary transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Sending…" : "Submit"}
        </button>
      </form>
      {subject === "partnership" ? (
        <div className="mt-4">
          <PartnershipNote />
        </div>
      ) : null}
    </div>
  );
}
