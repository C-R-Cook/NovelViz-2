import { BulkChapterDeletePendingClient } from "@/app/admin/chapters/bulk-delete/bulk-chapter-delete-pending-client";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@db";
import { redirect } from "next/navigation";

export default async function BulkChapterDeletePendingPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.admin) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">Admin · Helpers</p>
        <h1 className="font-serif text-2xl font-semibold text-text-primary">Bulk chapter delete</h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          Search <span className="font-medium text-text-primary">pending review</span> books for chapters
          whose titles contain a phrase (e.g. &ldquo;Contents&rdquo;), select the books to clean up, then
          delete all matching chapters on those books. At least one chapter must remain on each book.
        </p>
      </header>
      <BulkChapterDeletePendingClient />
    </div>
  );
}
