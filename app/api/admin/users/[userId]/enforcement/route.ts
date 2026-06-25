import { requireAdminApi } from "@/lib/admin-auth";
import {
  AccountEnforcementError,
  denyAppealAndTerminate,
  getModerationLogsForUser,
  restoreAccount,
  suspendAccount,
  terminateAccount,
} from "@/lib/account-enforcement";
import { ModerationLogSource } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ userId: string }> };

type EnforcementAction =
  | "suspend"
  | "terminate"
  | "restore"
  | "approve_appeal"
  | "deny_appeal";

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { userId } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action as EnforcementAction | undefined;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const resolutionNote =
    typeof body.resolutionNote === "string" ? body.resolutionNote.trim() : undefined;

  if (
    !action ||
    !["suspend", "terminate", "restore", "approve_appeal", "deny_appeal"].includes(action)
  ) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    switch (action) {
      case "suspend":
        await suspendAccount(userId, reason || "Suspended by admin", {
          source: ModerationLogSource.admin,
          summary: reason || "Suspended by admin",
          createdBy: auth.user.id,
        });
        break;
      case "terminate":
        await terminateAccount(userId, reason || "Terminated by admin", {
          logEntry: {
            source: ModerationLogSource.admin,
            summary: reason || "Terminated by admin",
            createdBy: auth.user.id,
          },
        });
        break;
      case "restore":
      case "approve_appeal":
        await restoreAccount(
          userId,
          auth.user.id,
          resolutionNote ?? "Appeal approved by admin",
        );
        break;
      case "deny_appeal":
        await denyAppealAndTerminate(
          userId,
          auth.user.id,
          resolutionNote ?? (reason || "Appeal denied by admin"),
        );
        break;
    }
  } catch (err) {
    if (err instanceof AccountEnforcementError) {
      const status = err.code === "not_found" ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("[api/admin/users/enforcement] POST failed", err);
    return NextResponse.json({ error: "Enforcement action failed" }, { status: 500 });
  }

  const [logs] = await Promise.all([getModerationLogsForUser(userId, 20)]);

  return NextResponse.json({
    success: true,
    moderationLogs: logs.map((log) => ({
      id: log.id,
      source: log.source,
      aupCategory: log.aupCategory,
      summary: log.summary,
      createdAt: log.createdAt.toISOString(),
      flaggedBy: log.flaggedBy
        ? {
            id: log.flaggedBy.id,
            username: log.flaggedBy.username,
            email: log.flaggedBy.email,
          }
        : null,
    })),
  });
}
