import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function AuthSsoCallbackPage() {
  return (
    <>
      <AuthenticateWithRedirectCallback continueSignUpUrl="/register/continue" />
      <div id="clerk-captcha" className="sr-only" aria-hidden />
    </>
  );
}
