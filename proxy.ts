import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { DEV_USER_COOKIE, hasDevIdentityCookie } from "@/lib/dev-users";
import { DEV_GUEST_COOKIE, hasDevGuestMode } from "@/lib/dev-guest-mode";

/** Next.js 16 Clerk middleware entry (this file replaces the legacy `middleware.ts` name). */

const isProtectedAppRoute = createRouteMatcher([
  "/library(.*)",
  "/dashboard(.*)",
  "/reader(.*)",
  "/onboarding(.*)",
  "/account(.*)",
  "/partner(.*)",
  "/admin(.*)",
]);

/** In development, dev role switcher cookie satisfies route protection without Clerk. */
function hasDevSession(req: { cookies: { get: (name: string) => { value?: string } | undefined } }): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const devUserId = req.cookies.get(DEV_USER_COOKIE)?.value;
  const legacyRole = req.cookies.get("dev_role")?.value;
  return hasDevIdentityCookie(devUserId, legacyRole);
}

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedAppRoute(req)) {
    const guestPreview = hasDevGuestMode(req.cookies.get(DEV_GUEST_COOKIE)?.value);
    if (guestPreview) {
      return NextResponse.redirect(new URL("/discover", req.url));
    }
    if (hasDevSession(req)) return;
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
