import {
  applyOpenLibraryCoverToBook,
  listCoverRefreshCandidates,
  scanBookCoverRefresh,
  type CoverRefreshListRow,
} from "@/lib/admin-cover-refresh";
import { getCurrentUser } from "@/lib/auth";
import { BookStatus, UserRole } from "@db";
import { NextResponse } from "next/server";

export const maxDuration = 120;

const VALID_STATUSES = new Set<string>(Object.values(BookStatus));

function parseStatus(value: string | null): BookStatus {
  if (value && VALID_STATUSES.has(value)) {
    return value as BookStatus;
  }
  return "pending_review";
}

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

/** List books in the for-review (or other) queue for cover refresh. */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const status = parseStatus(url.searchParams.get("status"));
  const books = await listCoverRefreshCandidates(status);

  return NextResponse.json({ books, status });
}

type PostBody =
  | { action: "scan"; bookIds: string[] }
  | { action: "apply"; bookIds: string[] };

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action !== "scan" && body.action !== "apply") {
    return NextResponse.json({ error: "action must be scan or apply" }, { status: 400 });
  }

  const bookIds = Array.isArray(body.bookIds)
    ? [...new Set(body.bookIds.filter((id) => typeof id === "string" && id.trim()))]
    : [];

  if (bookIds.length === 0) {
    return NextResponse.json({ error: "bookIds must be a non-empty array" }, { status: 400 });
  }

  if (bookIds.length > 25) {
    return NextResponse.json({ error: "Maximum 25 books per request" }, { status: 400 });
  }

  const rows = await listCoverRefreshCandidates("pending_review");
  const byId = new Map(rows.map((b) => [b.id, b]));
  const selected: CoverRefreshListRow[] = [];
  for (const id of bookIds) {
    const row = byId.get(id);
    if (row) selected.push(row);
  }

  if (selected.length === 0) {
    return NextResponse.json({ error: "No matching pending_review books" }, { status: 404 });
  }

  if (body.action === "scan") {
    const results = [];
    for (const book of selected) {
      results.push(await scanBookCoverRefresh(book));
    }
    return NextResponse.json({ action: "scan", results });
  }

  const results = [];
  for (const book of selected) {
    results.push(await applyOpenLibraryCoverToBook(book));
  }
  return NextResponse.json({ action: "apply", results });
}
