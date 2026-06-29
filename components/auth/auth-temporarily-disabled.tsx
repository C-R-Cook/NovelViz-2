import Link from "next/link";

export function AuthTemporarilyDisabled() {
  return (
    <div className="register-flow">
      <header className="register-flow__header">
        <p className="register-flow__eyebrow">NovelViz</p>
        <h1 className="register-flow__title">Sign-in temporarily unavailable</h1>
        <p className="register-flow__lede">
          Account sign-up and sign-in are paused for a short time. You can still browse the public gallery and
          discover books.
        </p>
      </header>
      <div className="register-flow__panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/discover"
            className="inline-flex justify-center rounded-md border border-accent/35 bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-accent-hover/90"
          >
            Browse books
          </Link>
          <Link
            href="/gallery"
            className="inline-flex justify-center rounded-md border border-border bg-bg-surface px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-raised"
          >
            Public gallery
          </Link>
        </div>
      </div>
    </div>
  );
}
