import { NavChrome } from "@/components/nav-client";
import { getCurrentUser } from "@/lib/auth";
import type { UserRole } from "@db";

export async function Nav() {
  const user = await getCurrentUser();
  const initialUserId = user?.id ?? null;
  const role = (user?.role ?? null) as UserRole | null;
  const isLoggedIn = !!user;

  return <NavChrome initialUserId={initialUserId} role={role} isLoggedIn={isLoggedIn} />;
}
