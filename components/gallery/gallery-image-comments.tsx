"use client";

import "@/app/(public)/gallery/gallery-redesign.css";
import Link from "next/link";
import { CommentPendingSpoilerNotice } from "@/components/gallery/comment-pending-spoiler-notice";
import { CommentSpoilerLockOverlay } from "@/components/gallery/comment-spoiler-lock";
import { CommentSpoilerScanDebugPanel } from "@/components/gallery/comment-spoiler-scan-debug-panel";
import {
  isCommentSpoilerScanDebugUiEnabled,
  type CommentSpoilerScanDebug,
} from "@/lib/comment-spoiler-scan-debug";
import { Flag, Pencil, Trash2, Check, X, Lock, Loader2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

const showSpoilerScanDebugUi = isCommentSpoilerScanDebugUiEnabled();

const MAX = 500;

export type GalleryCommentRow = {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  username: string;
  isOwnComment: boolean;
  spoilerLocked?: boolean;
  lockMessage?: string | null;
  chapterGap?: number | null;
  spoilerGateChapter?: number | null;
  showAuthorReview?: boolean;
  showPendingSpoilerNotice?: boolean;
  showContentReviewNotice?: boolean;
  /** Author: moderator confirmed spoiler (gated for others). */
  showAuthorSpoilerConfirmedNotice?: boolean;
  noticeImageChapter?: number | null;
  spoilerScanDebug?: CommentSpoilerScanDebug | null;
  canFlag?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  /** Server: viewer is admin and this comment awaits inappropriate-content review */
  canAdminModerateContent?: boolean;
  /** Server: viewer is admin and this is a spoiler-hidden comment */
  canAdminModerateSpoiler?: boolean;
  /** Server: admin may confirm spoiler gating (not yet moderator-confirmed) */
  canAdminConfirmSpoilerGated?: boolean;
};


function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.round((then - now) / 1000);
  const abs = Math.abs(sec);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(sec / 1), "second");
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(sec / 86400), "day");
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type Props = {
  imageId: string;
  /** When true, append `session=true` to GET /api/comments (gallery session reveal parity). */
  sessionCommentsUnlocked?: boolean;
  isLoggedIn: boolean;
  /** When false, entire section is not rendered by parent. */
  canInteract: boolean;
  viewerDisplayName: string | null;
  /** Bump thumbnail badge after posting a visible comment. */
  onPostedVisibleComment?: () => void;
  /** `sidebar` = right column in image modal; `below` = under metadata (legacy). */
  layout?: "below" | "sidebar";
  className?: string;
  /** Scroll to and highlight this comment after load (e.g. admin review). */
  highlightCommentId?: string | null;
  /** Border treatment when `highlightCommentId` matches a row. */
  highlightCommentStyle?: "accent" | "flagged";
  /** Hide the post composer (read-only preview). */
  composerDisabled?: boolean;
};

export function GalleryImageComments({
  imageId,
  sessionCommentsUnlocked = false,
  isLoggedIn,
  canInteract,
  viewerDisplayName,
  onPostedVisibleComment,
  layout = "below",
  className,
  highlightCommentId = null,
  highlightCommentStyle = "accent",
  composerDisabled = false,
}: Props) {
  const sidebar = layout === "sidebar";
  const headingId = useId();
  const [comments, setComments] = useState<GalleryCommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState("");
  const [composerFocused, setComposerFocused] = useState(false);
  const [rewordingId, setRewordingId] = useState<string | null>(null);
  const [rewordDraft, setRewordDraft] = useState("");
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [spoilerScanDebugEnabled, setSpoilerScanDebugEnabled] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const sp = new URLSearchParams({ imageId });
      if (sessionCommentsUnlocked) sp.set("session", "true");
      const okRes = await fetch(`/api/comments?${sp.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!okRes.ok) {
        setFetchError("Couldn't load comments");
        setComments([]);
        return;
      }
      const data = (await okRes.json()) as {
        comments?: GalleryCommentRow[];
        spoilerScanDebugEnabled?: boolean;
      };
      setSpoilerScanDebugEnabled(!!data.spoilerScanDebugEnabled);
      setComments(data.comments ?? []);
    } catch {
      setFetchError("Couldn't load comments");
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [imageId, sessionCommentsUnlocked]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const hasPendingScan = useMemo(
    () =>
      spoilerScanDebugEnabled &&
      comments.some((c) => c.spoilerScanDebug?.outcome === "pending"),
    [comments, spoilerScanDebugEnabled],
  );

  useEffect(() => {
    if (!hasPendingScan) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(() => void loadComments(), 2500);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [hasPendingScan, loadComments]);

  useEffect(() => {
    if (!highlightCommentId || loading) return;
    const id = `gallery-comment-${highlightCommentId}`;
    const scrollToTarget = () => {
      const root = listRef.current;
      const el = root?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    const t = window.setTimeout(scrollToTarget, 80);
    return () => window.clearTimeout(t);
  }, [highlightCommentId, highlightCommentStyle, loading, comments]);

  const trimmedDraft = useMemo(() => draft.trim(), [draft]);
  const canPost = trimmedDraft.length > 0 && trimmedDraft.length <= MAX && isLoggedIn && canInteract && !posting;

  async function submitPost() {
    if (!canPost) return;
    setPostError(null);
    setPosting(true);
    const bodyText = trimmedDraft;
    const optimistic: GalleryCommentRow = {
      id: `temp-${Date.now()}`,
      content: bodyText,
      status: "VISIBLE",
      createdAt: new Date().toISOString(),
      username: viewerDisplayName?.trim() || "You",
      isOwnComment: true,
    };
    setComments((prev) => [optimistic, ...prev]);
    setDraft("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId, content: bodyText }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        createdAt?: string;
        status?: string;
        spoilerScanDebug?: CommentSpoilerScanDebug | null;
        spoilerScanDebugEnabled?: boolean;
      };
      if (!res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
        setPostError("Failed to post comment — please try again");
        return;
      }
      if (data.spoilerScanDebugEnabled) setSpoilerScanDebugEnabled(true);
      if (typeof data.id === "string" && data.createdAt) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === optimistic.id
              ? {
                  ...optimistic,
                  id: data.id!,
                  createdAt: data.createdAt!,
                  status: typeof data.status === "string" ? data.status : "VISIBLE",
                  spoilerScanDebug: data.spoilerScanDebug ?? null,
                }
              : c,
          ),
        );
        onPostedVisibleComment?.();
        if (data.spoilerScanDebug?.outcome === "pending") {
          void loadComments();
        }
      } else {
        await loadComments();
        onPostedVisibleComment?.();
      }
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      setPostError("Failed to post comment — please try again");
    } finally {
      setPosting(false);
    }
  }

  async function submitFlag(commentId: string) {
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}/flag`, { method: "POST" });
      if (res.ok) await loadComments();
    } catch {
      /* ignore */
    }
  }

  async function submitDelete(commentId: string) {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" });
      if (res.ok) await loadComments();
    } catch {
      /* ignore */
    }
  }

  async function submitReword(commentId: string) {
    const t = rewordDraft.trim();
    if (t.length < 1 || t.length > MAX) return;
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reword", content: t }),
      });
      if (!res.ok) return;
      setRewordingId(null);
      setRewordDraft("");
      await loadComments();
    } catch {
      /* ignore */
    }
  }

  async function submitAdminModerateContent(commentId: string, disposition: "restore" | "delete") {
    if (disposition === "delete" && !window.confirm("Remove this comment permanently?")) return;
    setModeratingId(commentId);
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "moderate_content", disposition }),
      });
      if (res.ok) await loadComments();
    } catch {
      /* ignore */
    } finally {
      setModeratingId(null);
    }
  }

  async function submitAdminReinstate(commentId: string) {
    setModeratingId(commentId);
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reinstate" }),
      });
      if (res.ok) await loadComments();
    } catch {
      /* ignore */
    } finally {
      setModeratingId(null);
    }
  }

  async function submitAdminConfirmSpoiler(commentId: string, disposition: "keep" | "delete") {
    if (disposition === "delete" && !window.confirm("Remove this comment as a confirmed spoiler?")) return;
    setModeratingId(commentId);
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_spoiler", disposition }),
      });
      if (res.ok) await loadComments();
    } catch {
      /* ignore */
    } finally {
      setModeratingId(null);
    }
  }

  if (!canInteract) return null;

  return (
    <section
      className={
        sidebar
          ? `flex h-full min-h-0 flex-col px-4 pt-3 pb-5 ${className ?? ""}`.trim()
          : `mt-6 border-t border-border-subtle pt-5 ${className ?? ""}`.trim()
      }
      aria-labelledby={headingId}
    >
      {sidebar ? (
        <div className="shrink-0 border-b border-border-subtle pb-2">
          <h3 id={headingId} className="text-sm font-semibold text-text-primary">
            Comments
          </h3>
        </div>
      ) : (
        <div className="gallery-section-label-row">
          <div className="gallery-section-label-text">
            <span className="gallery-section-label" id={headingId}>
              Comments
            </span>
          </div>
          <div className="gallery-section-label-line" aria-hidden />
        </div>
      )}

      <div className={sidebar ? "flex min-h-0 flex-1 flex-col gap-2 pt-2" : "mt-4 space-y-3"}>
        {fetchError ? <p className="text-sm text-error">{fetchError}</p> : null}
        {postError ? <p className="text-sm text-error">{postError}</p> : null}

        {loading ? (
          <ul
            className={
              sidebar
                ? "min-h-0 flex-1 space-y-3 overflow-y-auto"
                : "space-y-3"
            }
            aria-busy="true"
            aria-label="Loading comments"
          >
            {[0, 1, 2].map((i) => (
              <li key={i} className="animate-pulse rounded-md border border-border/60 bg-bg-base/50 p-3">
                <div className="h-3 w-24 rounded bg-text-muted/20" />
                <div className="mt-2 h-3 w-full rounded bg-text-muted/15" />
                <div className="mt-2 h-3 w-4/5 rounded bg-text-muted/15" />
              </li>
            ))}
          </ul>
        ) : comments.length === 0 ? (
          <p className="text-sm italic text-text-muted">Be the first to comment</p>
        ) : (
          <ul
            ref={listRef}
            className={sidebar ? "min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" : "max-h-64 space-y-4 overflow-y-auto pr-1"}
          >
            {comments.map((c) => {
              const highlighted = highlightCommentId != null && c.id === highlightCommentId;
              const flaggedAdmin = !!c.canAdminModerateContent;
              const spoilerAdmin = !!c.canAdminModerateSpoiler;
              const scrollMt = highlighted ? "scroll-mt-3 " : "";

              let liClass: string;
              if (highlighted && highlightCommentStyle === "flagged") {
                liClass = `${scrollMt}rounded-md border-2 border-error/65 bg-error/[0.08] px-2 py-3 ring-1 ring-error/30`;
              } else if (highlighted && highlightCommentStyle === "accent") {
                liClass = `${scrollMt}rounded-md border border-accent/50 bg-accent/10 px-2 py-3 ring-1 ring-accent/30`;
              } else if (flaggedAdmin) {
                liClass = `${highlighted ? "scroll-mt-3 " : ""}rounded-md border-2 border-error/60 bg-error/[0.07] px-2 py-3 ring-1 ring-error/25`;
              } else if (spoilerAdmin && c.canAdminConfirmSpoilerGated) {
                liClass = `${highlighted ? "scroll-mt-3 " : ""}rounded-md border-2 border-amber-400/65 bg-amber-400/[0.09] px-2 py-3 ring-1 ring-amber-400/30`;
              } else {
                liClass = "border-b border-border-subtle pb-4 last:border-b-0 last:pb-0";
              }

              const busy = moderatingId === c.id;
              const hideGenericDelete = flaggedAdmin || spoilerAdmin;
              const showToolbar =
                (c.canEdit && rewordingId !== c.id) ||
                (c.canDelete && !hideGenericDelete) ||
                (c.canFlag && isLoggedIn) ||
                flaggedAdmin ||
                spoilerAdmin;

              return (
              <li
                key={c.id}
                id={`gallery-comment-${c.id}`}
                className={liClass}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-accent-text">{c.username}</span>
                  <time className="text-xs text-text-muted" dateTime={c.createdAt}>
                    {formatRelativeTime(c.createdAt)}
                  </time>
                </div>
                {c.showContentReviewNotice ? (
                  <p className="mt-2 text-sm text-text-muted">
                    Reported for review — a moderator will decide.
                  </p>
                ) : null}
                {c.showAuthorSpoilerConfirmedNotice ? (
                  <p className="mt-2 text-sm text-text-muted">
                    A moderator confirmed this as a spoiler. It stays visible to you; other readers may see it
                    locked until chapter {c.spoilerGateChapter ?? "the flagged chapter"}.
                  </p>
                ) : null}
                {c.spoilerLocked && c.lockMessage ? (
                  <CommentSpoilerLockOverlay lockMessage={c.lockMessage} />
                ) : c.showPendingSpoilerNotice &&
                  c.noticeImageChapter != null &&
                  c.spoilerGateChapter != null ? (
                  <div className="mt-2 space-y-0">
                    <CommentPendingSpoilerNotice
                      imageChapter={c.noticeImageChapter}
                      spoilerGateChapter={c.spoilerGateChapter}
                    />
                    {c.content ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-text-primary">{c.content}</p>
                    ) : null}
                  </div>
                ) : c.showAuthorReview ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm italic text-text-muted">
                      Possible spoiler — under review. Edit or wait for a decision.
                    </p>
                    {c.content && rewordingId !== c.id ? (
                      <p className="whitespace-pre-wrap text-sm text-text-primary/90">{c.content}</p>
                    ) : null}
                  </div>
                ) : c.content && rewordingId !== c.id ? (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-text-primary">{c.content}</p>
                ) : null}
                {c.canEdit && rewordingId === c.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={rewordDraft}
                      onChange={(e) => setRewordDraft(e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      maxLength={MAX}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void submitReword(c.id)}
                        className="rounded-md border border-accent/50 bg-accent-muted px-3 py-1.5 text-sm font-semibold text-text-primary transition hover:bg-accent-hover/30"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRewordingId(null);
                          setRewordDraft("");
                        }}
                        className="text-sm text-text-muted underline-offset-2 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
                {showSpoilerScanDebugUi && spoilerScanDebugEnabled ? (
                  <CommentSpoilerScanDebugPanel debug={c.spoilerScanDebug} />
                ) : null}
                {showToolbar ? (
                  <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border-subtle/60 pt-2">
                    {flaggedAdmin ? (
                      <>
                        <button
                          type="button"
                          aria-label="Restore comment"
                          title="Restore"
                          disabled={busy}
                          onClick={() => void submitAdminModerateContent(c.id, "restore")}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-success transition hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin text-text-muted" aria-hidden />
                          ) : (
                            <Check className="h-4 w-4" aria-hidden strokeWidth={2.5} />
                          )}
                        </button>
                        <button
                          type="button"
                          aria-label="Remove comment"
                          title="Remove"
                          disabled={busy}
                          onClick={() => void submitAdminModerateContent(c.id, "delete")}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-error transition hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50"
                        >
                          <X className={`h-4 w-4 ${busy ? "opacity-40" : ""}`} aria-hidden strokeWidth={2.5} />
                        </button>
                      </>
                    ) : null}
                    {spoilerAdmin ? (
                      <>
                        <button
                          type="button"
                          aria-label="Not a spoiler — release comment"
                          title="Not a spoiler (release)"
                          disabled={busy}
                          onClick={() => void submitAdminReinstate(c.id)}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-success transition hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin text-text-muted" aria-hidden />
                          ) : (
                            <Check className="h-4 w-4" aria-hidden strokeWidth={2.5} />
                          )}
                        </button>
                        {c.canAdminConfirmSpoilerGated ? (
                          <button
                            type="button"
                            aria-label="Confirm spoiler — keep gated by chapter"
                            title="Confirm — keep gated"
                            disabled={busy}
                            onClick={() => void submitAdminConfirmSpoiler(c.id, "keep")}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-amber-400 transition hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 disabled:opacity-50"
                          >
                            <Lock className={`h-4 w-4 ${busy ? "opacity-40" : ""}`} aria-hidden strokeWidth={2.25} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          aria-label="Confirm spoiler — remove comment"
                          title="Confirm — remove"
                          disabled={busy}
                          onClick={() => void submitAdminConfirmSpoiler(c.id, "delete")}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-error transition hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50"
                        >
                          <X className={`h-4 w-4 ${busy ? "opacity-40" : ""}`} aria-hidden strokeWidth={2.5} />
                        </button>
                      </>
                    ) : null}
                    {c.canEdit && rewordingId !== c.id ? (
                      <button
                        type="button"
                        aria-label="Edit comment"
                        title="Edit comment"
                        onClick={() => {
                          setRewordingId(c.id);
                          setRewordDraft(c.content);
                        }}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-accent-text transition hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                    {c.canDelete && !hideGenericDelete ? (
                      <button
                        type="button"
                        aria-label="Delete comment"
                        title="Delete comment"
                        onClick={() => void submitDelete(c.id)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted transition hover:bg-bg-raised hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                    {c.canFlag && isLoggedIn ? (
                      <button
                        type="button"
                        aria-label="Flag comment for review"
                        title="Flag for review"
                        onClick={() => void submitFlag(c.id)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted transition hover:bg-bg-raised hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        <Flag className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
            })}
          </ul>
        )}
      </div>

      {composerDisabled ? null : (
      <div className={sidebar ? "shrink-0 border-t border-border-subtle pt-3" : "mt-5"}>
        {!isLoggedIn ? (
          <p className="text-sm text-text-muted">
            <Link href="/sign-in" className="font-medium text-accent-text underline-offset-2 hover:underline">
              Sign in to comment
            </Link>
          </p>
        ) : (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              rows={2}
              maxLength={MAX}
              placeholder="Add a comment… (no spoilers please)"
              className="w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none transition focus-visible:ring-2 focus-visible:ring-accent/40"
              disabled={posting}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              {composerFocused ? (
                <span className="text-xs text-text-muted">
                  {draft.length} / {MAX}
                </span>
              ) : (
                <span />
              )}
              <button
                type="button"
                disabled={!canPost}
                onClick={() => void submitPost()}
                className="rounded-md border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:border-border disabled:bg-bg-surface/60 disabled:text-text-muted disabled:opacity-60 enabled:border-accent enabled:bg-accent/25 enabled:text-accent enabled:hover:bg-accent/35"
              >
                Post
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </section>
  );
}
