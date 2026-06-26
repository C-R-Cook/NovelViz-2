import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function AuthSsoCallbackPage() {
  return <AuthenticateWithRedirectCallback />;
}
