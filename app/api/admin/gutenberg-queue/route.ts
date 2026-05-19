import { getCurrentUser } from "@/lib/auth";
import { clearQueueEntryManualUpload } from "@/scripts/lib/gutenberg-queue-flags";
import type { QueueEntry } from "@/scripts/lib/gutenberg-types";
import { UserRole } from "@db";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const QUEUE_PATH = path.join(process.cwd(), "scripts", "gutenberg-queue.json");

function readQueueFile(): unknown | null {
  if (!fs.existsSync(QUEUE_PATH)) return null;
  const raw = fs.readFileSync(QUEUE_PATH, "utf8");
  return JSON.parse(raw) as unknown;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== UserRole.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const queue = readQueueFile();
  if (!queue) {
    return NextResponse.json({ exists: false });
  }
  return NextResponse.json(queue);
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== UserRole.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates = (body as { updates?: unknown }).updates;
  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "updates array required" }, { status: 400 });
  }

  const queue = readQueueFile() as { entries: QueueEntry[] } | null;

  if (!queue || !Array.isArray(queue.entries)) {
    return NextResponse.json({ error: "Queue file not found" }, { status: 404 });
  }

  const approvalMap = new Map<number, boolean>();
  const clearManualIds = new Set<number>();

  for (const u of updates) {
    if (typeof u !== "object" || u === null) continue;
    const gutenbergId = (u as { gutenbergId?: unknown }).gutenbergId;
    if (typeof gutenbergId !== "number") continue;

    const approved = (u as { approved?: unknown }).approved;
    if (typeof approved === "boolean") {
      approvalMap.set(gutenbergId, approved);
    }

    if ((u as { clearManualUpload?: unknown }).clearManualUpload === true) {
      clearManualIds.add(gutenbergId);
    }
  }

  for (const entry of queue.entries) {
    const approved = approvalMap.get(entry.gutenbergId);
    if (approved !== undefined) {
      entry.approved = approved;
    }
    if (clearManualIds.has(entry.gutenbergId)) {
      clearQueueEntryManualUpload(entry);
    }
  }

  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2), "utf8");

  let approvedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;
  for (const entry of queue.entries) {
    if (entry.approved === true) approvedCount += 1;
    else if (entry.approved === false) rejectedCount += 1;
    else pendingCount += 1;
  }

  return NextResponse.json({
    ok: true,
    approvedCount,
    rejectedCount,
    pendingCount,
    totalEntries: queue.entries.length,
  });
}
