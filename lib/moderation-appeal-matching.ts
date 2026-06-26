type ModerationLogLike = {
  id: string;
  createdAt: string | Date;
  summary: string | null;
};

type ModerationAppealLike = {
  id: string;
  createdAt: string | Date;
  moderationLogId?: string | null;
};

function toTimestamp(value: string | Date): number {
  return new Date(value).getTime();
}

function isSuspensionRelatedLog(log: ModerationLogLike): boolean {
  const summary = log.summary?.toLowerCase() ?? "";
  return summary.includes("suspend") || summary.includes("terminated");
}

function inferAppealLogId<TLog extends ModerationLogLike>(
  appeal: ModerationAppealLike,
  logs: TLog[],
): string | null {
  const appealTime = toTimestamp(appeal.createdAt);
  const sortedLogs = [...logs].sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));
  const preceding = sortedLogs.filter((log) => toTimestamp(log.createdAt) <= appealTime);

  const suspensionLogs = preceding.filter(isSuspensionRelatedLog);
  const matched =
    suspensionLogs.length > 0
      ? suspensionLogs[suspensionLogs.length - 1]
      : preceding.length > 0
        ? preceding[preceding.length - 1]
        : null;

  return matched?.id ?? null;
}

/** Group appeals under their linked strike, falling back to inference for legacy rows. */
export function groupAppealsByModerationLog<
  TAppeal extends ModerationAppealLike,
  TLog extends ModerationLogLike,
>(appeals: TAppeal[], logs: TLog[]): { byLogId: Map<string, TAppeal[]>; unmatched: TAppeal[] } {
  const byLogId = new Map<string, TAppeal[]>();
  const unmatched: TAppeal[] = [];
  const logIds = new Set(logs.map((log) => log.id));

  for (const appeal of appeals) {
    const linkedLogId =
      appeal.moderationLogId && logIds.has(appeal.moderationLogId)
        ? appeal.moderationLogId
        : inferAppealLogId(appeal, logs);

    if (!linkedLogId) {
      unmatched.push(appeal);
      continue;
    }

    const existing = byLogId.get(linkedLogId) ?? [];
    existing.push(appeal);
    byLogId.set(linkedLogId, existing);
  }

  return { byLogId, unmatched };
}
