import { getCurrentUser } from "@/lib/auth";
import { getUserUsageSummary } from "@/lib/subscription";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usage = await getUserUsageSummary(session.id);
  if (!usage) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ usage });
}
