"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ModalImageNavArrows } from "@/components/gallery/modal-image-nav-arrows";
import { ModalImageSwipeView } from "@/components/gallery/modal-image-swipe-view";
import { IMAGINE_FAL_DEFAULT_ADMIN_KEY, type ImagineFalModelKey } from "@/lib/imagine-fal";
import { UserRole } from "@db";

export type ReaderBook = {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
};

export type ReaderChapter = {
  id: string;
  sequenceNumber: number;
  title: string | null;
};

export type ReaderProgress = {
  currentChapterId: string;
  currentChapterNumber: number;
};

export type QueryHistoryItem = {
  id: string;
  questionText: string;
  responseText: string;
  chapterNumberAtTime: number;
  createdAt: string;
};

export type ImageHistoryItem = {
  id: string;
  userPrompt: string;
  fullPrompt: string;
  imageUrl: string;
  isPublic: boolean;
  chapterNumberAtTime: number;
  createdAt: string;
};

type ReaderAiTab = "ask" | "imagine";

type PromptCopyKind = "original" | "generated";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

type Props = {
  book: ReaderBook;
  chapters: ReaderChapter[];
  initialProgress: ReaderProgress | null;
  viewerRole: UserRole;
};

export function ReaderClient({ book, chapters, initialProgress, viewerRole }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkConsumed = useRef(false);
  const total = chapters.length;

  const [selectedChapterId, setSelectedChapterId] = useState<string>(() => {
    if (initialProgress) return initialProgress.currentChapterId;
    if (chapters[0]) return chapters[0].id;
    return "";
  });

  const [savedProgress, setSavedProgress] = useState<ReaderProgress | null>(initialProgress);

  useEffect(() => {
    setSavedProgress(initialProgress);
    if (initialProgress) {
      setSelectedChapterId(initialProgress.currentChapterId);
    } else if (chapters[0]) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [initialProgress, chapters]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [question, setQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);

  const [historyQueries, setHistoryQueries] = useState<QueryHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyInitialized, setHistoryInitialized] = useState(false);

  const [activeAiTab, setActiveAiTab] = useState<ReaderAiTab>("imagine");

  useEffect(() => {
    if (deepLinkConsumed.current) return;
    const tab = searchParams.get("tab");
    const qRaw = searchParams.get("q");
    if (!tab && !qRaw) return;
    deepLinkConsumed.current = true;
    if (qRaw) {
      setQuestion(qRaw);
      setActiveAiTab("ask");
    } else if (tab === "ask") {
      setActiveAiTab("ask");
    } else if (tab === "imagine") {
      setActiveAiTab("imagine");
    }
    router.replace(`/reader/${book.id}`, { scroll: false });
  }, [searchParams, router, book.id]);

  const [imgPrompt, setImgPrompt] = useState("");
  const [adminImagineFalModel, setAdminImagineFalModel] = useState<ImagineFalModelKey>(IMAGINE_FAL_DEFAULT_ADMIN_KEY);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);

  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [imageHistoryLoading, setImageHistoryLoading] = useState(false);
  const [imageHistoryError, setImageHistoryError] = useState<string | null>(null);
  const [imageHistoryInitialized, setImageHistoryInitialized] = useState(false);
  const [selectedHistoryImage, setSelectedHistoryImage] = useState<ImageHistoryItem | null>(null);
  const [historySwipeDir, setHistorySwipeDir] = useState<-1 | 0 | 1>(0);
  const [historySwipeBusy, setHistorySwipeBusy] = useState(false);
  const [shareUpdatingIds, setShareUpdatingIds] = useState<Record<string, boolean>>({});
  const [promptCopied, setPromptCopied] = useState<PromptCopyKind | null>(null);
  const promptCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);

  const copyPromptText = useCallback(async (kind: PromptCopyKind, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (promptCopyTimeoutRef.current) {
        clearTimeout(promptCopyTimeoutRef.current);
      }
      setPromptCopied(kind);
      promptCopyTimeoutRef.current = setTimeout(() => {
        setPromptCopied(null);
        promptCopyTimeoutRef.current = null;
      }, 2000);
    } catch {
      setPromptCopied(null);
    }
  }, []);

  const saveProgress = useCallback(async () => {
    if (!selectedChapterId || !selectedChapter) {
      setMessage({ type: "err", text: "Select a chapter first." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/progress/${book.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId: selectedChapterId,
          chapterNumber: selectedChapter.sequenceNumber,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        progress?: ReaderProgress;
      };
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Could not save progress" });
        return;
      }
      if (data.progress) {
        setSavedProgress({
          currentChapterId: data.progress.currentChapterId,
          currentChapterNumber: data.progress.currentChapterNumber,
        });
      }
      setMessage({ type: "ok", text: "Progress saved." });
      router.refresh();
    } catch {
      setMessage({ type: "err", text: "Network error. Try again." });
    } finally {
      setSaving(false);
    }
  }, [book.id, selectedChapter, selectedChapterId, router]);

  const loadQueryHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/query?bookId=${encodeURIComponent(book.id)}`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        queries?: QueryHistoryItem[];
      };
      if (!res.ok) {
        setHistoryError(data.error || "Could not load history");
        setHistoryQueries([]);
        return;
      }
      setHistoryQueries(Array.isArray(data.queries) ? data.queries : []);
    } catch {
      setHistoryError("Network error");
      setHistoryQueries([]);
    } finally {
      setHistoryLoading(false);
      setHistoryInitialized(true);
    }
  }, [book.id]);

  const submitQuestion = useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setQaLoading(true);
    setQaError(null);
    setLastAnswer(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id, questionText: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        responseText?: string;
      };
      if (!res.ok) {
        setQaError(data.error || "Something went wrong");
        return;
      }
      if (typeof data.responseText === "string") {
        setLastAnswer(data.responseText);
        setQuestion("");
        void loadQueryHistory();
      } else {
        setQaError("Invalid response from server");
      }
    } catch {
      setQaError("Network error. Try again.");
    } finally {
      setQaLoading(false);
    }
  }, [book.id, question, loadQueryHistory]);

  const loadImageHistory = useCallback(async () => {
    setImageHistoryLoading(true);
    setImageHistoryError(null);
    try {
      const res = await fetch(`/api/imagine?bookId=${encodeURIComponent(book.id)}`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        images?: ImageHistoryItem[];
      };
      if (!res.ok) {
        setImageHistoryError(data.error || "Could not load image history");
        setImageHistory([]);
        return;
      }
      setImageHistory(Array.isArray(data.images) ? data.images : []);
    } catch {
      setImageHistoryError("Network error");
      setImageHistory([]);
    } finally {
      setImageHistoryLoading(false);
      setImageHistoryInitialized(true);
    }
  }, [book.id]);

  useEffect(() => {
    setHistoryInitialized(false);
    setImageHistoryInitialized(false);
  }, [book.id]);

  const openHistoryImageModal = useCallback((item: ImageHistoryItem) => {
    setHistorySwipeDir(0);
    setHistorySwipeBusy(false);
    setSelectedHistoryImage(item);
  }, []);

  const submitImage = useCallback(async () => {
    const trimmed = imgPrompt.trim();
    if (!trimmed) return;
    setImgLoading(true);
    setImgError(null);
    try {
      const res = await fetch("/api/imagine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          userPrompt: trimmed,
          ...(viewerRole === UserRole.admin ? { falImagineModel: adminImagineFalModel } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        imageUrl?: string;
        fullPrompt?: string;
        image?: ImageHistoryItem;
      };
      if (!res.ok) {
        setImgError(data.error || "Something went wrong");
        return;
      }
      if (data.image && typeof data.image.id === "string") {
        const item = data.image as ImageHistoryItem;
        openHistoryImageModal(item);
        setImgPrompt("");
        setImageHistory((prev) => [item, ...prev.filter((i) => i.id !== item.id)]);
        void loadImageHistory();
      } else if (typeof data.imageUrl === "string") {
        const fullPrompt = typeof data.fullPrompt === "string" ? data.fullPrompt : "";
        openHistoryImageModal({
          id: `temp-${Date.now()}`,
          userPrompt: trimmed,
          fullPrompt,
          imageUrl: data.imageUrl,
          isPublic: false,
          chapterNumberAtTime: savedProgress?.currentChapterNumber ?? 1,
          createdAt: new Date().toISOString(),
        });
        setImgPrompt("");
        void loadImageHistory();
      } else {
        setImgError("Invalid response from server");
      }
    } catch {
      setImgError("Network error. Try again.");
    } finally {
      setImgLoading(false);
    }
  }, [book.id, imgPrompt, loadImageHistory, savedProgress?.currentChapterNumber, openHistoryImageModal, viewerRole, adminImagineFalModel]);

  const setImagePublicState = useCallback(
    async (imageId: string, isPublic: boolean) => {
      if (!imageId || imageId.startsWith("temp-") || shareUpdatingIds[imageId]) {
        return;
      }

      const previous = imageHistory.find((item) => item.id === imageId)?.isPublic;
      const previousSelected =
        selectedHistoryImage?.id === imageId ? selectedHistoryImage.isPublic : null;

      setShareUpdatingIds((prev) => ({ ...prev, [imageId]: true }));
      setImageHistory((prev) =>
        prev.map((item) => (item.id === imageId ? { ...item, isPublic } : item)),
      );
      setSelectedHistoryImage((prev) =>
        prev && prev.id === imageId ? { ...prev, isPublic } : prev,
      );

      try {
        const res = await fetch(`/api/gallery/${imageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublic }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          image?: { isPublic?: boolean };
          error?: string;
        };
        if (!res.ok || typeof data.image?.isPublic !== "boolean") {
          throw new Error(data.error || "Failed to update sharing");
        }

        const resolved = data.image.isPublic;
        setImageHistory((prev) =>
          prev.map((item) => (item.id === imageId ? { ...item, isPublic: resolved } : item)),
        );
        setSelectedHistoryImage((prev) =>
          prev && prev.id === imageId ? { ...prev, isPublic: resolved } : prev,
        );
      } catch {
        if (typeof previous === "boolean") {
          setImageHistory((prev) =>
            prev.map((item) =>
              item.id === imageId ? { ...item, isPublic: previous } : item,
            ),
          );
        }
        if (typeof previousSelected === "boolean") {
          setSelectedHistoryImage((prev) =>
            prev && prev.id === imageId ? { ...prev, isPublic: previousSelected } : prev,
          );
        }
      } finally {
        setShareUpdatingIds((prev) => ({ ...prev, [imageId]: false }));
      }
    },
    [imageHistory, selectedHistoryImage, shareUpdatingIds],
  );

  const readerHistoryModalIndex = useMemo(() => {
    if (!selectedHistoryImage || imageHistory.length === 0) return -1;
    return imageHistory.findIndex((img) => img.id === selectedHistoryImage.id);
  }, [selectedHistoryImage, imageHistory]);

  const dismissHistoryImageModal = useCallback(() => {
    setSelectedHistoryImage(null);
    setHistorySwipeDir(0);
    setHistorySwipeBusy(false);
  }, []);

  const bumpHistoryImageModal = useCallback(
    (delta: number) => {
      if (!selectedHistoryImage || historySwipeBusy || imageHistory.length <= 1) return;
      const i = imageHistory.findIndex((img) => img.id === selectedHistoryImage.id);
      if (i < 0) return;
      const next = i + delta;
      if (next < 0 || next >= imageHistory.length) return;
      const item = imageHistory[next];
      if (!item) return;
      setHistorySwipeDir(delta > 0 ? 1 : -1);
      setSelectedHistoryImage(item);
    },
    [selectedHistoryImage, imageHistory, historySwipeBusy],
  );

  useEffect(() => {
    if (!selectedHistoryImage) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismissHistoryImageModal();
        return;
      }
      if (imageHistory.length <= 1) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      if (historySwipeBusy) return;
      const delta = event.key === "ArrowRight" ? 1 : -1;
      bumpHistoryImageModal(delta);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    selectedHistoryImage,
    imageHistory,
    historySwipeBusy,
    dismissHistoryImageModal,
    bumpHistoryImageModal,
  ]);

  useEffect(() => {
    setPromptCopied(null);
    if (promptCopyTimeoutRef.current) {
      clearTimeout(promptCopyTimeoutRef.current);
      promptCopyTimeoutRef.current = null;
    }
  }, [selectedHistoryImage?.id]);

  useEffect(() => {
    if (activeAiTab === "imagine") {
      if (!imageHistoryInitialized && !imageHistoryLoading) {
        void loadImageHistory();
      }
      return;
    }

    if (!historyInitialized && !historyLoading) {
      void loadQueryHistory();
    }
  }, [
    activeAiTab,
    historyInitialized,
    historyLoading,
    imageHistoryInitialized,
    imageHistoryLoading,
    loadImageHistory,
    loadQueryHistory,
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <header className="space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:gap-x-3">
          <h1 className="font-serif text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
            {book.title}
          </h1>
          <span className="hidden text-text-secondary sm:inline" aria-hidden>
            ·
          </span>
          <p className="min-w-0 text-sm text-text-secondary">{book.author}</p>
        </div>
        <Link
          href={`/gallery/${book.id}?from=reader`}
          className="inline-flex text-xs font-medium text-accent-text/90 underline-offset-2 transition hover:text-accent-text hover:underline sm:text-sm"
        >
          See all {book.title} images →
        </Link>

      </header>

      {total === 0 ? (
        <p className="mt-6 rounded-lg border border-border bg-bg-base/80 px-4 py-3 text-sm text-text-secondary">
          This book hasn&apos;t been ingested yet, check back soon
        </p>
      ) : (
        <>
          <section className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,11rem)_1fr]">
            <div className="mx-auto w-full max-w-[11rem] shrink-0 justify-self-center self-start overflow-hidden rounded-xl border border-border bg-bg-surface md:mx-0 md:max-w-none md:justify-self-stretch">
              <div className="relative aspect-[2/3] w-full">
                {book.coverImageUrl ? (
                  <Image
                    src={book.coverImageUrl}
                    alt={`Cover: ${book.title}`}
                    fill
                    className="object-cover"
                    sizes="(min-width: 768px) 176px, (min-width: 640px) 40vw, 75vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm leading-tight text-text-muted">
                    No cover available
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 space-y-3 rounded-xl border border-border bg-bg-surface/60 p-4 sm:p-5">
              <h2 className="font-serif text-lg font-semibold text-text-primary">
                Ask &amp; imagine
              </h2>
              <p className="text-xs leading-relaxed text-text-muted">
                We use only information and descriptions up to your current chapter to avoid spoilers.
              </p>

              <section className="rounded-lg border border-border/80 bg-bg-base/70 px-3 py-3 sm:px-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="min-w-0 sm:min-w-72">
                    <span className="sr-only">Current chapter</span>
                    <select
                      value={selectedChapterId}
                      onChange={(e) => setSelectedChapterId(e.target.value)}
                      className="w-full rounded-md border border-border bg-bg-surface px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
                    >
                      {chapters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.sequenceNumber}. {c.title?.trim() || "Untitled"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={saveProgress}
                    disabled={saving || !selectedChapterId}
                    className="shrink-0 rounded-md border border-border bg-bg-surface px-3 py-1.5 text-sm font-medium text-text-primary transition hover:bg-bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save chapter"}
                  </button>
                </div>
                {message ? (
                  <p
                    className={
                      message.type === "ok"
                        ? "mt-2 text-xs text-success"
                        : "mt-2 text-xs text-error"
                    }
                  >
                    {message.text}
                  </p>
                ) : null}
              </section>

              <div
                className="flex gap-1 border-b border-border"
                role="tablist"
                aria-label="Reader AI tools"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeAiTab === "imagine"}
                  onClick={() => setActiveAiTab("imagine")}
                  className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
                    activeAiTab === "imagine"
                      ? "border-b-2 border-accent text-text-primary"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  Generate Image
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeAiTab === "ask"}
                  onClick={() => setActiveAiTab("ask")}
                  className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
                    activeAiTab === "ask"
                      ? "border-b-2 border-accent text-text-primary"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  Ask a Question
                </button>
              </div>

              {activeAiTab === "imagine" ? (
                <div className="space-y-3 pt-1" role="tabpanel">
                    {viewerRole === UserRole.admin ? (
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-text-primary">Image model (admin)</span>
                        <select
                          value={adminImagineFalModel}
                          onChange={(e) => setAdminImagineFalModel(e.target.value as ImagineFalModelKey)}
                          disabled={imgLoading}
                          className="w-full max-w-md rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25 disabled:opacity-60"
                        >
                          <option value="flux-schnell">flux/schnell (~$0.003 / image)</option>
                          <option value="grok">Grok Imagine (~$0.02 / image)</option>
                          <option value="seedream-v45">Seedream v4.5 (~$0.04 / image)</option>
                        </select>
                      </label>
                    ) : null}
                    <textarea
                      value={imgPrompt}
                      onChange={(e) => setImgPrompt(e.target.value)}
                      placeholder="Describe a scene, character, or moment from what you've read..."
                      rows={4}
                      disabled={imgLoading}
                      className="w-full resize-y rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent/50 focus:ring-2 focus:ring-accent/25 disabled:opacity-60"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void submitImage()}
                        disabled={imgLoading || !imgPrompt.trim()}
                        className="rounded-lg border border-accent/35 bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-accent-hover/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {imgLoading ? "Generating…" : "Generate Image"}
                      </button>
                    </div>
                    {imgError ? (
                      <p className="text-sm text-error">{imgError}</p>
                    ) : null}
                    {imgLoading ? (
                      <div className="flex flex-col items-center gap-3 rounded-lg border border-border/80 bg-bg-base/50 py-8">
                        <div
                          className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-accent"
                          aria-hidden
                        />
                        <p className="text-sm text-text-secondary">
                          Generating your image...
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-3 pt-1" role="tabpanel">
                    <textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ask a question about what you've read so far..."
                      rows={4}
                      disabled={qaLoading}
                      className="w-full resize-y rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent/50 focus:ring-2 focus:ring-accent/25 disabled:opacity-60"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void submitQuestion()}
                        disabled={qaLoading || !question.trim()}
                        className="rounded-lg border border-accent/35 bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-accent-hover/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {qaLoading ? "Asking…" : "Ask"}
                      </button>
                    </div>
                    {qaError ? (
                      <p className="text-sm text-error">{qaError}</p>
                    ) : null}
                    {lastAnswer && !qaLoading ? (
                      <div className="rounded-lg border border-border bg-bg-base/90 px-3 py-3">
                        <div className="text-sm leading-relaxed text-text-primary [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:font-serif [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:font-serif [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-1">
                          <ReactMarkdown>{lastAnswer}</ReactMarkdown>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
            </div>
          </section>

          <section className="mt-4 space-y-2 rounded-xl border border-border bg-bg-surface/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {activeAiTab === "imagine" ? "Previous image generations" : "Previous questions"}
            </p>
            {activeAiTab === "imagine" ? (
              imageHistoryLoading ? (
                <p className="text-xs text-text-muted">Loading…</p>
              ) : imageHistoryError ? (
                <p className="text-xs text-error">{imageHistoryError}</p>
              ) : imageHistory.length === 0 ? (
                <p className="text-xs text-text-muted">No images yet.</p>
              ) : (
                <ul className="flex gap-3 overflow-x-auto pb-1">
                  {imageHistory.map((item) => (
                    <li
                      key={item.id}
                      className="w-36 shrink-0 overflow-hidden rounded-lg border border-border/80 bg-bg-base/50 sm:w-40"
                    >
                      <button
                        type="button"
                        onClick={() => openHistoryImageModal(item)}
                        className="w-full text-left"
                        aria-label={`Open generated image for prompt: ${item.userPrompt}`}
                      >
                        <Image
                          src={item.imageUrl}
                          alt={item.userPrompt}
                          width={800}
                          height={600}
                          unoptimized
                          className="aspect-[4/3] w-full object-cover"
                        />
                      </button>
                      <div className="space-y-1 p-2">
                        <p className="line-clamp-2 text-xs text-text-secondary">
                          {item.userPrompt}
                        </p>
                        <p className="text-[10px] text-text-secondary">
                          Chapter {item.chapterNumberAtTime}
                        </p>
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => void setImagePublicState(item.id, !item.isPublic)}
                            disabled={!!shareUpdatingIds[item.id] || item.id.startsWith("temp-")}
                            className={`inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-[10px] font-semibold transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                              item.isPublic
                                ? "border-error/35 bg-error/10 text-error"
                                : "border-success/35 bg-success/10 text-success"
                            }`}
                          >
                            {shareUpdatingIds[item.id]
                              ? "Saving…"
                              : item.isPublic
                                ? "Make private"
                                : "Make public"}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : historyLoading ? (
              <p className="text-xs text-text-muted">Loading…</p>
            ) : historyError ? (
              <p className="text-xs text-error">{historyError}</p>
            ) : historyQueries.length === 0 ? (
              <p className="text-xs text-text-muted">No questions yet.</p>
            ) : (
              <ul className="max-h-80 space-y-0 divide-y divide-border/80 overflow-y-auto">
                {historyQueries.map((q) => (
                  <li key={q.id} className="py-3 first:pt-0">
                    <p className="text-sm font-semibold text-text-primary">
                      {q.questionText}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                      {q.responseText}
                    </p>
                    <p className="mt-2 text-[11px] text-text-secondary">
                      Chapter {q.chapterNumberAtTime} ·{" "}
                      {new Date(q.createdAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </>
      )}

      {selectedHistoryImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Generated image details"
          onClick={() => dismissHistoryImageModal()}
        >
          <div
            className="flex h-[min(92vh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-bg-surface p-3 shadow-2xl sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-text-muted sm:text-xs">
                  Chapter {selectedHistoryImage.chapterNumberAtTime} ·{" "}
                  {new Date(selectedHistoryImage.createdAt).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
                <span className="inline-flex rounded-full border border-border bg-bg-base px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                  Your image
                </span>
              </div>
              <button
                type="button"
                onClick={() => dismissHistoryImageModal()}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-text-muted hover:bg-bg-surface sm:text-xs"
              >
                Close
              </button>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden">
              <ModalImageSwipeView
                slide={{
                  id: selectedHistoryImage.id,
                  imageUrl: selectedHistoryImage.imageUrl,
                  userPrompt: selectedHistoryImage.userPrompt,
                  locked: false,
                }}
                direction={historySwipeDir}
                onDirectionConsumed={() => setHistorySwipeDir(0)}
                onAnimatingChange={setHistorySwipeBusy}
                sizes="(max-width: 768px) 100vw, min(896px, 100vw)"
              />
              <ModalImageNavArrows
                show={imageHistory.length > 1}
                canPrev={readerHistoryModalIndex > 0 && !historySwipeBusy}
                canNext={
                  readerHistoryModalIndex >= 0 &&
                  readerHistoryModalIndex < imageHistory.length - 1 &&
                  !historySwipeBusy
                }
                onPrev={() => bumpHistoryImageModal(-1)}
                onNext={() => bumpHistoryImageModal(1)}
              />
            </div>

            <div className="mt-3 shrink-0">
              <div className="space-y-4">
                <div className="rounded-md border border-border bg-bg-base/60 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => void setImagePublicState(selectedHistoryImage.id, !selectedHistoryImage.isPublic)}
                    disabled={
                      !!shareUpdatingIds[selectedHistoryImage.id] ||
                      selectedHistoryImage.id.startsWith("temp-")
                    }
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                      selectedHistoryImage.isPublic
                        ? "border-error/35 bg-error/10 text-error"
                        : "border-success/35 bg-success/10 text-success"
                    }`}
                  >
                    {shareUpdatingIds[selectedHistoryImage.id]
                      ? "Saving…"
                      : selectedHistoryImage.isPublic
                        ? "Make private"
                        : "Make public"}
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </button>
                  <p className="mt-1 text-xs text-text-secondary">
                    {selectedHistoryImage.isPublic
                      ? "This image is currently visible in the community gallery."
                      : "Share this image with the NovelViz community."}
                  </p>
                </div>

                <div className="rounded-md border border-border bg-bg-base/60 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImgPrompt(selectedHistoryImage.userPrompt);
                      setActiveAiTab("imagine");
                      dismissHistoryImageModal();
                      // TODO: reuse additional generation settings when more options are added
                    }}
                    className="rounded-md border border-border bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition hover:bg-bg-raised"
                  >
                    Reuse settings
                  </button>
                </div>

                <details className="rounded-md border border-border bg-bg-base/60 px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center gap-2 marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted sm:text-[11px]">
                      Original Prompt
                    </span>
                    <button
                      type="button"
                      title="Copy original prompt"
                      aria-label="Copy original prompt"
                      className="shrink-0 rounded p-1 text-text-muted transition hover:bg-bg-raised/80 hover:text-text-primary"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void copyPromptText("original", selectedHistoryImage.userPrompt);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {promptCopied === "original" ? (
                        <CheckIcon className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <CopyIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </summary>
                  <p className="mt-2 text-xs text-text-primary sm:text-sm">
                    {selectedHistoryImage.userPrompt}
                  </p>
                </details>
                <details className="rounded-md border border-border bg-bg-base/60 px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center gap-2 marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted sm:text-[11px]">
                      Generated Prompt
                    </span>
                    <button
                      type="button"
                      title="Copy generated prompt"
                      aria-label="Copy generated prompt"
                      className="shrink-0 rounded p-1 text-text-muted transition hover:bg-bg-raised/80 hover:text-text-primary"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void copyPromptText("generated", selectedHistoryImage.fullPrompt);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {promptCopied === "generated" ? (
                        <CheckIcon className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <CopyIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed text-text-secondary sm:text-sm">
                    {selectedHistoryImage.fullPrompt}
                  </p>
                </details>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
