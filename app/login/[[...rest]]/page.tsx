import { ClerkThemedSignIn } from "@/components/clerk-themed-auth";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-base p-6">
      <ClerkThemedSignIn path="/login" routing="path" signUpUrl="/register" />
    </div>
  );
}
