import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <SignIn
        path="/login"
        routing="path"
        signUpUrl="/register"
      />
    </div>
  );
}