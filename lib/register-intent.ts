import { getCurrentUser } from "@/lib/auth";
import { claimUsername } from "@/lib/claim-username";
import { syncClerkUsername } from "@/lib/clerk-user-sync";
import {
  isLegalConsentIntentValid,
  readLegalConsentIntentCookie,
} from "@/lib/legal-consent";
import { isValidUsernameFormat, normalizeUsername } from "@/lib/username";

/** Persist gallery username to Neon and Clerk after sign-up completes. */
export async function persistRegisterUsername(
  userId: string,
  clerkId: string,
  usernameRaw: string,
): Promise<{ ok: true; username: string } | { ok: false; error: string; status: number }> {
  const claimed = await claimUsername(userId, usernameRaw, { skipIfSet: true });
  if (!claimed.ok) return claimed;

  try {
    await syncClerkUsername(clerkId, claimed.username);
  } catch (err) {
    console.error("[register-intent] clerk username sync failed", err);
    return { ok: false, error: "Could not save username", status: 500 };
  }

  return { ok: true, username: claimed.username };
}

/** Apply username from the register-page intent cookie (OAuth sign-up path). */
export async function tryApplyRegisterUsernameFromIntent(
  userId: string,
  clerkId: string,
): Promise<boolean> {
  const intent = await readLegalConsentIntentCookie();
  if (!intent || !isLegalConsentIntentValid(intent) || !intent.username) {
    return false;
  }

  const result = await persistRegisterUsername(userId, clerkId, intent.username);
  if (!result.ok) {
    if (result.status === 409) {
      console.warn("[register-intent] username taken at apply time", {
        userId,
        username: intent.username,
      });
    }
    return false;
  }

  return true;
}

export function parseRegisterUsernameBody(body: unknown): string | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const raw = body as Record<string, unknown>;
  if (typeof raw.username !== "string") return { error: "Username is required" };
  const username = normalizeUsername(raw.username);
  if (!isValidUsernameFormat(username)) return { error: "Invalid username" };
  return username;
}
