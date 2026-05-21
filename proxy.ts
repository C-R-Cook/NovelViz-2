import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedAppRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
