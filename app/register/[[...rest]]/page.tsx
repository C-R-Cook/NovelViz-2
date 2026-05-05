import { ClerkThemedSignUp } from "@/components/clerk-themed-auth";

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-base p-6">
      <ClerkThemedSignUp path="/register" routing="path" signInUrl="/login" />
    </div>
  );
}
