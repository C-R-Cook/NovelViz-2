import { getCurrentUser } from "@/lib/auth";
import { getT2iOutputRoot, safeJoinUnderRoot } from "@/lib/t2i-local-output";
import { UserRole } from "@db";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== UserRole.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { path: rawSegments } = await context.params;
  if (!rawSegments?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const segments = rawSegments.map((s) => decodeURIComponent(s));
  const root = getT2iOutputRoot();
  const abs = safeJoinUnderRoot(root, ...segments);
  if (!abs) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const buf = await readFile(abs);
    const lower = abs.toLowerCase();
    const type = lower.endsWith(".png") ? "image/png" : lower.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
