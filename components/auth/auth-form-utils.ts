export const authInputClass =
  "mt-1 w-full rounded-md border border-border-default bg-bg-elevated/80 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60";

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function clerkErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "errors" in err) {
    const errors = (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    if (errors?.[0]?.longMessage) return errors[0].longMessage;
    if (errors?.[0]?.message) return errors[0].message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export async function waitForSessionReady(fallback = "/auth/after"): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch("/api/auth/session-ready", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { ready?: boolean; redirectTo?: string };
      if (data.ready && data.redirectTo) return data.redirectTo;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(500 + attempt * 100, 2000)));
  }
  return fallback;
}

export const AUTH_SSO_CALLBACK_PATH = "/auth/sso-callback";
export const AUTH_SSO_COMPLETE_PATH = "/auth/after";
