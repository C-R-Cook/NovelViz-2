import { SignUp } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <SignUp
        path="/register"
        routing="path"
        signInUrl="/login"
      />
    </div>
  );
}