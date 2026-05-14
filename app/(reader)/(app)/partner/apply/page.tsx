import { redirect } from "next/navigation";

export default function PartnerApplyRedirectPage() {
  redirect("/dashboard?tab=partner-program");
}
