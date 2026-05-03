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
    <p className="rounded-lg border border-amber-300/70 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-950/95 dark:border-amber-800/35 dark:bg-amber-950/25 dark:text-amber-100/90">
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
        className="rounded-xl border border-amber-400/50 bg-amber-50/95 px-5 py-6 text-center text-sm leading-relaxed text-amber-950 dark:border-amber-700/35 dark:bg-amber-950/30 dark:text-amber-50/95"
        role="status"
      >
        <p>Thanks for getting in touch. We&apos;ll get back to you within 2 business days.</p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-4 text-xs font-medium text-amber-800 underline-offset-2 hover:text-amber-950 hover:underline dark:text-amber-300/90 dark:hover:text-amber-200"
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
            className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
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
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-amber-500/0 transition placeholder:text-zinc-400 focus:border-amber-600/60 focus:ring-2 focus:ring-amber-500/25 dark:border-zinc-700 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
        </div>
        <div>
          <label
            htmlFor="contact-email"
            className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
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
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-amber-500/0 transition placeholder:text-zinc-400 focus:border-amber-600/60 focus:ring-2 focus:ring-amber-500/25 dark:border-zinc-700 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
        </div>
        <div>
          <label
            htmlFor="contact-subject"
            className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Subject
          </label>
          <select
            id="contact-subject"
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-amber-500/0 transition focus:border-amber-600/60 focus:ring-2 focus:ring-amber-500/25 dark:border-zinc-700 dark:bg-zinc-950/80 dark:text-zinc-100"
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
            className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Message <span className="font-normal text-zinc-500 dark:text-zinc-500">(min. 20 characters)</span>
          </label>
          <textarea
            id="contact-message"
            name="message"
            required
            minLength={20}
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-amber-500/0 transition placeholder:text-zinc-400 focus:border-amber-600/60 focus:ring-2 focus:ring-amber-500/25 dark:border-zinc-700 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
        </div>
        {error ? <p className="text-sm text-red-600 dark:text-red-400/90">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-600/90 px-5 py-2.5 text-sm font-medium text-amber-950 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
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
