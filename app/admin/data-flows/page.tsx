import { DataFlowsClient } from "@/components/admin/data-flows-client";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@db";
import { redirect } from "next/navigation";

export default async function AdminDataFlowsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.admin) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Data flows</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-secondary">
          Reference diagrams for how data moves through ingest, image generation, and Q&amp;A /
          comments. Gutenberg bulk import is shown as an optional branch into the same book
          processing pipeline as manual EPUB upload.
        </p>
      </header>
      <DataFlowsClient />
    </div>
  );
}
