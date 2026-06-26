"use client";

import {
  buildSuspensionEpisodes,
  isTerminationLog,
} from "@/lib/moderation-appeal-matching";

type ModerationLog = {
  id: string;
  source: string;
  aupCategory: string | null;
  summary: string | null;
  createdAt: string;
  flaggedBy: { id: string; username: string | null; email: string } | null;
};

type ModerationAppeal = {
  id: string;
  status: string;
  userMessage: string;
  moderationLogId: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

type Props = {
  logs: ModerationLog[];
  appealsByLogId: Map<string, ModerationAppeal[]>;
  unmatchedAppeals: ModerationAppeal[];
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function appealStatusClass(status: string): string {
  if (status === "pending") return "text-amber-400";
  if (status === "approved") return "text-success";
  return "text-error";
}

function StrikeRow({
  log,
  label,
  compact = false,
}: {
  log: ModerationLog;
  label?: string;
  compact?: boolean;
}) {
  return (
    <li className={compact ? "text-sm" : "rounded border border-border/30 bg-bg-base/40 px-3 py-2 text-sm"}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {label ? (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {label}
          </span>
        ) : null}
        <time className="text-xs text-text-muted">{formatWhen(log.createdAt)}</time>
        <span className="text-xs capitalize text-text-muted">{log.source}</span>
        {log.aupCategory ? (
          <span className="text-xs text-text-muted">{log.aupCategory}</span>
        ) : null}
      </div>
      {log.summary ? (
        <p className={`whitespace-pre-wrap text-text-primary ${compact ? "mt-0.5" : "mt-1"}`}>
          {log.summary}
        </p>
      ) : null}
      {log.flaggedBy ? (
        <p className="mt-1 text-xs text-text-muted">
          Flagged by: {log.flaggedBy.username ?? log.flaggedBy.email}
        </p>
      ) : null}
    </li>
  );
}

function EpisodeAppeals({ appeals }: { appeals: ModerationAppeal[] }) {
  if (appeals.length === 0) return null;

  return (
    <div className="mt-3 space-y-2 border-t border-inherit pt-3">
      {appeals.map((appeal) => (
        <div
          key={appeal.id}
          className="rounded-md border border-border/30 bg-bg-base/60 px-3 py-2.5 text-sm"
        >
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
            <span className="font-mono uppercase tracking-widest">User explanation</span>
            <span>{formatWhen(appeal.createdAt)}</span>
            <span className={`font-medium capitalize ${appealStatusClass(appeal.status)}`}>
              {appeal.status}
            </span>
          </p>
          <p className="mt-2 whitespace-pre-wrap text-text-primary">{appeal.userMessage}</p>
        </div>
      ))}
    </div>
  );
}

function SuspensionEpisodeCard({
  episodeNumber,
  anchorLog,
  precedingStrikes,
  appeals,
}: {
  episodeNumber: number;
  anchorLog: ModerationLog;
  precedingStrikes: ModerationLog[];
  appeals: ModerationAppeal[];
}) {
  const terminated = isTerminationLog(anchorLog);
  const shellClass = terminated
    ? "border-error/40 bg-error/[0.06]"
    : "border-amber-500/35 bg-amber-500/[0.06]";
  const headerClass = terminated
    ? "border-error/25 bg-error/[0.1] text-error"
    : "border-amber-500/25 bg-amber-500/[0.1] text-amber-400";

  return (
    <article className={`overflow-hidden rounded-lg border ${shellClass}`}>
      <header
        className={`flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 ${headerClass}`}
      >
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest">
          {terminated ? "Termination" : "Suspension"} #{episodeNumber}
        </span>
        <time className="text-xs text-text-muted">{formatWhen(anchorLog.createdAt)}</time>
      </header>

      {precedingStrikes.length > 0 ? (
        <div className="border-b border-inherit px-3 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {precedingStrikes.length} strike{precedingStrikes.length === 1 ? "" : "s"} leading up
          </p>
          <ul className="space-y-1.5">
            {precedingStrikes.map((log, index) => (
              <StrikeRow
                key={log.id}
                log={log}
                label={`Strike ${index + 1}`}
                compact
              />
            ))}
          </ul>
        </div>
      ) : null}

      <div className="px-3 py-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          {terminated ? "Termination action" : "Suspension action"}
        </p>
        <div className="mt-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
            <span className="capitalize text-text-muted">{anchorLog.source}</span>
            {anchorLog.aupCategory ? (
              <span className="text-text-muted">{anchorLog.aupCategory}</span>
            ) : null}
          </div>
          {anchorLog.summary ? (
            <p className="mt-1 whitespace-pre-wrap font-medium text-text-primary">
              {anchorLog.summary}
            </p>
          ) : null}
        </div>
        <EpisodeAppeals appeals={appeals} />
      </div>
    </article>
  );
}

export function EnforcementStrikeHistory({ logs, appealsByLogId, unmatchedAppeals }: Props) {
  const { episodes, openStrikes } = buildSuspensionEpisodes(logs, appealsByLogId);

  if (logs.length === 0 && unmatchedAppeals.length === 0) {
    return null;
  }

  if (episodes.length === 0) {
    return (
      <div className="mt-4 border-t border-border/60 pt-4">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Strike history
        </h3>
        <ul className="mt-3 space-y-2">
          {logs.map((log, index) => (
            <StrikeRow key={log.id} log={log} label={`Entry ${logs.length - index}`} />
          ))}
        </ul>
        {unmatchedAppeals.length > 0 ? (
          <UnmatchedAppeals appeals={unmatchedAppeals} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-border/60 pt-4">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
        Strike history
      </h3>
      <p className="mt-1 text-xs text-text-muted">
        Grouped by suspension cycle — newest first.
      </p>

      <div className="mt-3 space-y-4">
        {openStrikes.length > 0 ? (
          <section className="rounded-lg border border-dashed border-border/60 bg-bg-surface/30 px-3 py-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Strikes since last suspension
            </p>
            <ul className="mt-2 space-y-1.5">
              {openStrikes.map((log, index) => (
                <StrikeRow key={log.id} log={log} label={`Strike ${openStrikes.length - index}`} compact />
              ))}
            </ul>
          </section>
        ) : null}

        {episodes.map((episode, index) => (
          <SuspensionEpisodeCard
            key={episode.id}
            episodeNumber={episodes.length - index}
            anchorLog={episode.anchorLog}
            precedingStrikes={episode.precedingStrikes}
            appeals={episode.appeals}
          />
        ))}

        {unmatchedAppeals.length > 0 ? (
          <UnmatchedAppeals appeals={unmatchedAppeals} />
        ) : null}
      </div>
    </div>
  );
}

function UnmatchedAppeals({ appeals }: { appeals: ModerationAppeal[] }) {
  return (
    <section className="rounded-lg border border-border/40 bg-bg-surface/40 px-3 py-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
        Unlinked appeals
      </p>
      <div className="mt-2 space-y-2">
        {appeals.map((appeal) => (
          <div key={appeal.id} className="rounded border border-border/30 px-3 py-2 text-sm">
            <p className="text-xs text-text-muted">{formatWhen(appeal.createdAt)} · {appeal.status}</p>
            <p className="mt-1 whitespace-pre-wrap text-text-primary">{appeal.userMessage}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
