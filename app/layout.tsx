import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Analytics } from "@vercel/analytics/next";
import { cookies } from "next/headers";
import { DevRoleSwitcher } from "@/components/dev-role-switcher";
import { ConditionalPublicFooter } from "@/components/conditional-public-footer";
import { THEME_HYDRATION_SCRIPT } from "@/lib/theme-hydration-script";
import {
  DEV_USER_COOKIE,
  DEV_USERS_BY_ID,
  hasDevIdentityCookie,
  resolveDevUserIdFromCookies,
} from "@/lib/dev-users";
import { DEV_GUEST_COOKIE, hasDevGuestMode } from "@/lib/dev-guest-mode";
import "./globals.css";

async function readDevCookieUserId(): Promise<string | null> {
  const store = await cookies();
  const devUserId = store.get(DEV_USER_COOKIE)?.value;
  const legacyRole = store.get("dev_role")?.value;
  if (!hasDevIdentityCookie(devUserId, legacyRole)) return null;
  const id = resolveDevUserIdFromCookies(devUserId, legacyRole);
  return DEV_USERS_BY_ID[id] ? id : null;
}

export const metadata: Metadata = {
  title: "NovelViz",
  description: "Chapter-gated AI for book readers",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId: clerkUserId } = await auth();
  const cookieStore = await cookies();
  const devCookieUserId = await readDevCookieUserId();
  const devGuestMode = hasDevGuestMode(cookieStore.get(DEV_GUEST_COOKIE)?.value);
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <ClerkProvider signInUrl="/login" signUpUrl="/register">
      <html lang="en" data-theme="candle-light" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_HYDRATION_SCRIPT }} />
        </head>
        <body
          className="flex min-h-screen flex-col bg-bg-base text-text-primary antialiased"
          suppressHydrationWarning
        >
          <div className="app-atmosphere flex min-h-0 flex-1 flex-col">
            <div className="relative z-[1] flex min-h-0 flex-1 flex-col">{children}</div>
            <div className="relative z-[1] shrink-0">
              <ConditionalPublicFooter />
            </div>
          </div>
          {isDev ? (
            <div className="fixed bottom-4 right-4 z-[200] flex max-w-[calc(100vw-2rem)] flex-wrap items-end gap-3 rounded-lg bg-bg-surface/90 px-3 py-2 shadow-md backdrop-blur-sm">
              <DevRoleSwitcher
                clerkSignedIn={!!clerkUserId}
                devCookieUserId={devCookieUserId}
                devGuestMode={devGuestMode}
              />
            </div>
          ) : null}
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
