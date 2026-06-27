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

export function isVerificationAlreadyVerified(err: unknown): boolean {
  if (err && typeof err === "object" && "errors" in err) {
    const errors = (err as { errors?: Array<{ code?: string; message?: string; longMessage?: string }> })
      .errors;
    return (
      errors?.some(
        (e) =>
          e.code === "verification_already_verified" ||
          e.message?.toLowerCase().includes("already been verified") ||
          e.longMessage?.toLowerCase().includes("already been verified"),
      ) ?? false
    );
  }
  return false;
}

type SignUpCompletionState = {
  status: string | null;
  missingFields?: string[] | null;
  unverifiedFields?: string[] | null;
};

export function formatSignUpIncompleteMessage(signUp: SignUpCompletionState): string {
  const missing = signUp.missingFields?.filter(Boolean) ?? [];
  const unverified = signUp.unverifiedFields?.filter(Boolean) ?? [];
  if (missing.length > 0) {
    return `Additional sign-up requirements are still pending (${missing.join(", ")}). Please try again or contact support.`;
  }
  if (unverified.length > 0) {
    return `Verification incomplete (${unverified.join(", ")}). Please check the code and try again.`;
  }
  return "Verification incomplete. Please check the code and try again.";
}

type SignUpUpdatable = SignUpCompletionState & {
  createdSessionId?: string | null;
  update: (params: {
    legalAccepted?: boolean;
    username?: string;
  }) => Promise<SignUpCompletionState & { createdSessionId?: string | null }>;
};

type ResolveSignUpOptions = {
  consentComplete: boolean;
  username?: string;
};

/** Satisfy Clerk-side requirements after our in-app fields are collected. */
export async function resolveSignUpMissingRequirements<T extends SignUpUpdatable>(
  signUp: T,
  options: ResolveSignUpOptions,
): Promise<T> {
  if (signUp.status !== "missing_requirements") return signUp;

  const missing = signUp.missingFields ?? [];
  const updates: { legalAccepted?: boolean; username?: string } = {};

  const needsLegal = missing.some((f) => f === "legal_accepted" || f.includes("legal"));
  if (needsLegal && options.consentComplete) {
    updates.legalAccepted = true;
  }

  if (missing.includes("username") && options.username) {
    updates.username = options.username;
  }

  if (Object.keys(updates).length === 0) return signUp;

  return (await signUp.update(updates)) as T;
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
