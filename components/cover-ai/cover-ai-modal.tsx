"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImageGenerationLoader } from "@/components/ui/image-generation-loader";

const CAROUSEL_MAX = 5;

type DraftSlide =
  | { kind: "loading"; slotId: string }
  | { kind: "ready"; slotId: string; imageUrl: string; publicId: string };

function readySlideCount(slides: DraftSlide[]): number {
  return slides.filter((s) => s.kind === "ready").length;
}

type ConfigResponse = {
  models: Array<{ key: string; label: string }>;
  defaultModelKey: string;
  suggestionTitle: string;
  suggestionAuthor: string;
  coverGenAttemptsConsumed: number;
  coverGenAttemptsGranted: number;
  remainingAttempts: number;
  quotaExempt: boolean;
  hasPendingQuotaRequest: boolean;
};

type Props = {
  bookId: string;
  open: boolean;
  onClose: () => void;
  /** When true, hide partner quota UI (admins are always exempt server-side). */
  quotaExempt: boolean;
  /** When set (e.g. after create-book), empty overlay fields skip title/author prompt blocks. */
  overlayIncludes?: { title: boolean; author: boolean };
  onCommitted?: (coverImageUrl: string) => void;
};

function confirmLeave(message: string): boolean {
  return typeof window !== "undefined" && window.confirm(message);
}

export function CoverAiModal({
  bookId,
  open,
  onClose,
  quotaExempt: quotaExemptProp,
  overlayIncludes,
  onCommitted,
}: Props) {
  const [configReady, setConfigReady] = useState(false);
  const [quotaExempt, setQuotaExempt] = useState(quotaExemptProp);
  const [models, setModels] = useState<Array<{ key: string; label: string }>>([]);
  const [modelKey, setModelKey] = useState("");
  const [publisherPrompt, setPublisherPrompt] = useState("");
  const [overlayTitle, setOverlayTitle] = useState("");
  const [overlayAuthor, setOverlayAuthor] = useState("");
  const [granted, setGranted] = useState<number | null>(null);
  const [slides, setSlides] = useState<DraftSlide[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [hasPendingQuotaRequest, setHasPendingQuotaRequest] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestMsg, setRequestMsg] = useState<string | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const [hasChargedGenerationThisSession, setHasChargedGenerationThisSession] = useState(false);

  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  const generatingRef = useRef(generating);
  generatingRef.current = generating;
  const touchStartXRef = useRef<number | null>(null);

  const loadConfig = useCallback(async () => {
    const res = await fetch(`/api/books/${bookId}/cover-ai/config`);
    const data = (await res.json().catch(() => ({}))) as ConfigResponse & { error?: string };
    if (!res.ok) {
      throw new Error(data.error || res.statusText);
    }
    setModels(data.models ?? []);
    const def = data.defaultModelKey || data.models?.[0]?.key || "";
    setModelKey(def);
    setQuotaExempt(Boolean(data.quotaExempt));
    setGranted(
      typeof data.coverGenAttemptsGranted === "number" ? data.coverGenAttemptsGranted : null,
    );
    setRemainingAttempts(
      typeof data.remainingAttempts === "number" ? data.remainingAttempts : null,
    );
    setHasPendingQuotaRequest(Boolean(data.hasPendingQuotaRequest));
    const suggestionTitle = data.suggestionTitle ?? "";
    const suggestionAuthor = data.suggestionAuthor ?? "";
    setOverlayTitle(
      overlayIncludes && !overlayIncludes.title ? "" : suggestionTitle,
    );
    setOverlayAuthor(
      overlayIncludes && !overlayIncludes.author ? "" : suggestionAuthor,
    );
    setConfigReady(true);
  }, [bookId, quotaExemptProp, overlayIncludes]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRequestMsg(null);
    setConfigReady(false);
    void loadConfig().catch((e) => {
      setError(e instanceof Error ? e.message : "Could not load cover AI settings");
    });
  }, [open, loadConfig]);

  useEffect(() => {
    if (!open) return;
    // Fresh session each time dialog opens.
    setHasChargedGenerationThisSession(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (slidesRef.current.length > 0 || generatingRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [open]);

  async function discardAllDrafts(ids: string[]) {
    if (ids.length === 0) return;
    try {
      await fetch(`/api/books/${bookId}/cover-ai/discard-drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicIds: ids }),
      });
    } catch {
      // best-effort
    }
  }

  const handleClose = useCallback(() => {
    const leave =
      slides.length > 0 || generating || hasChargedGenerationThisSession
        ? confirmLeave(
            "Close without choosing a cover? Generated preview images are not saved. " +
              "Successful generations still count toward this book’s allowance.",
          )
        : true;
    if (!leave) return;
    void discardAllDrafts(
      slides.filter((s) => s.kind === "ready").map((s) => s.publicId),
    );
    setSlides([]);
    setCarouselIndex(0);
    setGenerating(false);
    setError(null);
    setRequestMsg(null);
    setConfigReady(false);
    onClose();
  }, [slides, generating, hasChargedGenerationThisSession, onClose, bookId]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  async function runGenerate() {
    if (generating || !modelKey) return;
    if (readySlideCount(slides) >= CAROUSEL_MAX) {
      setError(
        `You can keep at most ${CAROUSEL_MAX} previews. Choose one as the cover or discard some by closing.`,
      );
      return;
    }
    if (!quotaExempt && (remainingAttempts === null || remainingAttempts <= 0)) {
      setError("No cover generations remaining for this book.");
      return;
    }
    const slotId = crypto.randomUUID();
    setGenerating(true);
    setError(null);
    setSlides((prev) => {
      const merged: DraftSlide[] = [...prev, { kind: "loading", slotId }];
      setCarouselIndex(merged.length - 1);
      return merged;
    });
    try {
      const res = await fetch(`/api/books/${bookId}/cover-ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelKey,
          publisherPrompt,
          overlayTitle,
          overlayAuthor,
          quotaExempt,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        imageUrl?: string;
        publicId?: string;
        remainingAttempts?: number | null;
      };
      if (!res.ok) {
        if (data.code === "COVER_AI_QUOTA_EXHAUSTED") {
          setRemainingAttempts(0);
        }
        throw new Error(data.error || res.statusText);
      }
      if (!quotaExempt) {
        setHasChargedGenerationThisSession(true);
      }
      if (!data.imageUrl || !data.publicId) throw new Error("Invalid response");
      setSlides((prev) =>
        prev.map((s) =>
          s.kind === "loading" && s.slotId === slotId
            ? {
                kind: "ready",
                slotId,
                imageUrl: data.imageUrl!,
                publicId: data.publicId!,
              }
            : s,
        ),
      );
      if (!quotaExempt && typeof data.remainingAttempts === "number") {
        setRemainingAttempts(data.remainingAttempts);
      }
    } catch (e) {
      setSlides((prev) => prev.filter((s) => !(s.kind === "loading" && s.slotId === slotId)));
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function commitChosen() {
    const slide = slides[carouselIndex];
    if (!slide || slide.kind !== "ready" || committing) return;
    setCommitting(true);
    setError(null);
    try {
      const discard = slides
        .filter((s): s is Extract<DraftSlide, { kind: "ready" }> => s.kind === "ready")
        .filter((s) => s.publicId !== slide.publicId)
        .map((s) => s.publicId);
      const res = await fetch(`/api/books/${bookId}/cover-ai/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chosenPublicId: slide.publicId,
          chosenImageUrl: slide.imageUrl,
          discardPublicIds: discard,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; coverImageUrl?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      if (!data.coverImageUrl || typeof data.coverImageUrl !== "string") {
        throw new Error("Commit succeeded but did not return cover URL");
      }
      setSlides([]);
      setCarouselIndex(0);
      setConfigReady(false);
      onCommitted?.(data.coverImageUrl);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set cover");
    } finally {
      setCommitting(false);
    }
  }

  async function requestMore() {
    setRequestBusy(true);
    setRequestMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/books/${bookId}/cover-ai/request-more`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        alreadyPending?: boolean;
      };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setHasPendingQuotaRequest(true);
      setRequestMsg(
        data.alreadyPending
          ? "You already have a pending request. We will notify you when more generations are added."
          : "Request sent. Our team may grant additional generations for this title.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setRequestBusy(false);
    }
  }

  useEffect(() => {
    setCarouselIndex((i) => Math.min(i, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  const atQuota = !quotaExempt && remainingAttempts !== null && remainingAttempts <= 0;
  const canGenerateMore =
    quotaExempt ||
    (remainingAttempts !== null &&
      remainingAttempts > 0 &&
      readySlideCount(slides) < CAROUSEL_MAX);

  const currentSlide = slides[carouselIndex] ?? null;
  const currentReadySlide = currentSlide?.kind === "ready" ? currentSlide : null;

  if (!open) return null;

  const inputClass =
    "mt-1 w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-text-muted";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-bg-overlay/75 p-3 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cover-ai-heading"
        className="relative flex max-h-[min(94vh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-bg-surface px-4 py-3">
          <h2 id="cover-ai-heading" className="text-lg font-semibold text-text-primary">
            AI cover
          </h2>
          <button
            type="button"
            onClick={() => handleClose()}
            className="rounded-lg px-2 py-1 text-sm text-text-muted transition hover:bg-bg-raised hover:text-text-primary"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          {!configReady ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : (
            <>
              {!quotaExempt && remainingAttempts !== null && granted !== null ? (
                <p className="text-xs text-text-secondary">
                  Generations remaining for this book: <strong>{remainingAttempts}</strong> (of{" "}
                  {granted} included in your allowance; used attempts stay on record).
                </p>
              ) : null}

              {atQuota && !quotaExempt ? (
                <div className="space-y-2 rounded-lg border border-border bg-bg-base/90 p-3">
                  <p className="text-sm text-text-primary">
                    You have used every cover generation included for this book. You can ask our team for
                    more.
                  </p>
                  <button
                    type="button"
                    disabled={hasPendingQuotaRequest || requestBusy}
                    onClick={() => void requestMore()}
                    className="rounded-lg bg-accent-muted px-3 py-2 text-sm font-medium text-text-primary ring-1 ring-accent/40 transition hover:bg-accent-hover/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {hasPendingQuotaRequest ? "Request already sent" : "Request more generations"}
                  </button>
                  {requestMsg ? <p className="text-xs text-success">{requestMsg}</p> : null}
                </div>
              ) : null}

              <label className={labelClass}>
                Your description <span className="font-normal lowercase text-text-muted">(required)</span>
                <textarea
                  value={publisherPrompt}
                  onChange={(e) => setPublisherPrompt(e.target.value)}
                  rows={4}
                  className={inputClass}
                  placeholder="Scene, mood, palette, era, symbols…"
                  disabled={generating || committing}
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  Book title on cover <span className="text-text-muted">(optional)</span>
                  <input
                    type="text"
                    value={overlayTitle}
                    onChange={(e) => setOverlayTitle(e.target.value)}
                    className={inputClass}
                    disabled={generating || committing}
                  />
                </label>
                <label className={labelClass}>
                  Author on cover <span className="text-text-muted">(optional)</span>
                  <input
                    type="text"
                    value={overlayAuthor}
                    onChange={(e) => setOverlayAuthor(e.target.value)}
                    className={inputClass}
                    disabled={generating || committing}
                  />
                </label>
              </div>

              <label className={labelClass}>
                Model
                <select
                  value={modelKey}
                  onChange={(e) => setModelKey(e.target.value)}
                  className={`${inputClass} bg-bg-surface`}
                  disabled={generating || committing}
                >
                  {models.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void runGenerate()}
                  disabled={generating || committing || !canGenerateMore}
                  className="rounded-lg bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary ring-1 ring-accent/40 transition hover:bg-accent-hover/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {readySlideCount(slides) === 0 ? "Generate" : "Regenerate (add another)"}
                </button>
                {currentReadySlide ? (
                  <button
                    type="button"
                    onClick={() => void commitChosen()}
                    disabled={committing || generating}
                    className="rounded-lg bg-success/20 px-4 py-2 text-sm font-medium text-text-primary ring-1 ring-success/40 transition hover:bg-success/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {committing ? "Saving cover…" : "Use this as cover"}
                  </button>
                ) : null}
              </div>

              {slides.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-text-muted">
                    Preview {carouselIndex + 1} / {slides.length} (max {CAROUSEL_MAX} saved)
                  </p>
                  <div
                    className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-xl border border-border bg-bg-base"
                    onTouchStart={(e) => {
                      const t = e.touches[0];
                      touchStartXRef.current = t ? t.clientX : null;
                    }}
                    onTouchEnd={(e) => {
                      const startX = touchStartXRef.current;
                      const t = e.changedTouches[0];
                      if (startX == null || !t) return;
                      const dx = t.clientX - startX;
                      const threshold = 45;
                      if (dx < -threshold) {
                        setCarouselIndex((i) => Math.min(slides.length - 1, i + 1));
                      } else if (dx > threshold) {
                        setCarouselIndex((i) => Math.max(0, i - 1));
                      }
                      touchStartXRef.current = null;
                    }}
                  >
                    {currentSlide?.kind === "loading" ? (
                      <ImageGenerationLoader
                        className="h-full px-4"
                        ariaLabel="Generating cover image"
                      />
                    ) : currentSlide?.kind === "ready" ? (
                      <Image
                        src={currentSlide.imageUrl}
                        alt=""
                        fill
                        className="object-contain"
                        unoptimized
                        sizes="(max-width: 768px) 100vw, 320px"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-primary transition hover:bg-bg-raised disabled:opacity-40"
                      disabled={carouselIndex <= 0}
                      onClick={() => setCarouselIndex((i) => Math.max(0, i - 1))}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-primary transition hover:bg-bg-raised disabled:opacity-40"
                      disabled={carouselIndex >= slides.length - 1}
                      onClick={() =>
                        setCarouselIndex((i) => Math.min(slides.length - 1, i + 1))
                      }
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}

              {error ? <p className="text-sm text-error">{error}</p> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
