"use client";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AuthAfterError({ reset }: Props) {
  return (
    <div className="auth-after-provisioning auth-after-provisioning--page flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-medium text-text-primary">Something went wrong</h1>
      <p className="max-w-md text-sm text-text-secondary">
        We couldn&apos;t finish setting up your session. Please try signing in again — your account
        may already exist.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <a
          href="/login"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-text-on-accent hover:opacity-90"
        >
          Go to sign in
        </a>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-border px-4 py-2.5 text-sm text-text-primary hover:bg-bg-elevated"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
