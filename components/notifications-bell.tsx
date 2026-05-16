"use client";

import { Bell, BookOpen, MessageCircle, Star } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type NotificationRow = {
  id: string;
  type: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
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
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function NotificationGlyph({ type }: { type: string }) {
  const cls = "h-4 w-4 shrink-0 text-text-muted";
  if (type === "BOOK_APPROVED" || type === "BOOK_REJECTED") {
    return <BookOpen className={cls} strokeWidth={2} aria-hidden />;
  }
  if (type === "FEATURE_REQUEST_APPROVED" || type === "FEATURE_REQUEST_REJECTED") {
    return <Star className={cls} strokeWidth={2} aria-hidden />;
  }
  if (
    type === "COMMENT_HIDDEN_PENDING" ||
    type === "COMMENT_REINSTATED" ||
    type === "COMMENT_FLAGGED_FOR_MODERATION" ||
    type === "COMMENT_REPORTED_TO_AUTHOR" ||
    type === "COMMENT_FLAGGED_RESTORED" ||
    type === "COMMENT_FLAGGED_REMOVED" ||
    type === "COMMENT_RELEASED" ||
    type === "COMMENT_SPOILER_REMOVED" ||
    type === "COMMENT_SPOILER_CONFIRMED_GATED"
  ) {
    return <MessageCircle className={cls} strokeWidth={2} aria-hidden />;
  }
  return <Bell className={cls} strokeWidth={2} aria-hidden />;
}

export function NotificationsBell() {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.status === 401) return;
      if (!res.ok) {
        setLoadError("Could not load notifications");
        return;
      }
      setLoadError(null);
      const data = (await res.json()) as { notifications?: NotificationRow[]; count?: number };
      setItems(data.notifications ?? []);
      setUnreadCount(typeof data.count === "number" ? data.count : 0);
    } catch {
      setLoadError("Could not load notifications");
    }
  }, []);

  useEffect(() => {
    const tick = () => void fetchNotifications();
    queueMicrotask(tick);
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [fetchNotifications]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    queueMicrotask(() => setOpen(false));
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  async function markAllRead() {
    try {
      await fetch("/api/notifications/read-all", { method: "PATCH" });
      setUnreadCount(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      /* ignore */
    }
  }

  async function clearAll() {
    if (!items.length) return;
    if (
      !window.confirm("Clear all notifications? This cannot be undone.")
    ) {
      return;
    }
    try {
      const res = await fetch("/api/notifications", { method: "DELETE" });
      if (!res.ok) return;
      setItems([]);
      setUnreadCount(0);
      setLoadError(null);
    } catch {
      /* ignore */
    }
  }

  function onBellClick() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    void (async () => {
      await markAllRead();
      await fetchNotifications();
    })();
  }

  const animClass = reducedMotion ? "" : "transition duration-200 ease-out";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-bg-surface/80 text-text-primary shadow-inner transition hover:bg-bg-raised hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Notifications"
        onClick={onBellClick}
      >
        <Bell className="h-5 w-5" strokeWidth={2} aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-[1.125rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-none text-bg-base shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={`absolute right-0 top-full z-[120] mt-2 w-[min(340px,calc(100vw-2rem))] max-h-[min(70vh,28rem)] overflow-hidden rounded-lg border border-border bg-bg-surface shadow-xl ring-1 ring-bg-overlay ${animClass}`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
            <span className="text-sm font-semibold text-text-primary">Notifications</span>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
              {items.some((n) => !n.read) ? (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="text-xs font-medium text-accent-text underline-offset-2 hover:underline"
                >
                  Mark all read
                </button>
              ) : null}
              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void clearAll()}
                  className="text-xs font-medium text-text-muted underline-offset-2 hover:text-error hover:underline"
                >
                  Clear all
                </button>
              ) : null}
            </div>
          </div>
          <div className="max-h-[min(60vh,24rem)] overflow-y-auto">
            {loadError ? (
              <p className="px-3 py-6 text-center text-sm text-text-muted">{loadError}</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-text-muted">No notifications yet</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {items.map((n) => (
                  <li key={n.id}>
                    <div
                      className={`flex w-full cursor-default gap-3 px-3 py-3 text-left ${
                        !n.read ? "border-l-2 border-accent bg-bg-hover/60" : "border-l-2 border-transparent"
                      }`}
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-bg-base">
                        <NotificationGlyph type={n.type} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm leading-snug ${n.read ? "text-text-muted" : "text-text-primary"}`}
                        >
                          {n.message}
                        </span>
                        <span className="mt-1 block text-xs text-text-muted">{formatRelativeTime(n.createdAt)}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
