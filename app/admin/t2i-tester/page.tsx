import T2iTesterClient from "@/app/admin/t2i-tester/t2i-tester-client";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@db";
import { redirect } from "next/navigation";

export default async function T2iTesterPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.admin) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <T2iTesterClient />
    </div>
  );
}
