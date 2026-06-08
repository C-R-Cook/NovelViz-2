import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@db";
import { redirect } from "next/navigation";
import { FeaturedSettingsClient } from "./featured-settings-client";

export const metadata = {
  title: "Featured Scoring | NovelViz Admin",
};

export default async function FeaturedSettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.admin) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">Admin</p>
        <h1 className="text-2xl font-semibold text-text-primary">Featured scoring</h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          Tune how featured books are ranked against reader preferences and partner audience targeting.
          Changes apply site-wide within about 60 seconds.
        </p>
      </header>
      <FeaturedSettingsClient />
    </div>
  );
}
