import { clearDevIdentityOnClient } from "@/lib/clear-dev-identity-client";

type SignOutFromAppOptions = {
  isProduction: boolean;
  isClerkSignedIn: boolean;
  clerkSignOut: (opts: { redirectUrl: string }) => Promise<void>;
  redirectUrl?: string;
};

/**
 * Ends the app session: clears dev impersonation locally, then Clerk sign-out if active,
 * otherwise a hard redirect (Clerk signOut is a no-op with no Clerk session).
 */
export async function signOutFromApp({
  isProduction,
  isClerkSignedIn,
  clerkSignOut,
  redirectUrl = "/",
}: SignOutFromAppOptions): Promise<void> {
  if (!isProduction) {
    clearDevIdentityOnClient();
  }

  if (isClerkSignedIn) {
    await clerkSignOut({ redirectUrl });
    return;
  }

  window.location.replace(redirectUrl);
}
