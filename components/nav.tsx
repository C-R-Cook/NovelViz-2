import { NavChrome } from "@/components/nav-client";
import { getCurrentUser } from "@/lib/auth";
import { userInitials } from "@/lib/user-initials";
import type { UserRole } from "@db";

export async function Nav() {
  const user = await getCurrentUser();
  const initialUserId = user?.id ?? null;
  const role = (user?.role ?? null) as UserRole | null;
  const isLoggedIn = !!user;
  const initials = user ? userInitials(user.name, user.email) : "";

  return (
    <NavChrome
      initialUserId={initialUserId}
      role={role}
      isLoggedIn={isLoggedIn}
      userInitials={initials}
      userName={user?.name ?? null}
      userEmail={user?.email ?? ""}
      isProduction={process.env.NODE_ENV === "production"}
    />
  );
}
