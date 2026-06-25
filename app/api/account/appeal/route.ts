import { getCurrentUser } from "@/lib/auth";
import {
  AccountEnforcementError,
  getModerationLogsForUser,
  submitAccountAppeal,
} from "@/lib/account-enforcement";
import {
  absoluteAppUrl,
  AdminEmailCategory,
  sendAdminEmail,
} from "@/lib/admin-email";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message =
    body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
      ? (body as { message: string }).message
      : "";

  try {
    await submitAccountAppeal(session.id, message);
  } catch (err) {
    if (err instanceof AccountEnforcementError) {
      const status =
        err.code === "appeal_already_pending" ? 409 : err.code === "not_found" ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("[api/account/appeal] POST failed", err);
    return NextResponse.json({ error: "Could not submit appeal" }, { status: 500 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, username: true, statusReason: true },
  });
  const logs = await getModerationLogsForUser(session.id, 10);
  const strikeSummary =
    logs.length === 0
      ? "No strike history recorded"
      : logs
          .map((log) => {
            const parts = [new Date(log.createdAt).toISOString()];
            if (log.aupCategory) parts.push(`category: ${log.aupCategory}`);
            if (log.summary) parts.push(log.summary);
            return `- ${parts.join(" | ")}`;
          })
          .join("\n");

  sendAdminEmail({
    category: AdminEmailCategory.ACCOUNT_APPEAL,
    subjectDetail: user?.username ?? user?.email ?? session.id,
    replyTo: user?.email,
    bodyLines: [
      { label: "User ID", value: session.id },
      { label: "Email", value: user?.email ?? "—" },
      { label: "Username", value: user?.username ?? "—" },
      { label: "Suspension reason", value: user?.statusReason ?? "—" },
      { label: "Strike history", value: strikeSummary },
      { label: "Appeal message", value: message.trim() },
      { label: "Admin user page", value: absoluteAppUrl(`/admin/users/${session.id}`) },
    ],
  });

  return NextResponse.json({ success: true });
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await prisma.moderationAppeal.count({
    where: { userId: session.id, status: "pending" },
  });

  return NextResponse.json({ hasPendingAppeal: pending > 0 });
}
