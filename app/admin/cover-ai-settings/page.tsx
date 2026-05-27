import { getCoverAiAdminSettings } from "@/lib/cover-ai-settings";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@db";
import { redirect } from "next/navigation";
import { CoverAiSettingsClient } from "./cover-ai-settings-client";

export default async function CoverAiSettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.admin) {
    redirect("/dashboard");
  }

  const initial = await getCoverAiAdminSettings();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">Admin</p>
        <h1 className="text-2xl font-semibold text-text-primary">Cover AI settings</h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          Edit the hidden default prompt blocks and the list of allowed fal.ai models used by the publisher
          cover generator.
        </p>
      </header>

      <CoverAiSettingsClient initial={initial} />
    </div>
  );
}

