import { getAdminStatsPayload } from "@/lib/admin-stats";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/**
 * Aggregate platform KPIs, 30‑day charts, internal cost estimates, and optional vendor billing.
 * Vendor failures resolve to null in the payload; this handler does not intentionally 500 on vendor HTTP errors.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== UserRole.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await getAdminStatsPayload();
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[api/admin/stats]", e);
    return NextResponse.json({ error: "Failed to load admin statistics" }, { status: 500 });
  }
}
