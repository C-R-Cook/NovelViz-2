import ContentTestToolClient from "@/app/admin/content-test-tool/content-test-tool-client";
import { getCurrentUser } from "@/lib/auth";
import { isContentTestMode } from "@/lib/content-test-mode";
import { UserRole } from "@db";
import { redirect } from "next/navigation";

export default async function ContentTestToolPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.admin) {
    redirect("/dashboard");
  }

  const contentTestActive = isContentTestMode();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Content test tool</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-secondary">
          Exercise production <code className="text-xs">/api/query</code> and{" "}
          <code className="text-xs">/api/imagine</code> routes against CONTENT_TEST guards and
          moderation stubs.
        </p>
      </header>

      <div className="space-y-2">
        {contentTestActive ? (
          <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-sm font-medium text-amber-200">
            CONTENT_TEST active — supplier calls stubbed
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-border bg-bg-surface/80 px-3 py-1 text-sm text-text-muted">
            CONTENT_TEST off — live supplier calls (if API keys set)
          </span>
        )}
        <p className="text-xs text-text-muted">
          Env file changes require a dev server restart to take effect.
        </p>
      </div>

      <ContentTestToolClient contentTestActive={contentTestActive} />
    </div>
  );
}
