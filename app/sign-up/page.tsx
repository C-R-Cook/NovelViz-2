import { redirect } from "next/navigation";

/** Legacy URL — sign-up lives at `/register`. */
export default function SignUpRedirectPage() {
  redirect("/register");
}
