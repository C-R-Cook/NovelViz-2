import { ClerkThemedSignIn } from "@/components/clerk-themed-auth";
import { DevRoleSwitcher } from "@/components/dev-role-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6 sm:gap-3">
        <DevRoleSwitcher />
        <ThemeToggle />
      </div>
      <ClerkThemedSignIn path="/login" routing="path" signUpUrl="/register" />
    </div>
  );
}