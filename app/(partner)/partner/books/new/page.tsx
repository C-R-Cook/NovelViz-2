import { NewPartnerBookForm } from "./new-book-form";
import Link from "next/link";

export default function NewPartnerBookPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        href="/partner/dashboard"
        className="inline-flex text-sm font-medium text-zinc-600 transition hover:text-amber-800 dark:text-zinc-400 dark:hover:text-amber-200/90"
      >
        ← Back to dashboard
      </Link>
      <section className="rounded-xl border border-zinc-200/90 bg-white/85 p-6 shadow-sm shadow-zinc-900/5 dark:border-zinc-800/80 dark:bg-zinc-900/35 dark:shadow-black/20">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-amber-900 dark:text-amber-100/95">
          Upload New Book
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Create a draft book and continue with ingestion.
        </p>
        <div className="mt-6">
          <NewPartnerBookForm />
        </div>
      </section>
    </div>
  );
}
