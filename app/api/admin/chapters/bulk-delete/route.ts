import {
  deleteMatchingChaptersAcrossPendingReviewBooks,
  searchPendingReviewBooksByChapterTitle,
} from "@/lib/admin-bulk-chapter-delete-pending";
import { ChapterDeleteError } from "@/lib/admin-chapter-delete";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (user.role !== UserRole.admin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

/** Search pending-review books with chapters whose title contains `q`. */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const result = await searchPendingReviewBooksByChapterTitle(q);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ChapterDeleteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[bulk-chapter-delete-search] failed", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { titleQuery, bookIds } = body as { titleQuery?: unknown; bookIds?: unknown };
  if (typeof titleQuery !== "string") {
    return NextResponse.json({ error: "titleQuery is required" }, { status: 400 });
  }
  if (!Array.isArray(bookIds)) {
    return NextResponse.json({ error: "bookIds must be an array" }, { status: 400 });
  }

  try {
    const result = await deleteMatchingChaptersAcrossPendingReviewBooks(
      bookIds as string[],
      titleQuery,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ChapterDeleteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[bulk-chapter-delete] failed", err);
    const message = err instanceof Error ? err.message : "Bulk delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
