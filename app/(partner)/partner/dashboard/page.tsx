import { redirect } from "next/navigation";

/** Partner tools now live on the unified `/dashboard` (Partner tab). */
export default function PartnerDashboardLegacyRedirect() {
  redirect("/dashboard");
}
