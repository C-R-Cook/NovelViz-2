import { listCoverRefreshCandidates } from "@/lib/admin-cover-refresh";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@db";
import { redirect } from "next/navigation";
import { CoverRefreshClient } from "./cover-refresh-client";

export default async function CoverRefreshPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.admin) {
    redirect("/dashboard");
  }

  const books = await listCoverRefreshCandidates("pending_review");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">Admin</p>
        <h1 className="text-2xl font-semibold text-text-primary">Cover refresh</h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          Books in pending review often have generic Project Gutenberg cache covers. Scan matches Open
          Library artwork, select offenders, and replace covers in bulk (uploaded to Cloudinary).
        </p>
        <p className="text-xs text-text-muted">
          Likely generic = Gutendex JPEG from{" "}
          <span className="font-mono">gutenberg.org/cache/epub</span>. Replacement uses the same Open
          Library → Cloudinary path as ingest enrich.
        </p>
      </header>
      <CoverRefreshClient initialBooks={books} />
    </div>
  );
}
