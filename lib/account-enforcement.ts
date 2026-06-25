import { forfeitCreditsOnTermination } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import {
  AccountStatus,
  ModerationAppealStatus,
  ModerationLogSource,
  type Prisma,
} from "@db";

export class AccountEnforcementError extends Error {
  readonly code:
    | "not_found"
    | "invalid_transition"
    | "self_delete_blocked"
    | "appeal_not_allowed"
    | "appeal_already_pending";

  constructor(
    message: string,
    code:
      | "not_found"
      | "invalid_transition"
      | "self_delete_blocked"
      | "appeal_not_allowed"
      | "appeal_already_pending",
  ) {
    super(message);
    this.name = "AccountEnforcementError";
    this.code = code;
  }
}

export type ModerationLogInput = {
  source: ModerationLogSource;
  aupCategory?: string | null;
  commentId?: string | null;
  queryId?: string | null;
  imageId?: string | null;
  summary?: string | null;
  createdBy?: string | null;
  flaggedByUserId?: string | null;
};

export type AccountEnforcementState = {
  accountStatus: AccountStatus;
  suspendedAt: Date | null;
  terminatedAt: Date | null;
  statusReason: string | null;
  strikeCount: number;
  pendingAppeal: boolean;
};

const STRIKE_SUSPEND_THRESHOLD = 7;

export async function getAccountEnforcementState(
  userId: string,
): Promise<AccountEnforcementState | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accountStatus: true,
      suspendedAt: true,
      terminatedAt: true,
      statusReason: true,
    },
  });
  if (!user) return null;

  const [strikeCount, pendingAppealCount] = await Promise.all([
    prisma.moderationLog.count({ where: { userId } }),
    prisma.moderationAppeal.count({
      where: { userId, status: ModerationAppealStatus.pending },
    }),
  ]);

  return {
    ...user,
    strikeCount,
    pendingAppeal: pendingAppealCount > 0,
  };
}

export function getEnforcementRedirectPath(status: AccountStatus): string | null {
  if (status === AccountStatus.suspended) return "/account/suspended";
  if (status === AccountStatus.terminated) return "/account/terminated";
  return null;
}

async function createModerationLog(
  userId: string,
  entry: ModerationLogInput,
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.moderationLog.create({
    data: {
      userId,
      source: entry.source,
      aupCategory: entry.aupCategory ?? null,
      commentId: entry.commentId ?? null,
      queryId: entry.queryId ?? null,
      imageId: entry.imageId ?? null,
      summary: entry.summary ?? null,
      createdBy: entry.createdBy ?? null,
      flaggedByUserId: entry.flaggedByUserId ?? null,
    },
  });
}

export async function recordModerationLog(
  userId: string,
  entry: ModerationLogInput,
): Promise<void> {
  await createModerationLog(userId, entry, prisma);
}

/** Future content-moderation hook: auto-suspend at strike threshold. */
export async function checkStrikeThresholdAndSuspend(userId: string): Promise<boolean> {
  const state = await getAccountEnforcementState(userId);
  if (!state || state.accountStatus !== AccountStatus.active) return false;
  if (state.strikeCount < STRIKE_SUSPEND_THRESHOLD) return false;
  await suspendAccount(userId, `Reached ${STRIKE_SUSPEND_THRESHOLD} strikes`, {
    source: ModerationLogSource.system,
    summary: `Automatic suspension at ${STRIKE_SUSPEND_THRESHOLD} strikes`,
  });
  return true;
}

export async function suspendAccount(
  userId: string,
  reason: string,
  logEntry?: ModerationLogInput,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { accountStatus: true },
    });
    if (!user) throw new AccountEnforcementError("User not found", "not_found");
    if (user.accountStatus === AccountStatus.terminated) {
      throw new AccountEnforcementError(
        "Cannot suspend a permanently terminated account",
        "invalid_transition",
      );
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        accountStatus: AccountStatus.suspended,
        suspendedAt: new Date(),
        statusReason: reason,
      },
    });

    if (logEntry) {
      await createModerationLog(userId, logEntry, tx);
    }
  });
}

export async function terminateAccount(
  userId: string,
  reason: string,
  options?: { logEntry?: ModerationLogInput; resolvedBy?: string | null },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { accountStatus: true },
    });
    if (!user) throw new AccountEnforcementError("User not found", "not_found");
    if (user.accountStatus === AccountStatus.terminated) return;

    await tx.user.update({
      where: { id: userId },
      data: {
        accountStatus: AccountStatus.terminated,
        terminatedAt: new Date(),
        statusReason: reason,
      },
    });

    if (options?.logEntry) {
      await createModerationLog(userId, options.logEntry, tx);
    }
  });

  await forfeitCreditsOnTermination(userId, reason);
}

export async function restoreAccount(
  userId: string,
  resolvedBy?: string | null,
  resolutionNote?: string | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { accountStatus: true },
    });
    if (!user) throw new AccountEnforcementError("User not found", "not_found");
    if (user.accountStatus === AccountStatus.terminated) {
      throw new AccountEnforcementError(
        "Cannot restore a permanently terminated account",
        "invalid_transition",
      );
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        accountStatus: AccountStatus.active,
        suspendedAt: null,
        terminatedAt: null,
        statusReason: null,
      },
    });

    await tx.moderationAppeal.updateMany({
      where: { userId, status: ModerationAppealStatus.pending },
      data: {
        status: ModerationAppealStatus.approved,
        resolvedAt: new Date(),
        resolvedBy: resolvedBy ?? null,
        resolutionNote: resolutionNote ?? "Appeal approved",
      },
    });
  });
}

export async function denyAppealAndTerminate(
  userId: string,
  resolvedBy: string,
  resolutionNote?: string | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.moderationAppeal.updateMany({
      where: { userId, status: ModerationAppealStatus.pending },
      data: {
        status: ModerationAppealStatus.denied,
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNote: resolutionNote ?? "Appeal denied",
      },
    });
  });

  await terminateAccount(userId, resolutionNote ?? "Appeal denied", {
    logEntry: {
      source: ModerationLogSource.admin,
      summary: "Account terminated after appeal denial",
      createdBy: resolvedBy,
    },
    resolvedBy,
  });
}

export async function assertCanSelfDelete(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountStatus: true },
  });
  if (!user) throw new AccountEnforcementError("User not found", "not_found");
  if (
    user.accountStatus === AccountStatus.suspended ||
    user.accountStatus === AccountStatus.terminated
  ) {
    throw new AccountEnforcementError(
      "Your account is suspended or permanently terminated and cannot be deleted through self-service. Please contact support.",
      "self_delete_blocked",
    );
  }
}

export async function submitAccountAppeal(
  userId: string,
  userMessage: string,
): Promise<void> {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    throw new AccountEnforcementError("Appeal message is required", "appeal_not_allowed");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountStatus: true, email: true, username: true },
  });
  if (!user) throw new AccountEnforcementError("User not found", "not_found");
  if (user.accountStatus !== AccountStatus.suspended) {
    throw new AccountEnforcementError(
      "Appeals are only available for suspended accounts",
      "appeal_not_allowed",
    );
  }

  const pending = await prisma.moderationAppeal.count({
    where: { userId, status: ModerationAppealStatus.pending },
  });
  if (pending > 0) {
    throw new AccountEnforcementError(
      "You already have a pending appeal",
      "appeal_already_pending",
    );
  }

  await prisma.moderationAppeal.create({
    data: {
      userId,
      userMessage: trimmed,
      status: ModerationAppealStatus.pending,
    },
  });
}

export async function getModerationLogsForUser(userId: string, limit = 20) {
  return prisma.moderationLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      flaggedBy: {
        select: { id: true, username: true, email: true },
      },
    },
  });
}

export { STRIKE_SUSPEND_THRESHOLD };
