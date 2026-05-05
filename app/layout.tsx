import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { DevRoleSwitcher } from "@/components/dev-role-switcher";
import { PaletteSwitcher } from "@/components/palette-switcher";
import { PublicFooter } from "@/components/public-footer";
import { DEV_PALETTE_HYDRATION_SCRIPT } from "@/lib/dev-palette-hydration-script";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovelViz",
  description: "Chapter-gated AI for book readers",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const initialUserId = user?.id ?? null;
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className="flex min-h-screen flex-col bg-bg-base text-text-primary antialiased">
          {isDev && DEV_PALETTE_HYDRATION_SCRIPT ? (
            <script dangerouslySetInnerHTML={{ __html: DEV_PALETTE_HYDRATION_SCRIPT }} />
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          <PublicFooter />
          {isDev ? (
            <div className="fixed bottom-4 right-4 z-[200] flex max-w-[calc(100vw-2rem)] flex-wrap items-end gap-3 rounded-lg bg-bg-surface/90 px-3 py-2 shadow-md backdrop-blur-sm">
              <DevRoleSwitcher initialUserId={initialUserId} />
              <PaletteSwitcher />
            </div>
          ) : null}
        </body>
      </html>
    </ClerkProvider>
  );
}
