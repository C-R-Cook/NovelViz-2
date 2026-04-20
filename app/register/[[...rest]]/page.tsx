import { ClerkThemedSignUp } from "@/components/clerk-themed-auth";
import { ThemeToggle } from "@/components/theme-toggle";

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <ClerkThemedSignUp path="/register" routing="path" signInUrl="/login" />
    </div>
  );
}