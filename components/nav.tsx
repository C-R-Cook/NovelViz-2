import { NavChrome } from "@/components/nav-client";
import { getCurrentUser } from "@/lib/auth";
import { userInitials } from "@/lib/user-initials";

export async function Nav({ hideThemeSwitcher = false }: { hideThemeSwitcher?: boolean }) {
  const user = await getCurrentUser();
  const initialUserId = user?.id ?? null;
  const isLoggedIn = !!user;
  const initials = user ? userInitials(user.name, user.email) : "";

  return (
    <NavChrome
      initialUserId={initialUserId}
      isLoggedIn={isLoggedIn}
      userInitials={initials}
      userName={user?.name ?? null}
      userUsername={user?.username ?? null}
      userEmail={user?.email ?? ""}
      userRole={user?.role ?? null}
      isProduction={process.env.NODE_ENV === "production"}
      hideThemeSwitcher={hideThemeSwitcher}
    />
  );
}
