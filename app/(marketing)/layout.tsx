import { Nav } from "@/components/nav";
import { LandingThemeLock } from "@/components/landing-theme-lock";
import { getCurrentUser } from "@/lib/auth";

export default async function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const isLoggedIn = !!user;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LandingThemeLock />
      {isLoggedIn ? <Nav hideThemeSwitcher /> : null}
      <div className={isLoggedIn ? "flex-1 pt-14" : "flex-1"}>{children}</div>
    </div>
  );
}
