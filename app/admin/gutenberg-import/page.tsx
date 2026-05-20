import { GutenbergImportClient } from "./gutenberg-import-client";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@db";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function GutenbergImportPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.admin) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Gutenberg Import</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Review the discovery queue before running the ingestion script locally.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-text-secondary">Loading…</p>}>
        <GutenbergImportClient />
      </Suspense>
    </div>
  );
}
