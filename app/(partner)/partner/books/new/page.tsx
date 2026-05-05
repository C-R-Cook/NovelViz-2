import { NewPartnerBookForm } from "./new-book-form";
import Link from "next/link";

export default function NewPartnerBookPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        href="/dashboard"
        className="inline-flex text-sm font-medium text-text-muted transition hover:text-accent-text"
      >
        ← Back to dashboard
      </Link>
      <section className="rounded-xl border border-border bg-bg-surface/85 p-6 shadow-sm shadow-bg-overlay/5">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-accent-text">
          Upload New Book
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Create a draft book and continue with ingestion.
        </p>
        <div className="mt-6">
          <NewPartnerBookForm />
        </div>
      </section>
    </div>
  );
}
